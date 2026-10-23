from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user_optional
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard import DashboardPersistenceError, get_dashboard_summary, get_member_dashboard, get_public_preview_dashboard


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard(db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)) -> DashboardSummary:
    if current_user is None:
        try:
            return get_public_preview_dashboard(db)
        except DashboardPersistenceError as error:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Dashboard preview could not be loaded.") from error
    if not current_user.is_superuser:
        try:
            return get_member_dashboard(db, current_user.id)
        except DashboardPersistenceError as error:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Dashboard preview could not be loaded.") from error
    try:
        return get_dashboard_summary(db, user_id=current_user.id)
    except DashboardPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dashboard data could not be loaded. Please try again.",
        ) from error
