"""Alert endpoints (PRD 6.3 / 6.7)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.database import get_db
from app.db.models import Alert, District
from app.services.alerts import send_manual_alert

router = APIRouter()


class ManualAlertRequest(BaseModel):
    district_ids: list[int]
    message: str
    risk_level: str = "High"


@router.get("/alerts")
def list_alerts(limit: int = 200, db: Session = Depends(get_db), _=Depends(require_admin)):
    names = {d.id: d.name for d in db.query(District).all()}
    rows = db.query(Alert).order_by(Alert.triggered_at.desc()).limit(limit).all()
    summary = {"sent": 0, "delivered": 0, "failed": 0, "pending": 0}
    for a in rows:
        summary[a.status] = summary.get(a.status, 0) + 1
    return {
        "summary": summary,
        "count": len(rows),
        "alerts": [
            {
                "id": a.id, "district": names.get(a.district_id, "?"),
                "district_id": a.district_id, "alert_type": a.alert_type,
                "risk_level": a.risk_level, "channel": a.channel,
                "recipient": a.recipient, "status": a.status,
                "retry_count": a.retry_count,
                "triggered_at": a.triggered_at.isoformat(),
                "message": a.message,
            }
            for a in rows
        ],
    }


@router.post("/alerts/send")
def send_alert(body: ManualAlertRequest, db: Session = Depends(get_db),
               _=Depends(require_admin)):
    n = send_manual_alert(db, body.district_ids, body.message, body.risk_level)
    return {"dispatched": n}
