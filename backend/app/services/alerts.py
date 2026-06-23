"""Alert & notification service (PRD 6.3).

Locally, SMS and email delivery is *simulated* and logged so the workflow can
be demonstrated without Twilio/Resend accounts. Setting RESEND_API_KEY /
TWILIO_* env vars and SIMULATE_ALERTS=false would wire in real delivery at the
marked integration points.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Alert, AlertRecipient, District

logger = logging.getLogger("prevdengue.alerts")

ACTION_BY_LEVEL = {
    "High": "Deploy fogging teams; pre-allocate hospital beds; activate media advisories.",
    "Critical": "Immediate emergency response; mobilize surge capacity; escalate to DGHS central.",
}


def _compose_sms(district: str, level: str) -> str:
    # Must fit within 160 chars (PRD 6.3.2)
    msg = f"PrevDengue ALERT: {district} risk now {level}. View: prevdengue.app/d/{district.lower()}"
    return msg[:160]


def _compose_email(district: str, level: str, drivers: list[str]) -> str:
    drivers_txt = ", ".join(drivers) if drivers else "multiple environmental factors"
    return (
        f"District {district} has escalated to {level} dengue risk.\n\n"
        f"Top drivers: {drivers_txt}.\n\n"
        f"Recommended action: {ACTION_BY_LEVEL.get(level, 'Heightened monitoring.')}\n"
    )


def _simulate_send(channel: str, recipient: str, body: str) -> str:
    """Return delivery status. Real Resend/Twilio calls would go here."""
    if not settings.simulate_alerts:
        # Integration point: call Resend (email) or Twilio (sms) here.
        ...
    logger.info("[SIMULATED %s] -> %s: %s", channel.upper(), recipient, body[:80])
    return "delivered"


def dispatch_for_forecast(db: Session, forecast: dict) -> int:
    """Create + dispatch alerts for every district at High/Critical risk."""
    created = 0
    districts = {d.id: d for d in db.query(District).all()}
    recipients_by_district: dict[int, list[AlertRecipient]] = {}
    for r in db.query(AlertRecipient).all():
        recipients_by_district.setdefault(r.district_id, []).append(r)

    for d in forecast["districts"]:
        level = d["risk_level"]
        if level not in ("High", "Critical"):
            continue
        district = districts.get(d["district_id"])
        if district is None:
            continue
        drivers = [s["label"] for s in d.get("shap", [])[:3]]
        recips = recipients_by_district.get(d["district_id"], [])
        if not recips:
            continue
        for rec in recips:
            for channel in rec.active_channels:
                if channel == "email":
                    body = _compose_email(district.name, level, drivers)
                    target = rec.email
                elif channel == "sms":
                    body = _compose_sms(district.name, level)
                    target = rec.phone or ""
                else:
                    body = _compose_sms(district.name, level)
                    target = rec.email
                if not target:
                    continue
                status = _simulate_send(channel, target, body)
                alert = Alert(
                    district_id=d["district_id"],
                    alert_type="escalation",
                    risk_level=level,
                    channel=channel,
                    recipient=target,
                    status=status,
                    message=body,
                    delivered_at=datetime.now(timezone.utc) if status == "delivered" else None,
                )
                db.add(alert)
                created += 1
    db.commit()
    return created


def send_manual_alert(db: Session, district_ids: list[int], message: str,
                      level: str = "High") -> int:
    created = 0
    recipients_by_district: dict[int, list[AlertRecipient]] = {}
    for r in db.query(AlertRecipient).all():
        recipients_by_district.setdefault(r.district_id, []).append(r)
    for did in district_ids:
        for rec in recipients_by_district.get(did, []):
            for channel in rec.active_channels:
                target = rec.email if channel == "email" else (rec.phone or rec.email)
                status = _simulate_send(channel, target, message)
                db.add(Alert(
                    district_id=did, alert_type="manual", risk_level=level,
                    channel=channel, recipient=target, status=status, message=message,
                    delivered_at=datetime.now(timezone.utc),
                ))
                created += 1
    db.commit()
    return created
