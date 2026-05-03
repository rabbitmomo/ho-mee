# -*- coding: utf-8 -*-
"""
YOLOv8 Person Detection Script
Detects people in images, videos, and webcam feed using YOLOv8
"""
import argparse
from pathlib import Path
import cv2
import subprocess
import os
import sys
import json
import time
import tempfile
import numpy as np
from collections import defaultdict
from ultralytics import YOLO
from tqdm import tqdm

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Fix Windows console encoding for emoji
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def parse_args():
    parser = argparse.ArgumentParser(description="YOLOv8 Person Detection")
    parser.add_argument("--source", type=str, required=True, help="Path to image/video, folder, URL, or webcam index (0)")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Model: yolov8n (nano-fast), yolov8s, yolov8m, yolov8l, yolov8x")
    parser.add_argument("--conf", type=float, default=0.5, help="Confidence threshold (0-1)")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold for NMS (0-1)")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image size")
    parser.add_argument("--device", type=str, default="cpu", help="Device: cpu, 0, 1, etc. (auto-detected if not specified)")
    parser.add_argument("--project", type=str, default="ml/yolov8/outputs", help="Output directory")
    parser.add_argument("--name", type=str, default="person_detection", help="Run name")
    parser.add_argument("--save-txt", action="store_true", help="Save detection results as txt")
    parser.add_argument("--save-crop", action="store_true", help="Save cropped person images")
    parser.add_argument("--line-width", type=int, default=2, help="Bounding box line width")
    parser.add_argument("--fps", type=int, default=None, help="Webcam FPS (leave blank to auto-detect)")
    parser.add_argument("--headless", action="store_true", help="Run without display window (for servers or headless environments)")
    return parser.parse_args()


def auto_detect_device():
    """Auto-detect if CUDA is available"""
    if not TORCH_AVAILABLE:
        return "cpu"
    
    try:
        if torch.cuda.is_available():
            device = "0"
            print(f"[*] GPU detected: {torch.cuda.get_device_name(0)}")
            return device
    except Exception as e:
        print(f"[INFO] GPU check failed: {e}")
    
    return "cpu"


def create_mp4_writer(output_path: Path, width: int, height: int, fps: float):
    """Create video writer using FFmpeg subprocess (more reliable than OpenCV on Windows).
    
    Returns (process, codec, success, actual_path). Use process.stdin to write frames.
    Each frame should be a uint8 BGR image of the correct dimensions (width x height x 3).
    """
    
    if fps <= 0:
        fps = 30.0
    
    if width <= 0 or height <= 0:
        print(f"ERROR: Invalid video dimensions: {width}x{height}")
        return None, None, False, None

    actual_path = output_path.with_suffix('.mp4')
    
    ffmpeg_cmd = [
        'ffmpeg',
        '-y',
        '-f', 'rawvideo',
        '-pixel_format', 'bgr24',
        '-video_size', f'{width}x{height}',
        '-framerate', str(fps),
        '-i', 'pipe:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        str(actual_path)
    ]
    
    try:
        check = subprocess.run(['ffmpeg', '-version'], capture_output=True, timeout=5)
        if check.returncode != 0:
            print("[WARNING] FFmpeg not available")
            return None, None, False, None
        
        process = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )
        
        print(f"[INFO] Video writer: FFmpeg H.264/MP4, fps={fps:.2f}, size={width}x{height}")
        return process, "h264", True, actual_path
        
    except FileNotFoundError:
        print("[WARNING] FFmpeg not found - install via: choco install ffmpeg")
        return None, None, False, None
    except Exception as e:
        print(f"[WARNING] FFmpeg error: {e}")
        return None, None, False, None


