from datetime import datetime, timezone, timedelta
from random import uniform
from typing import Dict, List, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(
    title="Ho-Mee Energy Monitoring API",
    description="In-memory API for the AI-Driven Real-Time Energy Monitoring feature",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RM_PER_KWH = 0.57


class HelloResponse(BaseModel):
    message: str


class DeviceBase(BaseModel):
    name: str = Field(..., min_length=1)
    room: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    status: Literal["on", "off"] = "on"
    power_rating_watts: float = Field(..., gt=0)


class DeviceCreate(DeviceBase):
    pass


class Device(DeviceBase):
    id: int
    current_power_usage_watts: float
    estimated_cost_rm_per_hour: float
    estimated_monthly_cost_rm: float
    high_consumption: bool
    trend: Literal["rising", "steady", "falling"]
    last_updated: str


class EnergySummary(BaseModel):
    total_power_usage_watts: float
    total_estimated_cost_rm_per_hour: float
    total_estimated_monthly_cost_rm: float
    high_consumption_devices: int
    efficiency_score: int
    last_updated: str


class TopConsumer(BaseModel):
    id: int
    name: str
    room: str
    category: str
    current_power_usage_watts: float
    estimated_cost_rm_per_hour: float
    share_percent: float


class LiveReading(BaseModel):
    id: int
    device_id: int
    device_name: str
    power_usage_watts: float
    estimated_cost_rm_per_hour: float
    is_high_consumption: bool
    timestamp: str


class WeeklyUsagePoint(BaseModel):
    date: str
    total_power_usage_watts: float
    total_estimated_cost_rm_per_hour: float


devices_store: Dict[int, Dict[str, object]] = {
    1: {"name": "Air Conditioner", "room": "Living Room", "category": "Cooling", "status": "on", "power_rating_watts": 1800.0},
    2: {"name": "Refrigerator", "room": "Kitchen", "category": "Kitchen", "status": "on", "power_rating_watts": 220.0},
    3: {"name": "Water Heater", "room": "Bathroom", "category": "Heating", "status": "on", "power_rating_watts": 3200.0},
    4: {"name": "Smart TV", "room": "Bedroom", "category": "Entertainment", "status": "off", "power_rating_watts": 140.0},
    5: {"name": "Washing Machine", "room": "Laundry", "category": "Cleaning", "status": "off", "power_rating_watts": 540.0},
    6: {"name": "Dishwasher", "room": "Kitchen", "category": "Cleaning", "status": "on", "power_rating_watts": 1200.0},
    7: {"name": "Oven", "room": "Kitchen", "category": "Cooking", "status": "off", "power_rating_watts": 2200.0},
    8: {"name": "Ceiling Fan", "room": "Master Bedroom", "category": "Comfort", "status": "on", "power_rating_watts": 75.0},
    9: {"name": "Gaming Console", "room": "Study", "category": "Entertainment", "status": "off", "power_rating_watts": 210.0},
    10: {"name": "Rice Cooker", "room": "Kitchen", "category": "Cooking", "status": "off", "power_rating_watts": 650.0},
    11: {"name": "Lamp", "room": "Living Room", "category": "Lighting", "status": "on", "power_rating_watts": 120.0},
}

device_metrics: Dict[int, Dict[str, object]] = {}
next_device_id = 12
next_reading_id = 1


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def cost_per_hour(power_usage_watts: float) -> float:
    return round((power_usage_watts / 1000.0) * RM_PER_KWH, 2)


def monthly_cost(power_usage_watts: float) -> float:
    return round(cost_per_hour(power_usage_watts) * 24 * 30, 2)


def trend_for(device_id: int) -> str:
    if device_id % 3 == 0:
        return "rising"
    if device_id % 2 == 0:
        return "steady"
    return "falling"


def refresh_metrics() -> List[Device]:
    updated_devices: List[Device] = []

    for device_id, device in devices_store.items():
        base_power = float(device["power_rating_watts"])
        status = device["status"]
        if status == "off":
            current_power = round(base_power * uniform(0.01, 0.05), 2)
        else:
            current_power = round(base_power * uniform(0.72, 1.12), 2)

        high_consumption = current_power >= 1200
        metrics = {
            "current_power_usage_watts": current_power,
            "estimated_cost_rm_per_hour": cost_per_hour(current_power),
            "estimated_monthly_cost_rm": monthly_cost(current_power),
            "high_consumption": high_consumption,
            "trend": trend_for(device_id),
            "last_updated": now_iso(),
        }
        device_metrics[device_id] = metrics
        updated_devices.append(Device(id=device_id, **device, **metrics))

    return updated_devices


def to_device(device_id: int) -> Device:
    device = devices_store[device_id]
    metrics = device_metrics.get(device_id)
    if metrics is None:
        refresh_metrics()
        metrics = device_metrics[device_id]
    return Device(id=device_id, **device, **metrics)


def total_power_usage(devices: List[Device]) -> float:
    return round(sum(device.current_power_usage_watts for device in devices), 2)


def calculate_efficiency_score(total_power: float, high_consumption_count: int) -> int:
    base_score = 92 - int(total_power / 350)
    penalty = high_consumption_count * 5
    return max(40, min(99, base_score - penalty))


def weekly_usage_curve() -> List[WeeklyUsagePoint]:
    """Generate a 7-day trend that rises from the first date to the last date."""
    devices = refresh_metrics()
    baseline = round(total_power_usage(devices), 2)
    today = datetime.now(timezone.utc).date()

    points: List[WeeklyUsagePoint] = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        step = 6 - offset
        growth_factor = 0.72 + (step * 0.08)
        daily_power = round(baseline * growth_factor + (step * 42.5), 2)
        points.append(
            WeeklyUsagePoint(
                date=day.isoformat(),
                total_power_usage_watts=daily_power,
                total_estimated_cost_rm_per_hour=cost_per_hour(daily_power),
            )
        )

    return points


@app.get("/")
async def root():
    return {"message": "Hello from FastAPI Backend!"}


@app.get("/api/hello", response_model=HelloResponse)
async def hello():
    return HelloResponse(message="Hello from FastAPI Backend!")


@app.get("/api/devices", response_model=List[Device])
async def get_devices():
    return refresh_metrics()


@app.post("/api/devices", response_model=Device, status_code=201)
async def add_device(payload: DeviceCreate):
    global next_device_id

    device_id = next_device_id
    next_device_id += 1

    devices_store[device_id] = payload.model_dump()
    refresh_metrics()
    return to_device(device_id)


@app.get("/api/energy-summary", response_model=EnergySummary)
async def get_energy_summary():
    devices = refresh_metrics()
    power_usage = total_power_usage(devices)
    total_hourly_cost = round(sum(device.estimated_cost_rm_per_hour for device in devices), 2)
    total_monthly_cost = round(sum(device.estimated_monthly_cost_rm for device in devices), 2)
    high_consumption_count = sum(1 for device in devices if device.high_consumption)

    return EnergySummary(
        total_power_usage_watts=power_usage,
        total_estimated_cost_rm_per_hour=total_hourly_cost,
        total_estimated_monthly_cost_rm=total_monthly_cost,
        high_consumption_devices=high_consumption_count,
        efficiency_score=calculate_efficiency_score(power_usage, high_consumption_count),
        last_updated=now_iso(),
    )


@app.get("/api/top-consumers", response_model=List[TopConsumer])
async def get_top_consumers(limit: int = 3):
    devices = refresh_metrics()
    ranked_devices = sorted(devices, key=lambda device: device.current_power_usage_watts, reverse=True)
    total_power = total_power_usage(devices) or 1.0

    return [
        TopConsumer(
            id=device.id,
            name=device.name,
            room=device.room,
            category=device.category,
            current_power_usage_watts=device.current_power_usage_watts,
            estimated_cost_rm_per_hour=device.estimated_cost_rm_per_hour,
            share_percent=round((device.current_power_usage_watts / total_power) * 100, 1),
        )
        for device in ranked_devices[: max(1, limit)]
    ]


@app.get("/api/live-readings", response_model=List[LiveReading])
async def get_live_readings():
    global next_reading_id

    devices = refresh_metrics()
    readings: List[LiveReading] = []

    for device in devices:
        readings.append(
            LiveReading(
                id=next_reading_id,
                device_id=device.id,
                device_name=device.name,
                power_usage_watts=device.current_power_usage_watts,
                estimated_cost_rm_per_hour=device.estimated_cost_rm_per_hour,
                is_high_consumption=device.high_consumption,
                timestamp=now_iso(),
            )
        )
        next_reading_id += 1

    return readings


@app.get("/api/weekly-usage", response_model=List[WeeklyUsagePoint])
async def get_weekly_usage():
    return weekly_usage_curve()


@app.post("/api/devices/{device_id}/toggle", response_model=Device)
async def toggle_device(device_id: int):
    """Toggle device on/off state"""
    if device_id not in devices_store:
        raise HTTPException(status_code=404, detail="Device not found")

    current = devices_store[device_id]["status"]
    devices_store[device_id]["status"] = "off" if current == "on" else "on"
    refresh_metrics()
    return to_device(device_id)


@app.get("/api/devices/{device_id}/readings", response_model=List[LiveReading])
async def get_device_readings(device_id: int, limit: int = 48):
    """Return a mock historical series for a device (last `limit` samples)"""
    if device_id not in devices_store:
        raise HTTPException(status_code=404, detail="Device not found")

    base = float(devices_store[device_id]["power_rating_watts"])
    samples: List[LiveReading] = []
    global next_reading_id
    for i in range(limit):
        # create a pseudo-history by sampling around the base
        variation = uniform(0.6, 1.05) if devices_store[device_id]["status"] == "on" else uniform(0.01, 0.06)
        power = round(base * variation, 2)
        samples.append(
            LiveReading(
                id=next_reading_id,
                device_id=device_id,
                device_name=devices_store[device_id]["name"],
                power_usage_watts=power,
                estimated_cost_rm_per_hour=cost_per_hour(power),
                is_high_consumption=power >= 1200,
                timestamp=(datetime.now(timezone.utc) - timedelta(minutes=5 * (limit - i))).isoformat(),
            )
        )
        next_reading_id += 1

    return samples


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ho-mee-backend"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
