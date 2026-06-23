"""Authentication endpoints (demo).

Production uses Supabase Auth + JWT (PRD 6.6). Locally we expose a simple
email-based login over the seeded demo accounts and return a bearer token
equal to the user id.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_user
from app.db.database import get_db
from app.db.models import District, User

router = APIRouter()


class LoginRequest(BaseModel):
    email: str


def _user_dict(u: User, db: Session) -> dict:
    district = db.get(District, u.district_id) if u.district_id else None
    return {
        "id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role,
        "district_id": u.district_id,
        "district_name": district.name if district else None,
        "token": u.id,
    }


@router.post("/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user:
        raise HTTPException(401, "Unknown account. Try a demo account.")
    return _user_dict(user, db)


@router.get("/auth/me")
def me(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return _user_dict(user, db)


@router.get("/auth/demo-accounts")
def demo_accounts(db: Session = Depends(get_db)):
    return [
        {"email": u.email, "role": u.role, "full_name": u.full_name}
        for u in db.query(User).order_by(User.role).all()
    ]