def probe_source_video_timing(video_path: Path):
    """Probe source video timing from the file itself.

    Returns a dictionary with:
    - frame_count: decoded frame count
    - duration_seconds: measured duration from timestamps when available
    - average_fps: frame_count / duration_seconds when duration is known
    - reported_fps: FPS reported by OpenCV metadata
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return {
            "frame_count": None,
            "duration_seconds": None,
            "average_fps": None,
            "reported_fps": None,
        }

    reported_fps = cap.get(cv2.CAP_PROP_FPS)
    reported_frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)

    decoded_frames = 0
    last_timestamp_msec = 0.0
    while True:
        ret, _ = cap.read()
        if not ret:
            break
        decoded_frames += 1
        timestamp_msec = cap.get(cv2.CAP_PROP_POS_MSEC)
        if timestamp_msec and timestamp_msec > last_timestamp_msec:
            last_timestamp_msec = timestamp_msec

    cap.release()

    duration_seconds = last_timestamp_msec / 1000.0 if last_timestamp_msec > 0 else None
    if duration_seconds and duration_seconds > 0:
        average_fps = decoded_frames / duration_seconds if decoded_frames else None
    elif reported_fps and reported_fps > 0 and reported_frame_count and reported_frame_count > 0:
        duration_seconds = float(reported_frame_count / reported_fps)
        average_fps = float(reported_fps)
    else:
        average_fps = None

    return {
        "frame_count": decoded_frames if decoded_frames else (int(reported_frame_count) if reported_frame_count else None),
        "duration_seconds": duration_seconds,
        "average_fps": average_fps,
        "reported_fps": float(reported_fps) if reported_fps and reported_fps > 0 else None,
    }



def load_model(model_name, device, conf, iou):
    """Load YOLOv8 model"""
    print(f"[*] Loading YOLOv8 model: {model_name}")
    model = YOLO(model_name)
    print(f"[OK] Model loaded successfully")
    return model


def process_webcam(model, args):
    """Process webcam feed with FFmpeg output and JSON report"""
    print("Opening webcam... Press 'q' to quit")
    print(f"Confidence threshold: {args.conf}")
    print(f"Model: {args.model}")
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("ERROR: Cannot open webcam!")
        return
    
    # Set camera resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    # Get actual resolution and FPS
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    webcam_fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Use provided FPS or default to webcam's reported FPS or 30
    fps = args.fps if args.fps else (int(webcam_fps) if webcam_fps > 0 else 30)
    
    print(f"Resolution: {width}x{height}")
    print(f"FPS: {fps}")
    
    # Create output directory
    output_dir = Path(args.project) / args.name
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create FFmpeg video writers
    raw_video_path = output_dir / "raw_video.mp4"
    detected_video_path = output_dir / "detected_video.mp4"
    
    raw_writer, raw_codec, raw_success, raw_actual_path = create_mp4_writer(raw_video_path, width, height, fps)
    detected_writer, detected_codec, detected_success, detected_actual_path = create_mp4_writer(detected_video_path, width, height, fps)
    
    if not raw_success or not detected_success or raw_writer is None or detected_writer is None:
        print("ERROR: Failed to initialize video writers!")
        cap.release()
        return
    
    raw_video_path = raw_actual_path
    detected_video_path = detected_actual_path
    
    frame_count = 0
    total_people = 0
    is_human_presence = False
    frame_reports = []
    class_counts = defaultdict(int)
    class_conf_sum = defaultdict(float)
    analyzed_started_at = time.time()
    
    print(f"[INFO] Saving videos to: {output_dir}")
    
    # Create display window only if not headless
    if not args.headless:
        cv2.namedWindow("YOLOv8 Person Detection (Press Q to Quit)", cv2.WINDOW_NORMAL)
    
    print("[INFO] Recording... Press 'q' to stop")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Write raw frame
            try:
                raw_frame = np.ascontiguousarray(frame)
                raw_writer.stdin.write(raw_frame.tobytes())
            except Exception as e:
                print(f"[ERROR] Failed to write raw frame {frame_count}: {e}")
                break
            
            # Run detection
            results = model(frame, conf=args.conf, iou=args.iou, imgsz=args.imgsz, device=args.device, verbose=False)
            
            # Filter only person detections (class 0)
            detections = results[0].boxes
            person_detections = [det for det in detections if int(det.cls[0]) == 0]
            people_in_frame = len(person_detections)
            is_human_presence = people_in_frame > 0
            
            # Draw only people on frame
            annotated_frame = frame.copy()
            frame_details = []
            frame_class_counts = defaultdict(int)
            
            for det in person_detections:
                x1, y1, x2, y2 = map(int, det.xyxy[0])
                confidence = float(det.conf[0])
                class_id = int(det.cls[0])
                
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), args.line_width)
                cv2.putText(annotated_frame, f'{confidence:.2f}', (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                class_name = model.names[class_id] if class_id < len(model.names) else f"class_{class_id}"
                class_counts[class_name] += 1
                class_conf_sum[class_name] += confidence
                frame_class_counts[class_name] += 1
                total_people += 1
                
                frame_details.append({
                    "class": class_name,
                    "confidence": round(confidence, 6),
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1)
                })
            
            # Add detection count text on top-left corner
            text = f"People: {people_in_frame}"
            cv2.putText(annotated_frame, text, (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 
                       1.2, (0, 255, 0), 2, cv2.LINE_AA)
            
            # Add human presence status
            text_presence = f"Human Presence: {is_human_presence}"
            presence_color = (0, 255, 0) if is_human_presence else (0, 0, 255)
            cv2.putText(annotated_frame, text_presence, (15, 80), cv2.FONT_HERSHEY_SIMPLEX, 
                       0.8, presence_color, 2, cv2.LINE_AA)
            
            # Write annotated frame
            try:
                annotated_frame = np.ascontiguousarray(annotated_frame)
                detected_writer.stdin.write(annotated_frame.tobytes())
            except Exception as e:
                print(f"[ERROR] Failed to write detected frame {frame_count}: {e}")
                break
            
            # Display (only if not headless)
            if not args.headless:
                cv2.imshow("YOLOv8 Person Detection (Press Q to Quit)", annotated_frame)
                
                # Check for quit
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == ord('Q') or key == 27:  # Q or ESC
                    break
            
            # Store frame report
            frame_reports.append({
                "frame_id": frame_count,
                "people_count": people_in_frame,
                "detections": frame_details
            })
    
    finally:
        cap.release()
        if not args.headless:
            cv2.destroyAllWindows()
        
        # Close video writers
        try:
            raw_writer.stdin.close()
            raw_writer.wait(timeout=10)
        except Exception as e:
            print(f"[WARNING] Error closing raw video writer: {e}")
            try:
                raw_writer.kill()
            except:
                pass
        
        try:
            detected_writer.stdin.close()
            detected_writer.wait(timeout=10)
        except Exception as e:
            print(f"[WARNING] Error closing detected video writer: {e}")
            try:
                detected_writer.kill()
            except:
                pass
    
    finished_at = time.time()
    
    # Generate class summary
    class_summary = []
    for class_name in sorted(class_counts.keys()):
        count = class_counts[class_name]
        avg_conf = class_conf_sum[class_name] / count if count else 0
        class_summary.append({
            "class": class_name,
            "count": count,
            "avg_confidence": round(avg_conf, 6)
        })
    
    # Create JSON report
    report_payload = {
        "detection_type": "person_only",
        "source_type": "webcam",
        "output_video_codec": raw_codec,
        "output_fps": fps,
        "analysis_started_unix": analyzed_started_at,
        "analysis_finished_unix": finished_at,
        "analysis_duration_seconds": round(finished_at - analyzed_started_at, 3),
        "total_frames_processed": frame_count,
        "total_people_detected": total_people,
        "human_presence": is_human_presence,
        "class_summary": class_summary,
        "frame_reports": frame_reports,
        "raw_video_path": str(raw_video_path),
        "detected_video_path": str(detected_video_path),
        "model_used": args.model,
        "confidence_threshold": args.conf,
        "iou_threshold": args.iou
    }
    
    # Save JSON report
    timestamp = int(time.time() * 1000)
    report_json_path = output_dir / f"webcam_report_{timestamp}.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    
    print(f"\n[OK] Webcam recording complete!")
    print(f"  Frames captured: {frame_count}")
    print(f"  Total people detected: {total_people}")
    print(f"  Human presence: {is_human_presence}")
    print(f"  Raw video: {raw_video_path}")
    print(f"  Detected video: {detected_video_path}")
    print(f"  Analysis report: {report_json_path}")


def process_video(model, args):
    """Process video file with FFmpeg output and JSON report"""
    source_path = Path(args.source)
    
    if not source_path.exists():
        print(f"ERROR: File not found: {args.source}")
        return
    
    print(f"Processing video: {args.source}")
    
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        print(f"ERROR: Cannot open video: {args.source}")
        return
    
    # Get video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"[VIDEO] {width}x{height} @ {fps}fps, {total_frames} frames")
    
    # Probe video timing for accurate report
    source_video_timing = probe_source_video_timing(source_path)
    
    # Create output directory
    output_dir = Path(args.project) / args.name
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Create FFmpeg video writer
    output_video_path = output_dir / f"{source_path.stem}_detected.mp4"
    writer, codec, success, actual_output_path = create_mp4_writer(output_video_path, width, height, fps)
    
    if not success or writer is None:
        print("ERROR: Failed to initialize video writer!")
        cap.release()
        return
    
    output_video_path = actual_output_path  # Update to actual path
    
    frame_idx = 0
    total_people = 0
    total_detections = 0
    is_human_presence = False
    frame_reports = []
    class_counts = defaultdict(int)
    class_conf_sum = defaultdict(float)
    analyzed_started_at = time.time()
    
    print("[*] Processing frames...")
    print(f"[*] Total frames to process: {total_frames}")
    
    with tqdm(total=total_frames, desc="Analyzing", unit="frame", ncols=100, bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]') as pbar:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_idx += 1
            
            # Run detection
            results = model(frame, conf=args.conf, iou=args.iou, imgsz=args.imgsz, device=args.device, verbose=False)
            
            # Filter only person detections (class 0)
            detections = results[0].boxes
            person_detections = [det for det in detections if int(det.cls[0]) == 0]
            people_in_frame = len(person_detections)
            total_people += people_in_frame
            total_detections += people_in_frame
            is_human_presence = people_in_frame > 0
            
            # Draw only people on frame
            annotated_frame = frame.copy()
            frame_details = []
            frame_class_counts = defaultdict(int)
            
            for det in person_detections:
                x1, y1, x2, y2 = map(int, det.xyxy[0])
                confidence = float(det.conf[0])
                class_id = int(det.cls[0])
                
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), args.line_width)
                cv2.putText(annotated_frame, f'{confidence:.2f}', (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                class_name = model.names[class_id] if class_id < len(model.names) else f"class_{class_id}"
                class_counts[class_name] += 1
                class_conf_sum[class_name] += confidence
                frame_class_counts[class_name] += 1
                
                frame_details.append({
                    "class": class_name,
                    "confidence": round(confidence, 6),
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2),
                    "width": int(x2 - x1),
                    "height": int(y2 - y1)
                })
            
            # Add people count text on top-left corner
            text = f"People: {people_in_frame}"
            cv2.putText(annotated_frame, text, (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 
                       1.2, (0, 255, 0), 2, cv2.LINE_AA)
            
            # Add human presence status
            text_presence = f"Human Presence: {is_human_presence}"
            presence_color = (0, 255, 0) if is_human_presence else (0, 0, 255)
            cv2.putText(annotated_frame, text_presence, (15, 80), cv2.FONT_HERSHEY_SIMPLEX, 
                       0.8, presence_color, 2, cv2.LINE_AA)
            
            # Save crop if requested
            if args.save_crop and people_in_frame > 0:
                for i, det in enumerate(person_detections):
                    x1, y1, x2, y2 = map(int, det.xyxy[0])
                    crop = frame[y1:y2, x1:x2]
                    crop_path = output_dir / f"person_{frame_idx}_{i}.jpg"
                    cv2.imwrite(str(crop_path), crop)
            
            # Save txt if requested (only people)
            if args.save_txt and people_in_frame > 0:
                txt_path = output_dir / f"frame_{frame_idx:06d}.txt"
                with open(txt_path, 'w') as f:
                    for det in person_detections:
                        class_id = int(det.cls[0])
                        confidence = float(det.conf[0])
                        x1, y1, x2, y2 = map(float, det.xyxy[0])
                        f.write(f"{class_id} {confidence:.2f} {x1:.0f} {y1:.0f} {x2:.0f} {y2:.0f}\n")
            
            # Write frame to FFmpeg
            try:
                annotated_frame = np.ascontiguousarray(annotated_frame)
                writer.stdin.write(annotated_frame.tobytes())
            except Exception as e:
                print(f"[ERROR] Failed to write frame {frame_idx} to FFmpeg: {e}")
                break
            
            # Update progress bar
            pbar.update(1)
            pbar.set_description(f"Analyzing [People: {total_people} | Frame People: {people_in_frame}]")
            
            # Store frame report
            frame_reports.append({
                "frame_id": frame_idx,
                "people_count": people_in_frame,
                "detections": frame_details
            })
    
    # Close video writer
    try:
        writer.stdin.close()
        writer.wait(timeout=10)
    except Exception as e:
        print(f"[WARNING] Error closing FFmpeg: {e}")
        try:
            writer.kill()
        except:
            pass
    
    finished_at = time.time()
    cap.release()
    
    # Generate class summary
    class_summary = []
    for class_name in sorted(class_counts.keys()):
        count = class_counts[class_name]
        avg_conf = class_conf_sum[class_name] / count if count else 0
        class_summary.append({
            "class": class_name,
            "count": count,
            "avg_confidence": round(avg_conf, 6)
        })
    
    # Create JSON report
    report_payload = {
        "detection_type": "person_only",
        "source_video": str(source_path),
        "source_video_reported_fps": source_video_timing.get("reported_fps"),
        "source_video_frame_count": source_video_timing.get("frame_count"),
        "source_video_duration_seconds": source_video_timing.get("duration_seconds"),
        "source_video_average_fps": source_video_timing.get("average_fps"),
        "output_video_codec": codec,
        "output_video_fps": fps,
        "analysis_started_unix": analyzed_started_at,
        "analysis_finished_unix": finished_at,
        "analysis_duration_seconds": round(finished_at - analyzed_started_at, 3),
        "total_frames_processed": frame_idx,
        "total_detections": total_detections,
        "total_people_detected": total_people,
        "human_presence": is_human_presence,
        "class_summary": class_summary,
        "frame_reports": frame_reports,
        "saved_video_path": str(output_video_path),
        "model_used": args.model,
        "confidence_threshold": args.conf,
        "iou_threshold": args.iou
    }
    
    # Save JSON report
    report_json_path = output_dir / f"{source_path.stem}_report.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    
    print(f"\n" + "="*80)
    print(f"  Frame Count: {frame_idx}")
    print(f"  Total Detections: {total_detections}")
    print(f"  Total People Detected: {total_people}")
    print(f"  Human Presence: {is_human_presence}")
    print(f"="*80)
    
    print(f"\n[OK] Video processing complete!")
    print(f"  Total frames: {frame_idx}")
    print(f"  Total people detected: {total_people}")
    print(f"  Human presence: {is_human_presence}")
    print(f"  Output video: {output_video_path}")
    print(f"  Video codec: {codec}")
    print(f"  Analysis report: {report_json_path}")
    print(f"  Saved to: {output_dir}")


def process_image(model, args):
    """Process image file with JSON report"""
    source_path = Path(args.source)
    
    if not source_path.exists():
        print(f"ERROR: File not found: {args.source}")
        return
    
    print(f"Processing image: {args.source}")
    
    # Read image
    frame = cv2.imread(str(source_path))
    if frame is None:
        print(f"ERROR: Cannot read image: {args.source}")
        return
    
    print(f"Image size: {frame.shape[1]}x{frame.shape[0]}")
    
    # Create output directory
    output_dir = Path(args.project) / args.name
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Run detection
    print("[*] Running detection...")
    analyzed_started_at = time.time()
    results = model(frame, conf=args.conf, iou=args.iou, imgsz=args.imgsz, device=args.device, verbose=False)
    finished_at = time.time()
    
    # Filter only person detections (class 0)
    detections = results[0].boxes
    person_detections = [det for det in detections if int(det.cls[0]) == 0]
    total_people = len(person_detections)
    
    # Draw only people on frame
    annotated_frame = frame.copy()
    detections_list = []
    class_counts = defaultdict(int)
    class_conf_sum = defaultdict(float)
    
    for det in person_detections:
        x1, y1, x2, y2 = map(int, det.xyxy[0])
        confidence = float(det.conf[0])
        class_id = int(det.cls[0])
        
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), args.line_width)
        cv2.putText(annotated_frame, f'{confidence:.2f}', (x1, y1-5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        class_name = model.names[class_id] if class_id < len(model.names) else f"class_{class_id}"
        class_counts[class_name] += 1
        class_conf_sum[class_name] += confidence
        
        detections_list.append({
            "class": class_name,
            "confidence": round(confidence, 6),
            "x1": int(x1),
            "y1": int(y1),
            "x2": int(x2),
            "y2": int(y2),
            "width": int(x2 - x1),
            "height": int(y2 - y1)
        })
    
    print(f"  People detected: {total_people}")
    is_human_presence = total_people > 0
    print(f"  Human presence: {is_human_presence}")
    
    # Save cropped persons
    if args.save_crop:
        for i, det in enumerate(person_detections):
            x1, y1, x2, y2 = map(int, det.xyxy[0])
            crop = frame[y1:y2, x1:x2]
            crop_path = output_dir / f"person_{i}.jpg"
            cv2.imwrite(str(crop_path), crop)
            print(f"  Saved crop: {crop_path}")
    
    # Save detections as txt (only people)
    if args.save_txt and total_people > 0:
        txt_path = output_dir / f"{source_path.stem}_detections.txt"
        with open(txt_path, 'w') as f:
            for det in person_detections:
                class_id = int(det.cls[0])
                confidence = float(det.conf[0])
                x1, y1, x2, y2 = map(float, det.xyxy[0])
                class_name = model.names[class_id] if class_id < len(model.names) else f"class_{class_id}"
                f.write(f"{class_name} {confidence:.2f} {x1:.0f} {y1:.0f} {x2:.0f} {y2:.0f}\n")
        print(f"  Saved detections: {txt_path}")
    
    # Save annotated image
    output_image_path = output_dir / f"{source_path.stem}_detected.jpg"
    cv2.imwrite(str(output_image_path), annotated_frame)
    
    # Generate class summary
    class_summary = []
    for class_name in sorted(class_counts.keys()):
        count = class_counts[class_name]
        avg_conf = class_conf_sum[class_name] / count if count else 0
        class_summary.append({
            "class": class_name,
            "count": count,
            "avg_confidence": round(avg_conf, 6)
        })
    
    # Create JSON report
    report_payload = {
        "detection_type": "person_only",
        "source_type": "image",
        "source_image": str(source_path),
        "image_width": frame.shape[1],
        "image_height": frame.shape[0],
        "analysis_started_unix": analyzed_started_at,
        "analysis_finished_unix": finished_at,
        "analysis_duration_seconds": round(finished_at - analyzed_started_at, 3),
        "total_people_detected": total_people,
        "human_presence": is_human_presence,
        "detections": detections_list,
        "class_summary": class_summary,
        "output_image_path": str(output_image_path),
        "model_used": args.model,
        "confidence_threshold": args.conf,
        "iou_threshold": args.iou
    }
    
    # Save JSON report
    report_json_path = output_dir / f"{source_path.stem}_report.json"
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
    
    print(f"\n[OK] Image processing complete!")
    print(f"  Output image: {output_image_path}")
    print(f"  Analysis report: {report_json_path}")
    print(f"  Saved to: {output_dir}")
    
    return {
        'total_people': total_people,
        'is_human_presence': is_human_presence,
        'output_path': str(output_image_path),
        'report_path': str(report_json_path)
    }


def main():
    args = parse_args()
    
    # Auto-detect device if using default
    print(f"[*] Device specified: {args.device}")
    if args.device == "cpu":
        device = auto_detect_device()
        if device != "cpu":
            args.device = device
    
    print(f"[*] Using device: {args.device}")
    
    # Load model
    model = load_model(args.model, args.device, args.conf, args.iou)
    
    # Determine source type
    if str(args.source) == "0":
        print("\n" + "="*60)
        process_webcam(model, args)
    else:
        source_path = Path(args.source)
        
        # Check if file exists
        if not source_path.exists():
            print(f"ERROR: Source not found: {args.source}")
            return
        
        # Determine if video or image
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'}
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
        
        suffix = source_path.suffix.lower()
        
        print("\n" + "="*60)
        
        if suffix in video_extensions:
            process_video(model, args)
        elif suffix in image_extensions:
            process_image(model, args)
        else:
            print(f"ERROR: Unsupported file format: {suffix}")
            print(f"Supported formats: {video_extensions | image_extensions}")
            return


if __name__ == "__main__":
    main()
