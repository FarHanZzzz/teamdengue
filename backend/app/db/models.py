"""ORM models mirroring the PRD database schema (section 10).

Implemented for SQLite locally; portable to Supabase/PostgreSQL. PostGIS
geometry is represented here as stored GeoJSON text (the production schema
would use a PostGIS `geometry` column).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), index=True)
    name_bn: Mapped[str] = mapped_column(String(120))
    division: Mapped[str] = mapped_column(String(40), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    area_sqkm: Mapped[float] = mapped_column(Float)
    population: Mapped[int] = mapped_column(Integer)
    pop_density: Mapped[float] = mapped_column(Float)
    urban_proportion: Mapped[float] = mapped_column(Float)
    agri_land_pct: Mapped[float] = mapped_column(Float)
    is_metro: Mapped[bool] = mapped_column(Boolean, default=False)

    predictions: Mapped[list["Prediction"]] = relationship(back_populates="district")


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    forecast_week: Mapped[int] = mapped_column(Integer)  # 1..4 weeks ahead (0 = current)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(12), index=True)
    shap_values: Mapped[dict] = mapped_column(JSON, default=dict)
    model_version: Mapped[str] = mapped_column(String(32))

    district: Mapped["District"] = relationship(back_populates="predictions")


class Hospital(Base):
    __tablename__ = "hospitals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    type: Mapped[str] = mapped_column(String(60))
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    beds: Mapped[int] = mapped_column(Integer)
    dengue_beds: Mapped[int] = mapped_column(Integer)
    phone: Mapped[str] = mapped_column(String(24))
    email: Mapped[str] = mapped_column(String(120))
    dist_from_center_km: Mapped[float] = mapped_column(Float)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    alert_type: Mapped[str] = mapped_column(String(40))  # escalation / weekly / manual
    risk_level: Mapped[str] = mapped_column(String(12))
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    channel: Mapped[str] = mapped_column(String(16))  # email / sms / in-app
    recipient: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/sent/failed/delivered
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default="")
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(24), index=True)  # citizen/dho/hospital_admin/dghs_admin
    district_id: Mapped[int | None] = mapped_column(ForeignKey("districts.id"), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(24), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class AlertRecipient(Base):
    __tablename__ = "alert_recipients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district_id: Mapped[int] = mapped_column(ForeignKey("districts.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(24), nullable=True)
    active_channels: Mapped[list] = mapped_column(JSON, default=list)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version_tag: Mapped[str] = mapped_column(String(32), index=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    training_data_range: Mapped[str] = mapped_column(String(32))
    auc_xgb: Mapped[float] = mapped_column(Float)
    auc_lgbm: Mapped[float] = mapped_column(Float)
    auc_ensemble: Mapped[float] = mapped_column(Float)
    feature_set_version: Mapped[str] = mapped_column(String(16))
    artifact_path: Mapped[str] = mapped_column(String(255))


class UploadedDataset(Base):
    __tablename__ = "uploaded_datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    uploaded_by: Mapped[str] = mapped_column(String(120))
    filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(255))
    dataset_type: Mapped[str] = mapped_column(String(40))  # surveillance / climate
    upload_date: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    processing_status: Mapped[str] = mapped_column(String(16), default="pending")
    row_count: Mapped[int] = mapped_column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[str] = mapped_column(Text, default="")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
