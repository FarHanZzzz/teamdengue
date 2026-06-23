"""Public + authenticated read endpoints: districts, forecasts, history,
summary, citizen risk, and model metrics."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import DATA_DIR
from app.core.geo import haversine_km
from app.api.deps import current_user, require_admin
from app.db.database import get_db
from app.db.models import District, Hospital, ModelVersion, Prediction
from app.ml.forecast import predicted_history

router = APIRouter()

LEVEL_ADVICE = {
    "Low": {
        "en": "Routine precautions. Dengue risk is currently low in your district.",
        "bn": "\u09b8\u09cd\u09ac\u09be\u09ad\u09be\u09ac\u09bf\u0995 \u09b8\u09a4\u09b0\u09cd\u0995\u09a4\u09be \u0985\u09ac\u09b2\u09ae\u09cd\u09ac\u09a8 \u0995\u09b0\u09c1\u09a8\u0964 \u0986\u09aa\u09a8\u09be\u09b0 \u099c\u09c7\u09b2\u09be\u09af\u09bc \u09a1\u09c7\u0999\u09cd\u0997\u09c1\u09b0 \u099d\u09c1\u0981\u0995\u09bf \u09ac\u09b0\u09cd\u09a4\u09ae\u09be\u09a8\u09c7 \u0995\u09ae\u0964",
    },
    "Medium": {
        "en": "Use mosquito repellent and remove standing water around your home.",
        "bn": "\u09ae\u09b6\u09be \u09a8\u09bf\u09b0\u09cb\u09a7\u0995 \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u0995\u09b0\u09c1\u09a8 \u098f\u09ac\u0982 \u09ac\u09be\u09a1\u09bc\u09bf\u09b0 \u0986\u09b6\u09aa\u09be\u09b6\u09c7 \u099c\u09ae\u09be \u09aa\u09be\u09a8\u09bf \u09b8\u09b0\u09be\u09a8\u0964",
    },
    "High": {
        "en": "High risk. Use repellent, sleep under a net, and seek care promptly if you develop fever.",
        "bn": "\u0989\u099a\u09cd\u099a \u099d\u09c1\u0981\u0995\u09bf\u0964 \u09ae\u09b6\u09be\u09b0\u09bf \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u0995\u09b0\u09c1\u09a8 \u098f\u09ac\u0982 \u099c\u09cd\u09ac\u09b0 \u09b9\u09b2\u09c7 \u09a6\u09cd\u09b0\u09c1\u09a4 \u099a\u09bf\u0995\u09bf\u09ce\u09b8\u09be \u09a8\u09bf\u09a8\u0964",
    },
    "Critical": {
        "en": "Critical risk. Take all precautions. Seek medical attention immediately for fever, rash, or severe pain.",
        "bn": "\u09b8\u0982\u0995\u099f\u09be\u09aa\u09a8\u09cd\u09a8 \u099d\u09c1\u0981\u0995\u09bf\u0964 \u099c\u09cd\u09ac\u09b0, \u09b0\u09cd\u09af\u09be\u09b6 \u09ac\u09be \u09a4\u09c0\u09ac\u09cd\u09b0 \u09ac\u09cd\u09af\u09a5\u09be \u09b9\u09b2\u09c7 \u0985\u09ac\u09bf\u09b2\u09ae\u09cd\u09ac\u09c7 \u09b9\u09be\u09b8\u09aa\u09be\u09a4\u09be\u09b2\u09c7 \u09af\u09be\u09a8\u0964",
    },
}


def _district_dict(d: District) -> dict:
    return {
        "id": d.id, "name": d.name, "name_bn": d.name_bn, "division": d.division,
        "lat": d.lat, "lon": d.lon, "population": d.population,
        "pop_density": d.pop_density, "urban_proportion": d.urban_proportion,
        "agri_land_pct": d.agri_land_pct, "is_metro": d.is_metro,
    }


@router.get("/districts")
def list_districts(db: Session = Depends(get_db)):
    return [_district_dict(d) for d in db.query(District).order_by(District.name).all()]


def _hospital_dict(h: Hospital) -> dict:
    return {
        "id": h.id, "name": h.name, "type": h.type, "district_id": h.district_id,
        "lat": h.lat, "lon": h.lon, "beds": h.beds, "dengue_beds": h.dengue_beds,
        "phone": h.phone, "email": h.email, "dist_from_center_km": h.dist_from_center_km,
    }


@router.get("/hospitals")
def list_hospitals(district_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Hospital)
    if district_id:
        q = q.filter(Hospital.district_id == district_id)
    return [_hospital_dict(h) for h in q.order_by(Hospital.district_id, Hospital.name).all()]


@router.get("/hospitals/near")
def hospitals_near(lat: float, lon: float, limit: int = 5, db: Session = Depends(get_db)):
    """Nearest facilities to a point, with correct haversine distances."""
    hospitals = db.query(Hospital).all()
    out = []
    for h in hospitals:
        d = _hospital_dict(h)
        d["distance_km"] = haversine_km(lat, lon, h.lat, h.lon)
        out.append(d)
    out.sort(key=lambda x: x["distance_km"])
    return out[:limit]


@router.get("/districts/geojson")
def districts_geojson():
    path = Path(DATA_DIR) / "bd_districts.geojson"
    if not path.exists():
        raise HTTPException(404, "GeoJSON not found")
    return FileResponse(path, media_type="application/geo+json")


def _latest_predictions(db: Session) -> dict[int, list[Prediction]]:
    rows = db.query(Prediction).order_by(Prediction.forecast_week).all()
    out: dict[int, list[Prediction]] = {}
    for p in rows:
        out.setdefault(p.district_id, []).append(p)
    return out


@router.get("/forecasts")
def get_forecasts(db: Session = Depends(get_db)):
    """Latest 4-week risk scores for all 64 districts (current = week 1)."""
    preds = _latest_predictions(db)
    districts = {d.id: d for d in db.query(District).all()}
    out = []
    for did, plist in preds.items():
        d = districts[did]
        cur = next((p for p in plist if p.forecast_week == 1), plist[0])
        out.append({
            **_district_dict(d),
            "risk_score": cur.risk_score,
            "risk_level": cur.risk_level,
            "model_version": cur.model_version,
            "trajectory": [
                {"week": p.forecast_week, "risk_score": p.risk_score, "risk_level": p.risk_level}
                for p in sorted(plist, key=lambda x: x.forecast_week)
            ],
        })
    out.sort(key=lambda x: x["name"])
    return {"count": len(out), "districts": out}


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """National roll-up for the dashboard header."""
    counts = (
        db.query(Prediction.risk_level, func.count())
        .filter(Prediction.forecast_week == 1)
        .group_by(Prediction.risk_level).all()
    )
    level_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for level, n in counts:
        level_counts[level] = n
    mv = db.query(ModelVersion).order_by(ModelVersion.id.desc()).first()
    return {
        "total_districts": db.query(District).count(),
        "level_counts": level_counts,
        "at_risk": level_counts["High"] + level_counts["Critical"],
        "model": {
            "version": mv.version_tag if mv else None,
            "auc_ensemble": mv.auc_ensemble if mv else None,
        } if mv else None,
    }


@router.get("/forecasts/{district_id}")
def get_district_forecast(district_id: int, db: Session = Depends(get_db),
                          user=Depends(current_user)):
    d = db.get(District, district_id)
    if not d:
        raise HTTPException(404, "District not found")
    plist = sorted(
        db.query(Prediction).filter(Prediction.district_id == district_id).all(),
        key=lambda x: x.forecast_week,
    )
    cur = next((p for p in plist if p.forecast_week == 1), plist[0] if plist else None)
    # SHAP visible only to officials (PRD 6.6.2)
    show_shap = user is not None and user.role in ("dho", "hospital_admin", "dghs_admin")
    shap = cur.shap_values.get("top", []) if (cur and show_shap) else []
    return {
        **_district_dict(d),
        "risk_score": cur.risk_score if cur else None,
        "risk_level": cur.risk_level if cur else None,
        "trajectory": [
            {"week": p.forecast_week, "risk_score": p.risk_score, "risk_level": p.risk_level}
            for p in plist
        ],
        "shap": shap,
        "shap_visible": show_shap,
    }


@router.get("/history/{district_id}")
def get_history(district_id: int, db: Session = Depends(get_db)):
    d = db.get(District, district_id)
    if not d:
        raise HTTPException(404, "District not found")
    return {"district_id": district_id, "name": d.name, "series": predicted_history(district_id)}


@router.get("/citizens/risk/{district}")
def citizen_risk(district: str, db: Session = Depends(get_db)):
    """Public endpoint: risk level + plain-language advice (EN/BN)."""
    d = (
        db.query(District)
        .filter(func.lower(District.name) == district.lower())
        .first()
    )
    if not d:
        raise HTTPException(404, "District not found")
    cur = (
        db.query(Prediction)
        .filter(Prediction.district_id == d.id, Prediction.forecast_week == 1)
        .first()
    )
    level = cur.risk_level if cur else "Low"
    return {
        "district": d.name, "district_bn": d.name_bn, "division": d.division,
        "risk_level": level, "risk_score": cur.risk_score if cur else 0.0,
        "advice": LEVEL_ADVICE.get(level, LEVEL_ADVICE["Low"]),
    }


@router.get("/model/metrics")
def model_metrics(db: Session = Depends(get_db), _=Depends(require_admin)):
    mv = db.query(ModelVersion).order_by(ModelVersion.id.desc()).first()
    if not mv:
        raise HTTPException(404, "No model registered")
    return {
        "version_tag": mv.version_tag, "trained_at": mv.trained_at.isoformat(),
        "training_data_range": mv.training_data_range,
        "auc_xgb": mv.auc_xgb, "auc_lgbm": mv.auc_lgbm, "auc_ensemble": mv.auc_ensemble,
        "feature_set_version": mv.feature_set_version,
    }
