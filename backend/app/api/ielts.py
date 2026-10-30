import hashlib
import hmac

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_optional
from app.core.config import settings
from app.core.database import get_db
from app.models.ielts_attempt import IELTSPracticeAttempt
from app.models.ielts_test_set import IELTSPracticeTestSet
from app.models.user import User
from app.repositories.ielts import IELTSRepository
from app.schemas.ielts import AnswersUpdate, AttemptStart, SourceCreate, TestSetCreate
from app.services.guest_ai_quota import account_trial_used
from app.services.ielts import (create_source, create_test_set, owner, public_attempt,
                                public_set, require_attempt, require_set, save_answers, create_sample,
                                submit_attempt)


router = APIRouter(prefix="/ielts", tags=["ielts-practice"])


@router.post("/sources")
def create_source_endpoint(payload: SourceCreate, request: Request, db: Session = Depends(get_db),
                           user: User | None = Depends(get_current_user_optional)) -> dict:
    return create_source(db, request, user, payload)


@router.post("/test-sets")
def create_set_endpoint(payload: TestSetCreate, request: Request, db: Session = Depends(get_db),
                        user: User | None = Depends(get_current_user_optional)) -> dict:
    return create_test_set(db, request, user, payload)


@router.post("/sample")
def create_sample_endpoint(request: Request, db: Session = Depends(get_db),
                           user: User | None = Depends(get_current_user_optional)) -> dict:
    return create_sample(db, request, user)


@router.get("/test-sets")
def list_sets(request: Request, db: Session = Depends(get_db),
              limit: int = Query(default=20, ge=1, le=50), offset: int = Query(default=0, ge=0, le=100000),
              user: User | None = Depends(get_current_user_optional)) -> dict:
    owner_id, guest_hash = owner(request, user)
    repository = IELTSRepository(db)
    repository.expire_stale_generation()
    items, total = repository.list_tests(owner_id, guest_hash, limit, offset)
    return {"items": [public_set(test, source) for test, source in items], "total": total,
            "limit": limit, "offset": offset, "has_more": offset + len(items) < total}


@router.get("/test-sets/{test_id}")
def get_set(test_id: int, request: Request, db: Session = Depends(get_db),
            user: User | None = Depends(get_current_user_optional)) -> dict:
    IELTSRepository(db).expire_stale_generation()
    test, source = require_set(db, test_id, *owner(request, user))
    return public_set(test, source)


@router.get("/test-sets/{test_id}/reading")
def get_reading_passage(test_id: int, request: Request, db: Session = Depends(get_db),
                        user: User | None = Depends(get_current_user_optional)) -> dict:
    test, source = require_set(db, test_id, *owner(request, user))
    if test.status != "ready" or not test.questions_json.get("reading"):
        raise HTTPException(status_code=404, detail="This test does not have a Reading passage.")
    source.reading_opened = True
    db.commit()
    return {"text": source.source_text, "segments": source.segments_json if source.source_type == "video" else []}


@router.delete("/test-sets/{test_id}", status_code=204)
def delete_set(test_id: int, request: Request, db: Session = Depends(get_db),
               user: User | None = Depends(get_current_user_optional)) -> Response:
    test, source = require_set(db, test_id, *owner(request, user))
    db.delete(test)
    db.flush()
    remaining = db.scalar(select(func.count()).select_from(IELTSPracticeTestSet).where(IELTSPracticeTestSet.source_id == source.id))
    if not remaining:
        db.delete(source)
    db.commit()
    return Response(status_code=204)


@router.post("/test-sets/{test_id}/attempts")
def start_attempt(test_id: int, payload: AttemptStart, request: Request, db: Session = Depends(get_db),
                  user: User | None = Depends(get_current_user_optional)) -> dict:
    owner_id, guest_hash = owner(request, user)
    test, source = require_set(db, test_id, owner_id, guest_hash)
    if test.status != "ready" or not test.questions_json.get(payload.skill):
        raise HTTPException(status_code=409, detail="This skill is not ready in this test.")
    attempt = IELTSPracticeAttempt(test_set_id=test.id, user_id=owner_id, guest_key_hash=guest_hash,
                                   skill=payload.skill, answers_json={})
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return public_attempt(attempt, test, source)


@router.get("/attempts")
def list_attempts(request: Request, db: Session = Depends(get_db),
                  limit: int = Query(default=20, ge=1, le=50), offset: int = Query(default=0, ge=0, le=100000),
                  user: User | None = Depends(get_current_user_optional)) -> dict:
    owner_id, guest_hash = owner(request, user)
    items = []
    attempts, total = IELTSRepository(db).list_attempts(owner_id, guest_hash, limit, offset)
    for attempt in attempts:
        result = require_set(db, attempt.test_set_id, owner_id, guest_hash)
        items.append(public_attempt(attempt, *result))
    return {"items": items, "total": total, "limit": limit, "offset": offset,
            "has_more": offset + len(items) < total}


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: int, request: Request, db: Session = Depends(get_db),
                user: User | None = Depends(get_current_user_optional)) -> dict:
    return public_attempt(*require_attempt(db, attempt_id, *owner(request, user)))


@router.patch("/attempts/{attempt_id}/answers")
def patch_answers(attempt_id: int, payload: AnswersUpdate, request: Request, db: Session = Depends(get_db),
                  user: User | None = Depends(get_current_user_optional)) -> dict:
    attempt, test, source = require_attempt(db, attempt_id, *owner(request, user))
    save_answers(db, attempt, test, payload)
    db.refresh(attempt)
    return public_attempt(attempt, test, source)


@router.post("/attempts/{attempt_id}/submit")
def submit(attempt_id: int, request: Request, db: Session = Depends(get_db),
           user: User | None = Depends(get_current_user_optional)) -> dict:
    attempt, test, source = require_attempt(db, attempt_id, *owner(request, user))
    submit_attempt(db, attempt, test)
    db.refresh(attempt)
    return public_attempt(attempt, test, source)


@router.get("/usage")
def usage(request: Request, db: Session = Depends(get_db),
          user: User | None = Depends(get_current_user_optional)) -> dict:
    if user and user.is_superuser:
        return {"unlimited": True, "generation_used": False, "transcript_used": False}
    from app.repositories.guest_ai_usage import GuestAIUsageRepository
    if user:
        used = lambda feature: account_trial_used(db, user, feature, request)
    else:
        guest_hash = owner(request, user)[1]
        client_host = request.client.host if request.client else "unknown"
        ip_hash = hmac.new(settings.secret_key.encode(), f"guest-ip:{client_host}".encode(), hashlib.sha256).hexdigest()
        repository = GuestAIUsageRepository(db)
        used = lambda feature: repository.has_claim(guest_hash, feature) or repository.has_claim(ip_hash, feature)
    return {"unlimited": False, "generation_used": used("ielts_test_generation"),
            "transcript_used": used("video_transcript")}
