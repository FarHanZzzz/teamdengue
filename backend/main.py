import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ml_pipeline import DenguePredictor

app = FastAPI(title="PrevDengue API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = DenguePredictor(data_dir=os.path.join(os.path.dirname(__file__), "data"))

@app.on_event("startup")
def startup_event():
    print("Ingesting data...")
    success = predictor.ingest_data()
    if success:
        print("Training baseline model...")
        predictor.train_model()
    else:
        print("Failed to initialize ML pipeline. Please check data files.")

@app.get("/")
def read_root():
    return {"message": "Welcome to PrevDengue API"}

@app.get("/api/forecasts/national")
def get_national_forecast():
    from alert_service import alerter
    forecasts = predictor.predict_all_districts()
    # Trigger alerts for Critical districts
    for f in forecasts:
        if f['risk_level'] == 'Critical':
            alerter.trigger_critical_alert(f['district'], f['predicted_cases'])
    return {"forecast": forecasts}

@app.get("/api/forecasts/district/{district_id}")
def get_district_forecast(district_id: str):
    forecasts = predictor.predict_all_districts()
    # Find specific district
    for f in forecasts:
        if f['district'] == district_id:
            return f
    return {"error": "District not found"}
