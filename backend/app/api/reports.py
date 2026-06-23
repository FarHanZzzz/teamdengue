"""Reporting & exports (PRD 6.8): national/district PDF + CSV."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import District, ModelVersion, Prediction

router = APIRouter()

LEVEL_COLOR = {
    "Low": colors.HexColor("#27AE60"), "Medium": colors.HexColor("#F1C40F"),
    "High": colors.HexColor("#E67E22"), "Critical": colors.HexColor("#C0392B"),
}


def _model_version(db: Session) -> str:
    mv = db.query(ModelVersion).order_by(ModelVersion.id.desc()).first()
    return mv.version_tag if mv else "n/a"


def _pdf(title: str, rows: list[list[str]], header: list[str], db: Session) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("PrevDengue", styles["Title"]),
        Paragraph(title, styles["Heading2"]),
        Paragraph(
            f"Generated: {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC} &nbsp;|&nbsp; "
            f"Model: {_model_version(db)} &nbsp;|&nbsp; Source: synthetic surveillance dataset",
            styles["Normal"],
        ),
        Spacer(1, 14),
    ]
    data = [header] + rows
    table = Table(data, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]
    # colour the risk-level cell (assumed last column)
    for i, r in enumerate(rows, start=1):
        c = LEVEL_COLOR.get(r[-1])
        if c:
            style.append(("TEXTCOLOR", (len(header) - 1, i), (len(header) - 1, i), c))
    table.setStyle(TableStyle(style))
    story.append(table)
    doc.build(story)
    return buf.getvalue()


@router.get("/reports/national.pdf")
def national_pdf(db: Session = Depends(get_db)):
    districts = {d.id: d for d in db.query(District).all()}
    preds = db.query(Prediction).filter(Prediction.forecast_week == 1).all()
    rows = []
    for p in sorted(preds, key=lambda x: -x.risk_score):
        d = districts[p.district_id]
        rows.append([d.name, d.division, f"{d.population:,}", f"{p.risk_score:.2f}", p.risk_level])
    pdf = _pdf("National Dengue Risk Report — Current Week", rows,
               ["District", "Division", "Population", "Risk score", "Risk level"], db)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=prevdengue_national.pdf"})


@router.get("/reports/district/{district_id}.pdf")
def district_pdf(district_id: int, db: Session = Depends(get_db)):
    d = db.get(District, district_id)
    if not d:
        raise HTTPException(404, "District not found")
    plist = sorted(
        db.query(Prediction).filter(Prediction.district_id == district_id).all(),
        key=lambda x: x.forecast_week,
    )
    rows = [[f"Week +{p.forecast_week}", f"{p.risk_score:.2f}", p.risk_level] for p in plist]
    pdf = _pdf(f"District Risk Report — {d.name} ({d.division})", rows,
               ["Forecast horizon", "Risk score", "Risk level"], db)
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=prevdengue_{d.name}.pdf"})


@router.get("/reports/export.csv")
def export_csv(db: Session = Depends(get_db)):
    districts = {d.id: d for d in db.query(District).all()}
    preds = db.query(Prediction).order_by(Prediction.district_id, Prediction.forecast_week).all()

    def gen():
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["district", "division", "forecast_week", "risk_score", "risk_level", "model_version"])
        yield out.getvalue(); out.seek(0); out.truncate(0)
        for p in preds:
            d = districts[p.district_id]
            w.writerow([d.name, d.division, p.forecast_week, p.risk_score, p.risk_level, p.model_version])
            yield out.getvalue(); out.seek(0); out.truncate(0)

    return StreamingResponse(gen(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=prevdengue_predictions.csv"})
