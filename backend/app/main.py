"""PrevDengue FastAPI application entrypoint.

Exposes the versioned REST API consumed by the Next.js dashboard and citizen
portal (PRD 6.7 / 9). Auto-generated docs at /docs and /redoc.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agent, alerts, auth, public, reports
from app.core.config import settings
from app.db.database import Base, engine

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="ML-powered dengue outbreak prediction & early warning system for Bangladesh.",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Allow localhost (any port) and any Vercel preview/production deployment.
    allow_origin_regex=r"https?://(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|.*\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"service": settings.app_name, "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


prefix = settings.api_v1_prefix
app.include_router(public.router, prefix=prefix, tags=["public"])
app.include_router(auth.router, prefix=prefix, tags=["auth"])
app.include_router(alerts.router, prefix=prefix, tags=["alerts"])
app.include_router(admin.router, prefix=prefix, tags=["admin"])
app.include_router(agent.router, prefix=prefix, tags=["agent"])
app.include_router(reports.router, prefix=prefix, tags=["reports"])
