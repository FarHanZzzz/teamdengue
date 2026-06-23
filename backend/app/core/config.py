"""Application configuration.

In production these values map onto the PRD's recommended services
(Supabase, Resend, Twilio, Sentry). For local development everything runs
against SQLite with simulated alert delivery so no external accounts are
required.
"""
from __future__ import annotations

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
MODELS_DIR = BACKEND_DIR / "models"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PrevDengue API"
    api_v1_prefix: str = "/api/v1"

    # Database (swap DATABASE_URL to a Supabase/Postgres DSN in production)
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'prevdengue.db').as_posix()}"

    # CORS: the Next.js dev server + production domain
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("cors_origins", "openrouter_models", "gemini_models", mode="before")
    @classmethod
    def _split_list(cls, v):
        # Accept either a JSON list or a comma-separated string from the env.
        if isinstance(v, str) and not v.strip().startswith("["):
            items = [o.strip() for o in v.split(",") if o.strip()]
            return items or None
        return v

    # Risk classification thresholds (configurable by DGHS Admin per PRD 6.2)
    threshold_medium: float = 0.26
    threshold_high: float = 0.51
    threshold_critical: float = 0.76

    # LLM (OpenRouter). When set, the agent + assistant use real models with a
    # free open-source fallback chain; otherwise a deterministic engine is used.
    openrouter_api_key: str | None = None
    openrouter_referer: str = "https://prevdengue.vercel.app"
    openrouter_models: list[str] | None = None

    # Gemini — backup provider used when OpenRouter is exhausted (token/rate limit).
    gemini_api_key: str | None = None
    gemini_models: list[str] | None = None

    # Alert delivery (simulated locally; real keys enable Resend/Twilio)
    resend_api_key: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    simulate_alerts: bool = True

    forecast_horizon_weeks: int = 4


settings = Settings()

MODELS_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)
