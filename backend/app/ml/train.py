"""Train the PrevDengue ensemble (XGBoost + LightGBM) with SHAP support.

Trains two gradient-boosted tree regressors to predict the district risk
score (0-1) over a 2-4 week horizon, evaluates them on a time-based holdout,
and persists versioned artifacts plus a metadata registry entry.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import joblib
import numpy as np
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, roc_auc_score
from xgboost import XGBRegressor

from app.core.config import MODELS_DIR, settings
from app.ml.features import FEATURE_COLUMNS, build_feature_frame

TRAIN_END_YEAR = 2021  # train on <= 2021, validate on 2022-2023


def train() -> dict:
    df = build_feature_frame(for_training=True)

    train_df = df[df["year"] <= TRAIN_END_YEAR]
    test_df = df[df["year"] > TRAIN_END_YEAR]

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df["risk_score"]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df["risk_score"]

    xgb = XGBRegressor(
        n_estimators=400, max_depth=6, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.85, min_child_weight=3,
        reg_lambda=1.5, objective="reg:squarederror", n_jobs=-1, random_state=42,
    )
    lgbm = LGBMRegressor(
        n_estimators=500, max_depth=-1, num_leaves=48, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.85, reg_lambda=1.5,
        min_child_samples=20, n_jobs=-1, random_state=42, verbosity=-1,
    )

    xgb.fit(X_train, y_train)
    lgbm.fit(X_train, y_train)

    pred_xgb = np.clip(xgb.predict(X_test), 0, 1)
    pred_lgbm = np.clip(lgbm.predict(X_test), 0, 1)
    pred_ens = (pred_xgb + pred_lgbm) / 2.0

    # Binary outbreak label (High/Critical) for AUC, per PRD success metric.
    y_bin = (y_test >= settings.threshold_high).astype(int)
    metrics = {
        "auc_xgb": _safe_auc(y_bin, pred_xgb),
        "auc_lgbm": _safe_auc(y_bin, pred_lgbm),
        "auc_ensemble": _safe_auc(y_bin, pred_ens),
        "mae_ensemble": float(mean_absolute_error(y_test, pred_ens)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }

    joblib.dump(xgb, MODELS_DIR / "xgb_model.joblib")
    joblib.dump(lgbm, MODELS_DIR / "lgbm_model.joblib")

    metadata = {
        "version_tag": datetime.now(timezone.utc).strftime("v%Y.%m.%d"),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_data_range": "2000-2021",
        "feature_set_version": "fs-1.0",
        "feature_columns": FEATURE_COLUMNS,
        "thresholds": {
            "medium": settings.threshold_medium,
            "high": settings.threshold_high,
            "critical": settings.threshold_critical,
        },
        **metrics,
    }
    (MODELS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2))

    print("Training complete.")
    print(f"  AUC  XGBoost : {metrics['auc_xgb']:.3f}")
    print(f"  AUC  LightGBM: {metrics['auc_lgbm']:.3f}")
    print(f"  AUC  Ensemble: {metrics['auc_ensemble']:.3f}")
    print(f"  MAE  Ensemble: {metrics['mae_ensemble']:.4f}")
    return metadata


def _safe_auc(y_true, y_score) -> float:
    if len(set(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_score))


if __name__ == "__main__":
    train()
