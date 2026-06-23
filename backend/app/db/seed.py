"""Initialise and seed the PrevDengue database.

Creates the schema, loads districts + raw observational data, runs the live
forecast, persists predictions, seeds users / alert recipients / model
registry, and dispatches escalation alerts.
"""
from __future__ import annotations

import json

import pandas as pd

from app.core.config import MODELS_DIR, RAW_DIR
from app.db.database import Base, SessionLocal, engine
from app.db import models
from app.ml.forecast import generate_forecast
from app.services.alerts import dispatch_for_forecast


def reset_schema() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_districts(db) -> None:
    df = pd.read_csv(RAW_DIR / "districts.csv")
    for _, r in df.iterrows():
        db.add(models.District(
            id=int(r["id"]), name=r["name"], name_bn=r["name_bn"],
            division=r["division"], lat=float(r["lat"]), lon=float(r["lon"]),
            area_sqkm=float(r["area_sqkm"]), population=int(r["population"]),
            pop_density=float(r["pop_density"]), urban_proportion=float(r["urban_proportion"]),
            agri_land_pct=float(r["agri_land_pct"]), is_metro=bool(r["is_metro"]),
        ))
    db.commit()


def seed_hospitals(db) -> None:
    path = RAW_DIR / "hospitals.csv"
    if not path.exists():
        print("  (hospitals.csv not found — run data/generate_hospitals.py)")
        return
    df = pd.read_csv(path)
    for _, r in df.iterrows():
        db.add(models.Hospital(
            id=int(r["id"]), name=r["name"], type=r["type"],
            district_id=int(r["district_id"]), lat=float(r["lat"]), lon=float(r["lon"]),
            beds=int(r["beds"]), dengue_beds=int(r["dengue_beds"]),
            phone=str(r["phone"]), email=str(r["email"]),
            dist_from_center_km=float(r["dist_from_center_km"]),
        ))
    db.commit()


def load_observations() -> None:
    """Bulk-load the large climate + case tables (PRD schema 10.1)."""
    climate = pd.read_csv(RAW_DIR / "climate_weekly.csv")
    cases = pd.read_csv(RAW_DIR / "dengue_weekly.csv")
    climate.to_sql("climate_data", engine, if_exists="replace", index=False)
    cases.to_sql("dengue_cases", engine, if_exists="replace", index=False)


def seed_predictions(db, forecast: dict) -> None:
    mv = forecast["model_version"]
    for d in forecast["districts"]:
        for step in d["trajectory"]:
            db.add(models.Prediction(
                district_id=d["district_id"],
                forecast_week=step["week"],
                risk_score=step["risk_score"],
                risk_level=step["risk_level"],
                shap_values={"top": d["shap"]} if step["week"] == 1 else {},
                model_version=mv,
            ))
    db.commit()


def seed_users_and_recipients(db) -> None:
    districts = {d.name: d for d in db.query(models.District).all()}
    dhaka = districts.get("Dhaka")
    ctg = districts.get("Chittagong")

    users = [
        models.User(id="u-citizen", email="citizen@demo.bd", full_name="Demo Citizen",
                    role="citizen", district_id=None, phone=None),
        models.User(id="u-dho", email="dho.dhaka@demo.bd", full_name="Dr. Rahim (DHO, Dhaka)",
                    role="dho", district_id=dhaka.id if dhaka else None, phone="+8801700000001"),
        models.User(id="u-hospital", email="hospital.ctg@demo.bd",
                    full_name="Hospital Admin (Chittagong)", role="hospital_admin",
                    district_id=ctg.id if ctg else None, phone="+8801700000002"),
        models.User(id="u-dghs", email="admin@dghs.gov.bd", full_name="DGHS Administrator",
                    role="dghs_admin", district_id=None, phone="+8801700000003"),
    ]
    db.add_all(users)

    for d in db.query(models.District).all():
        db.add(models.AlertRecipient(
            district_id=d.id, user_id=None,
            email=f"dho.{d.name.lower().replace(' ', '').replace(chr(39), '')}@dghs.gov.bd",
            phone="+8801711000000", active_channels=["email", "sms"],
        ))
    db.commit()


def seed_model_registry(db) -> None:
    meta = json.loads((MODELS_DIR / "metadata.json").read_text())
    db.add(models.ModelVersion(
        version_tag=meta["version_tag"], training_data_range=meta["training_data_range"],
        auc_xgb=meta["auc_xgb"], auc_lgbm=meta["auc_lgbm"],
        auc_ensemble=meta["auc_ensemble"], feature_set_version=meta["feature_set_version"],
        artifact_path=str(MODELS_DIR),
    ))
    db.add(models.UploadedDataset(
        uploaded_by="admin@dghs.gov.bd", filename="dengue_weekly_2000_2023.csv",
        file_path=str(RAW_DIR / "dengue_weekly.csv"), dataset_type="surveillance",
        processing_status="processed", row_count=80128,
    ))
    db.commit()


def main() -> None:
    print("Resetting schema...")
    reset_schema()
    db = SessionLocal()
    try:
        print("Seeding districts...")
        seed_districts(db)
        print("Seeding hospitals...")
        seed_hospitals(db)
        print("Loading observations (climate + cases)...")
        load_observations()
        print("Generating forecast...")
        fc = generate_forecast()
        print("Seeding predictions...")
        seed_predictions(db, fc)
        print("Seeding users + alert recipients...")
        seed_users_and_recipients(db)
        print("Seeding model registry...")
        seed_model_registry(db)
        print("Dispatching escalation alerts...")
        n = dispatch_for_forecast(db, fc)
        print(f"  {n} alerts created.")
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
