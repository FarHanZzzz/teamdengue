"""Agentic AI endpoints — autonomous response planning & dispatch."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import current_user, require_admin
from app.db.database import get_db
from app.services.agent import (
    answer_question,
    citizen_brief,
    execute_plan,
    generate_action_plan,
)

router = APIRouter()


class ExecuteRequest(BaseModel):
    district_ids: list[int] | None = None


class AskRequest(BaseModel):
    question: str


class CitizenRequest(BaseModel):
    district: str
    symptoms: list[str] | None = None
    language: str = "en"


@router.get("/agent/plan")
def agent_plan(db: Session = Depends(get_db), _=Depends(current_user)):
    """Run the agent's reasoning loop and return the intervention plan."""
    return generate_action_plan(db)


@router.post("/agent/execute")
def agent_execute(body: ExecuteRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    """Authorise the agent to dispatch advisories to DHOs + hospitals."""
    return execute_plan(db, body.district_ids)


@router.post("/agent/ask")
def agent_ask(body: AskRequest, db: Session = Depends(get_db), _=Depends(current_user)):
    """Grounded Q&A over the live forecast."""
    return answer_question(db, body.question)


@router.post("/agent/citizen")
def agent_citizen(body: CitizenRequest, db: Session = Depends(get_db)):
    """Plain-language, personalised brief for a citizen (no auth required)."""
    return citizen_brief(db, body.district, body.symptoms, body.language)
