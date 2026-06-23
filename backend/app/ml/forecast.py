"""Forecast generation + SHAP explainability (PRD 6.1.3 / 6.1.4).

Loads the trained ensemble, produces 4-week district risk trajectories for
all 64 districts, and computes per-district SHAP attributions so health
officials can see *why* a district's risk is elevated.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
import shap

from app.core.config import MODELS_DIR, settings
from app.ml.features import (
    FEATURE_COLUMNS,
    FEATURE_LABELS,
    build_feature_frame,
    classify,
    latest_feature_rows,
)


@lru_cache(maxsize=1)
def load_models():
    xgb = joblib.load(MODELS_DIR / "xgb_model.joblib")
    lgbm = joblib.load(MODELS_DIR / "lgbm_model.joblib")
    metadata = json.loads((MODELS_DIR / "metadata.json").read_text())
    expl_xgb = shap.TreeExplainer(xgb)
    expl_lgbm = shap.TreeExplainer(lgbm)
    return xgb, lgbm, metadata, expl_xgb, expl_lgbm


def _ensemble_predict(xgb, lgbm, X: pd.DataFrame) -> np.ndarray:
    p = (xgb.predict(X) + lgbm.predict(X)) / 2.0
    return np.clip(p, 0.0, 1.0)


def _levels():
    return (settings.threshold_medium, settings.threshold_high, settings.threshold_critical)


def _shap_top(expl_xgb, expl_lgbm, row: pd.DataFrame, k: int = 5) -> list[dict]:
    sv = (expl_xgb.shap_values(row) + expl_lgbm.shap_values(row)) / 2.0
    sv = np.asarray(sv).reshape(-1)
    order = np.argsort(-np.abs(sv))[:k]
    out = []
    for i in order:
        feat = FEATURE_COLUMNS[i]
        out.append({
            "feature": feat,
            "label": FEATURE_LABELS.get(feat, feat),
            "value": round(float(sv[i]), 4),
            "feature_value": round(float(row.iloc[0][feat]), 2),
        })
    return out


def generate_forecast() -> dict:
    """Produce the live forecast bundle for all districts."""
    xgb, lgbm, metadata, expl_xgb, expl_lgbm = load_models()
    t_med, t_high, t_crit = _levels()

    latest = latest_feature_rows()
    horizon = settings.forecast_horizon_weeks

    districts_out = []
    for _, r in latest.iterrows():
        base = r[FEATURE_COLUMNS].to_frame().T.astype(float)

        # 4-week trajectory: step the seasonal week index forward.
        trajectory = []
        cur_woy = int(r["week_of_year"])
        for k in range(1, horizon + 1):
            feat = base.copy()
            woy = ((cur_woy + k - 1) % 52) + 1
            feat["week_of_year"] = woy
            score = float(_ensemble_predict(xgb, lgbm, feat[FEATURE_COLUMNS])[0])
            trajectory.append({
                "week": k,
                "risk_score": round(score, 4),
                "risk_level": classify(score, t_med, t_high, t_crit),
            })

        current_score = trajectory[0]["risk_score"]
        current_level = trajectory[0]["risk_level"]
        shap_top = _shap_top(expl_xgb, expl_lgbm, base[FEATURE_COLUMNS])

        districts_out.append({
            "district_id": int(r["district_id"]),
            "name": r["name"],
            "division": r["division"],
            "week_of_year": cur_woy,
            "year": int(r["year"]),
            "risk_score": current_score,
            "risk_level": current_level,
            "trajectory": trajectory,
            "shap": shap_top,
            "cases_t1": int(r["cases_t1"]),
            "cases_4wk_avg": round(float(r["cases_4wk_avg"]), 1),
            "mean_temp": round(float(r["mean_temp_t1"]), 1),
            "mean_humidity": round(float(r["mean_humidity"]), 1),
            "rainfall_4wk": round(float(r["rainfall_4wk_rolling"]), 1),
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": metadata.get("version_tag", "v0"),
        "horizon_weeks": horizon,
        "thresholds": {"medium": t_med, "high": t_high, "critical": t_crit},
        "districts": districts_out,
    }


def predicted_history(district_id: int) -> list[dict]:
    """Actual cases + actual & predicted risk score over time for one district."""
    xgb, lgbm, _, _, _ = load_models()
    df = build_feature_frame(for_training=True)
    d = df[df["district_id"] == district_id].sort_values("week_start")
    if d.empty:
        return []
    preds = _ensemble_predict(xgb, lgbm, d[FEATURE_COLUMNS])
    out = []
    for (_, row), p in zip(d.iterrows(), preds):
        out.append({
            "week_start": row["week_start"].strftime("%Y-%m-%d"),
            "year": int(row["year"]),
            "confirmed_cases": int(row["confirmed_cases"]),
            "actual_risk": round(float(row["risk_score"]), 4),
            "predicted_risk": round(float(p), 4),
        })
    return out


if __name__ == "__main__":
    fc = generate_forecast()
    levels = {}
    for d in fc["districts"]:
        levels[d["risk_level"]] = levels.get(d["risk_level"], 0) + 1
    print("Forecast generated for", len(fc["districts"]), "districts")
    print("Level distribution:", levels)
    top = sorted(fc["districts"], key=lambda x: -x["risk_score"])[:5]
    for d in top:
        print(f"  {d['name']:14s} {d['risk_level']:9s} {d['risk_score']:.3f}")
