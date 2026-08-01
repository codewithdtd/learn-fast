from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard import DashboardPersistenceError, get_dashboard_summary


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardSummary:
    try:
        return get_dashboard_summary(db)
    except DashboardPersistenceError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Dashboard data could not be loaded. Please try again.",
        ) from error
