"""Feature engineering for the PrevDengue prediction engine (PRD 6.1.2).

Builds the multivariate feature matrix from raw climate, demographic, land-use
and historical case data. The same transformations are used at training time
and at inference (weekly forecast) time to avoid train/serve skew.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.core.config import RAW_DIR

# Order is significant: SHAP attributions are aligned to this list.
FEATURE_COLUMNS: list[str] = [
    "mean_temp_t1",        # mean temperature, 1-week lag
    "mean_temp_t2",        # mean temperature, 2-week lag
    "mean_humidity",       # weekly mean relative humidity
    "humidity_flag",       # 1 if mean humidity > 70%
    "total_rainfall",      # total weekly rainfall (mm)
    "rainfall_4wk_rolling",# 4-week cumulative rolling rainfall
    "pop_density",         # population per sq km
    "urban_proportion",    # % population urban
    "agri_land_pct",       # % area agricultural
    "cases_t1",            # confirmed cases, 1-week lag
    "cases_t2",            # confirmed cases, 2-week lag
    "cases_4wk_avg",       # 4-week rolling average of cases
    "week_of_year",        # ISO week (seasonality)
    "year",                # secular trend
]

# Human-readable labels for SHAP charts on the frontend.
FEATURE_LABELS: dict[str, str] = {
    "mean_temp_t1": "Temperature (1-wk lag)",
    "mean_temp_t2": "Temperature (2-wk lag)",
    "mean_humidity": "Mean humidity",
    "humidity_flag": "High-humidity flag",
    "total_rainfall": "Weekly rainfall",
    "rainfall_4wk_rolling": "4-week rolling rainfall",
    "pop_density": "Population density",
    "urban_proportion": "Urban proportion",
    "agri_land_pct": "Agricultural land",
    "cases_t1": "Cases (1-wk lag)",
    "cases_t2": "Cases (2-wk lag)",
    "cases_4wk_avg": "Cases (4-wk avg)",
    "week_of_year": "Week of year",
    "year": "Year",
}

# Forward window that defines the prediction target (PRD: 2-4 week horizon).
TARGET_HORIZON = 4
# Logistic squashing constants mapping forward incidence -> risk score (0-1).
# Calibrated so the four-tier risk distribution is well spread.
_RISK_CENTER = 9.0   # cases / 100k over next 4 weeks
_RISK_SCALE = 6.0


def load_raw() -> pd.DataFrame:
    districts = pd.read_csv(RAW_DIR / "districts.csv")
    climate = pd.read_csv(RAW_DIR / "climate_weekly.csv")
    cases = pd.read_csv(RAW_DIR / "dengue_weekly.csv")

    cases = cases.rename(columns={"report_week": "week_start"})
    df = climate.merge(
        cases[["district_id", "week_start", "confirmed_cases", "deaths", "hospitalized"]],
        on=["district_id", "week_start"],
        how="inner",
    )
    df = df.merge(
        districts[["id", "name", "division", "population", "pop_density",
                   "urban_proportion", "agri_land_pct"]],
        left_on="district_id", right_on="id", how="left",
    )
    df["week_start"] = pd.to_datetime(df["week_start"])
    df = df.sort_values(["district_id", "week_start"]).reset_index(drop=True)
    return df


def build_feature_frame(for_training: bool = True) -> pd.DataFrame:
    """Return a dataframe with FEATURE_COLUMNS (+ metadata, + target if training)."""
    df = load_raw()
    df = df.sort_values(["district_id", "week_start"]).reset_index(drop=True)
    g = df.groupby("district_id", sort=False)

    df["mean_temp_t1"] = g["mean_temp"].shift(1)
    df["mean_temp_t2"] = g["mean_temp"].shift(2)
    df["humidity_flag"] = (df["mean_humidity"] > 70).astype(int)
    df["rainfall_4wk_rolling"] = (
        g["total_rainfall"].rolling(4, min_periods=1).sum().reset_index(level=0, drop=True)
    )
    df["cases_t1"] = g["confirmed_cases"].shift(1)
    df["cases_t2"] = g["confirmed_cases"].shift(2)
    cases_lag1 = g["confirmed_cases"].shift(1)
    df["cases_4wk_avg"] = (
        cases_lag1.groupby(df["district_id"], sort=False)
        .rolling(4, min_periods=1).mean().reset_index(level=0, drop=True)
    )
    df["fwd_cases"] = sum(
        g["confirmed_cases"].shift(-k) for k in range(1, TARGET_HORIZON + 1)
    )

    if for_training:
        df["incidence_fwd"] = df["fwd_cases"] / df["population"] * 100_000
        df["risk_score"] = 1.0 / (
            1.0 + np.exp(-(df["incidence_fwd"] - _RISK_CENTER) / _RISK_SCALE)
        )

    df = df.dropna(subset=FEATURE_COLUMNS)
    if for_training:
        df = df.dropna(subset=["risk_score"])
    return df.reset_index(drop=True)


def reference_week(df: pd.DataFrame) -> pd.Timestamp:
    """The 'current' week used for the live forecast snapshot.

    We anchor to the national peak week of the most recent season so the
    dashboard reflects an outbreak in progress (the full Low->Critical
    spread) rather than the calendar's off-season tail.
    """
    last_year = int(df["year"].max())
    season = df[df["year"] == last_year]
    weekly = season.groupby("week_start")["confirmed_cases"].sum()
    return weekly.idxmax()


def latest_feature_rows() -> pd.DataFrame:
    """One feature row per district at the live-forecast reference week."""
    df = build_feature_frame(for_training=False)
    ref = reference_week(df)
    snap = df[df["week_start"] == ref]
    return snap.reset_index(drop=True)


def classify(score: float, t_med: float, t_high: float, t_crit: float) -> str:
    if score >= t_crit:
        return "Critical"
    if score >= t_high:
        return "High"
    if score >= t_med:
        return "Medium"
    return "Low"
