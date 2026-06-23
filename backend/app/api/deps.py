"""Shared API dependencies.

Production uses Supabase-issued JWTs (PRD 6.6). For the local demo we accept a
lightweight bearer token equal to the user id (e.g. `Bearer u-dghs`) so the
role-based access control flow can be exercised without an auth provider.
"""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User

ROLE_RANK = {"citizen": 0, "dho": 1, "hospital_admin": 1, "dghs_admin": 3}


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if not authorization:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    return db.get(User, token)


def require_user(user: User | None = Depends(current_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role != "dghs_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "DGHS Administrator role required")
    return user
