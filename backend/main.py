from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI(title="PrevDengue API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to PrevDengue API"}

@app.get("/api/forecasts/national")
def get_national_forecast():
    # Dummy data generator
    districts = [
        "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh",
        "Cumilla", "Faridpur", "Gazipur", "Narayanganj"
    ]
    forecast = []
    for d in districts:
        risk_score = random.choice(["Low", "Medium", "High", "Critical"])
        cases = random.randint(10, 500)
        forecast.append({
            "district": d,
            "risk_level": risk_score,
            "predicted_cases": cases
        })
    return {"forecast": forecast}

@app.get("/api/forecasts/district/{district_id}")
def get_district_forecast(district_id: str):
    return {
        "district": district_id,
        "risk_level": random.choice(["Low", "Medium", "High", "Critical"]),
        "predicted_cases": random.randint(50, 200),
        "trend": [random.randint(20, 100) for _ in range(4)]
    }
