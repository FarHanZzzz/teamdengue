"""Admin endpoints: on-demand forecast generation + dataset upload (PRD 6.7/6.8)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import RAW_DIR
from app.api.deps import require_admin
from app.db.database import get_db
from app.db.models import Alert, Prediction, UploadedDataset, User
from app.ml.forecast import generate_forecast, load_models
from app.services.alerts import dispatch_for_forecast

router = APIRouter()

UPLOAD_DIR = RAW_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/forecasts/generate")
def generate(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Trigger an on-demand forecast cycle and refresh predictions + alerts."""
    load_models.cache_clear()
    fc = generate_forecast()
    db.query(Prediction).delete()
    for d in fc["districts"]:
        for step in d["trajectory"]:
            db.add(Prediction(
                district_id=d["district_id"], forecast_week=step["week"],
                risk_score=step["risk_score"], risk_level=step["risk_level"],
                shap_values={"top": d["shap"]} if step["week"] == 1 else {},
                model_version=fc["model_version"],
            ))
    # Clear prior auto-escalation alerts so the log reflects the latest cycle
    # (manual advisories are preserved).
    db.query(Alert).filter(Alert.alert_type == "escalation").delete()
    db.commit()
    alerts = dispatch_for_forecast(db, fc)
    return {
        "generated_at": fc["generated_at"], "model_version": fc["model_version"],
        "districts": len(fc["districts"]), "alerts_dispatched": alerts,
    }


@router.post("/data/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_type: str = "surveillance",
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Upload a surveillance or climate CSV (recorded; ingestion is queued)."""
    contents = await file.read()
    dest = UPLOAD_DIR / f"{datetime.now(timezone.utc):%Y%m%d%H%M%S}_{file.filename}"
    dest.write_bytes(contents)
    row_count = max(0, contents.decode("utf-8", errors="ignore").count("\n") - 1)
    rec = UploadedDataset(
        uploaded_by=admin.email, filename=file.filename, file_path=str(dest),
        dataset_type=dataset_type, processing_status="pending", row_count=row_count,
    )
    db.add(rec)
    db.commit()
    return {
        "id": rec.id, "filename": rec.filename, "dataset_type": dataset_type,
        "row_count": row_count, "processing_status": rec.processing_status,
    }


@router.get("/data/uploads")
def list_uploads(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(UploadedDataset).order_by(UploadedDataset.upload_date.desc()).all()
    return [
        {
            "id": r.id, "filename": r.filename, "dataset_type": r.dataset_type,
            "row_count": r.row_count, "processing_status": r.processing_status,
            "uploaded_by": r.uploaded_by, "upload_date": r.upload_date.isoformat(),
        }
        for r in rows
    ]
