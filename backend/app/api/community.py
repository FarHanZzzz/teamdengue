"""Community response endpoints — wards, workers, dispatch tasks, chat."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.config import DATA_DIR
from app.db.database import get_db
from app.db.models import ChatMessage, CommunityWorker, Dispatch, District, Ward

router = APIRouter()

UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ---------- schemas ----------
class JoinRequest(BaseModel):
    ward_id: int
    name: str
    phone: str = ""
    role: str = "volunteer"


class DispatchRequest(BaseModel):
    ward_id: int
    title: str
    message: str = ""
    target_lat: float | None = None
    target_lon: float | None = None
    location_label: str = ""
    image_url: str = ""
    priority: str = "High"
    created_by: str = "Super Admin"


class DispatchUpdate(BaseModel):
    status: str
    actor: str = ""


class ChatRequest(BaseModel):
    ward_id: int
    author_name: str
    role: str = "resident"
    text: str
    kind: str = "message"


# ---------- serializers ----------
def _ward_dict(w: Ward, district_name: str = "") -> dict:
    return {
        "id": w.id, "district_id": w.district_id, "district": district_name,
        "name": w.name, "area_name": w.area_name, "lat": w.lat, "lon": w.lon,
        "population": w.population, "risk_level": w.risk_level, "risk_score": w.risk_score,
        "est_affected": w.est_affected, "breeding_sites": w.breeding_sites,
    }


def _dispatch_dict(d: Dispatch, ward: Ward | None = None) -> dict:
    return {
        "id": d.id, "ward_id": d.ward_id,
        "ward": f"{ward.name} · {ward.area_name}" if ward else "",
        "title": d.title, "message": d.message,
        "target_lat": d.target_lat, "target_lon": d.target_lon,
        "location_label": d.location_label, "image_url": d.image_url,
        "priority": d.priority, "status": d.status, "created_by": d.created_by,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "acknowledged_by": d.acknowledged_by, "completed_by": d.completed_by,
    }


# ---------- wards ----------
@router.get("/wards")
def list_wards(district_id: int | None = None, db: Session = Depends(get_db)):
    names = {d.id: d.name for d in db.query(District).all()}
    q = db.query(Ward)
    if district_id:
        q = q.filter(Ward.district_id == district_id)
    wards = q.all()
    wards.sort(key=lambda w: -w.risk_score)
    return [_ward_dict(w, names.get(w.district_id, "")) for w in wards]


@router.get("/wards/{ward_id}")
def get_ward(ward_id: int, db: Session = Depends(get_db)):
    w = db.get(Ward, ward_id)
    if not w:
        raise HTTPException(404, "Ward not found")
    d = db.get(District, w.district_id)
    out = _ward_dict(w, d.name if d else "")
    out["worker_count"] = db.query(CommunityWorker).filter(CommunityWorker.ward_id == ward_id).count()
    return out


# ---------- community workers ----------
@router.post("/community/join")
def join_community(body: JoinRequest, db: Session = Depends(get_db)):
    worker = CommunityWorker(ward_id=body.ward_id, name=body.name, phone=body.phone, role=body.role)
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return {"id": worker.id, "ward_id": worker.ward_id, "name": worker.name, "role": worker.role}


@router.get("/community/workers")
def list_workers(ward_id: int, db: Session = Depends(get_db)):
    workers = db.query(CommunityWorker).filter(CommunityWorker.ward_id == ward_id).all()
    return [{"id": w.id, "name": w.name, "role": w.role, "phone": w.phone} for w in workers]


# ---------- dispatch ----------
@router.post("/dispatch")
def create_dispatch(body: DispatchRequest, db: Session = Depends(get_db), _=Depends(require_admin)):
    ward = db.get(Ward, body.ward_id)
    if not ward:
        raise HTTPException(404, "Ward not found")
    d = Dispatch(
        ward_id=body.ward_id, title=body.title, message=body.message,
        target_lat=body.target_lat if body.target_lat is not None else ward.lat,
        target_lon=body.target_lon if body.target_lon is not None else ward.lon,
        location_label=body.location_label, image_url=body.image_url,
        priority=body.priority, created_by=body.created_by, status="pending",
    )
    db.add(d)
    # Auto-post an announcement to the ward chat so residents see it.
    db.add(ChatMessage(
        ward_id=body.ward_id, author_name=body.created_by, role="admin",
        kind="announcement",
        text=f"🚨 DISPATCH: {body.title}" + (f" — {body.location_label}" if body.location_label else ""),
    ))
    db.commit()
    db.refresh(d)
    return _dispatch_dict(d, ward)


@router.get("/dispatch")
def list_dispatch(ward_id: int | None = None, status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Dispatch)
    if ward_id:
        q = q.filter(Dispatch.ward_id == ward_id)
    if status:
        q = q.filter(Dispatch.status == status)
    items = q.order_by(Dispatch.created_at.desc()).all()
    wards = {w.id: w for w in db.query(Ward).all()}
    return [_dispatch_dict(d, wards.get(d.ward_id)) for d in items]


@router.patch("/dispatch/{dispatch_id}")
def update_dispatch(dispatch_id: int, body: DispatchUpdate, db: Session = Depends(get_db)):
    d = db.get(Dispatch, dispatch_id)
    if not d:
        raise HTTPException(404, "Dispatch not found")
    d.status = body.status
    if body.status == "acknowledged":
        d.acknowledged_by = body.actor
    elif body.status == "completed":
        d.completed_by = body.actor
        d.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(d)
    return _dispatch_dict(d, db.get(Ward, d.ward_id))


# ---------- chat ----------
@router.get("/chat")
def list_chat(ward_id: int, db: Session = Depends(get_db)):
    msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.ward_id == ward_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {"id": m.id, "author_name": m.author_name, "role": m.role, "text": m.text,
         "kind": m.kind, "created_at": m.created_at.isoformat() if m.created_at else None}
        for m in msgs
    ]


@router.post("/chat")
def post_chat(body: ChatRequest, db: Session = Depends(get_db)):
    m = ChatMessage(
        ward_id=body.ward_id, author_name=body.author_name, role=body.role,
        text=body.text, kind=body.kind,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "author_name": m.author_name, "role": m.role, "text": m.text,
            "kind": m.kind, "created_at": m.created_at.isoformat()}


# ---------- image upload (location photo) ----------
@router.post("/community/upload")
async def upload_image(file: UploadFile = File(...), _=Depends(require_admin)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        raise HTTPException(400, "Unsupported image type")
    fname = f"{uuid.uuid4().hex}.{ext}"
    (UPLOADS_DIR / fname).write_bytes(await file.read())
    return {"url": f"/uploads/{fname}"}
