from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.database import get_db
from app.models import User
from app.schemas.maintenance import (
    StorageCleanupRequest,
    StorageCleanupResponse,
    StorageCleanupStats,
)
from app.services.maintenance import (
    MaintenanceExecutionError,
    execute_storage_cleanup,
    get_storage_cleanup_stats,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("/storage-stats", response_model=StorageCleanupStats)
def get_storage_stats(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> StorageCleanupStats:
    """
    Lấy thông tin thống kê các bản ghi rác và dữ liệu thừa trong cơ sở dữ liệu Neon.
    Yêu cầu quyền Administrator.
    """
    try:
        return get_storage_cleanup_stats(db)
    except MaintenanceExecutionError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve database storage stats.",
        ) from error


@router.post("/cleanup", response_model=StorageCleanupResponse)
def run_storage_cleanup(
    request: StorageCleanupRequest = StorageCleanupRequest(),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin),
) -> StorageCleanupResponse:
    """
    Thực hiện dọn dẹp các bản ghi rác và dữ liệu thừa theo cấu hình được cung cấp.
    Giúp giải phóng dung lượng trên gói miễn phí Neon PostgreSQL (giới hạn 0.5 GB).
    Yêu cầu quyền Administrator.
    """
    try:
        return execute_storage_cleanup(db, request)
    except MaintenanceExecutionError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not execute database storage cleanup.",
        ) from error
