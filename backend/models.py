from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, Enum, Boolean
from sqlalchemy.orm import relationship
import enum
from database import Base
from datetime import datetime

class RoleEnum(str, enum.Enum):
    admin = "admin"
    district_manager = "district_manager"
    viewer = "viewer"

class RiskEnum(str, enum.Enum):
    low = "Low"
    medium = "Medium"
    high = "High"
    critical = "Critical"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.viewer)
    is_active = Column(Boolean, default=True)
    
    # Nullable if admin, populated if district manager
    district_name = Column(String, nullable=True)

class District(Base):
    __tablename__ = "districts"
    
    name = Column(String, primary_key=True, index=True)
    population = Column(Integer, nullable=True)
    density = Column(Float, nullable=True)
    urban_pct = Column(Float, nullable=True)
    
    cases = relationship("DengueCase", back_populates="district")
    climate_records = relationship("ClimateRecord", back_populates="district")
    forecasts = relationship("Forecast", back_populates="district")

class DengueCase(Base):
    __tablename__ = "dengue_cases"

    id = Column(Integer, primary_key=True, index=True)
    district_name = Column(String, ForeignKey("districts.name"))
    week_start = Column(Date, index=True)
    cases = Column(Integer, default=0)
    deaths = Column(Integer, default=0)

    district = relationship("District", back_populates="cases")

class ClimateRecord(Base):
    __tablename__ = "climate_records"

    id = Column(Integer, primary_key=True, index=True)
    district_name = Column(String, ForeignKey("districts.name"))
    date = Column(Date, index=True)
    max_temp = Column(Float, nullable=True)
    min_temp = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    rainfall_mm = Column(Float, nullable=True)

    district = relationship("District", back_populates="climate_records")

class Forecast(Base):
    __tablename__ = "forecasts"
    
    id = Column(Integer, primary_key=True, index=True)
    district_name = Column(String, ForeignKey("districts.name"))
    forecast_date = Column(Date, index=True)
    target_week = Column(Date, index=True)
    predicted_cases = Column(Float)
    risk_level = Column(Enum(RiskEnum))
    shap_data = Column(String, nullable=True) # Stored as JSON string
    
    district = relationship("District", back_populates="forecasts")
