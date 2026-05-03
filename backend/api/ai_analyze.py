import os
import pickle
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/classify", tags=["classifier"])

# ---------------------------
# 1. Define request/response models
# ---------------------------
class TextRequest(BaseModel):
    text: str

class ClassificationResponse(BaseModel):
    prediction: str      # "normal" or "abnormal"
    confidence: float    # probability of the predicted class (if available)

MODEL_PATH = Path(__file__).parent / "models" / "rf_abnormal_model.pkl"
VECTORIZER_PATH = Path(__file__).parent / "models" / "tfidf_vectorizer.pkl"

_model = None
_vectorizer = None

def load_model_and_vectorizer():
    global _model, _vectorizer
    if _model is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(f"Model file not found at {MODEL_PATH}")
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
    if _vectorizer is None:
        if not VECTORIZER_PATH.exists():
            raise RuntimeError(f"Vectorizer file not found at {VECTORIZER_PATH}")
        with open(VECTORIZER_PATH, "rb") as f:
            _vectorizer = pickle.load(f)
    return _model, _vectorizer

# ---------------------------
# 3. Classification endpoint
# ---------------------------
@router.post("/abnormal", response_model=ClassificationResponse)
async def classify_text(request: TextRequest):
    """
    Classify a given text as 'normal' or 'abnormal' using a pre-trained Random Forest model.
    The text could be sensor logs, maintenance notes, or any descriptive string.
    """
    try:
        model, vectorizer = load_model_and_vectorizer()
        
        # Transform input text using the same vectorizer used during training
        X_input = vectorizer.transform([request.text])
        
        # Predict class and probability
        pred_label = model.predict(X_input)[0]          # 0 or 1 (depending on your encoding)
        pred_proba = model.predict_proba(X_input)[0]    # [prob_class0, prob_class1]
        
        # Map label to human-readable string (adjust mapping as per your training)
        # Assuming 0 = normal, 1 = abnormal
        label_map = {0: "normal", 1: "abnormal"}
        prediction = label_map.get(pred_label, "unknown")
        
        # Confidence = probability of the predicted class
        confidence = max(pred_proba)
        
        return ClassificationResponse(
            prediction=prediction,
            confidence=float(confidence)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")