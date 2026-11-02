from pydantic import BaseModel, Field


class StorageCleanupStats(BaseModel):
    """Thống kê chi tiết các bản ghi rác / dữ liệu thừa trong cơ sở dữ liệu."""
    read_notifications: int = Field(description="Số lượng thông báo đã đọc có thể xóa ngay")
    stale_unread_notifications: int = Field(description="Số lượng thông báo chưa đọc quá cũ (>30 ngày)")
    guest_study_sessions: int = Field(description="Số lượng phiên học của khách vãng lai (>7 ngày)")
    abandoned_study_sessions: int = Field(description="Số lượng phiên học active bị bỏ dở (>14 ngày)")
    guest_ai_usage_records: int = Field(description="Số lượng bản ghi tracking dùng thử AI của guest (>14 ngày)")
    guest_ielts_records: int = Field(description="Số lượng dữ liệu bài đọc IELTS của guest (>7 ngày)")
    empty_writing_drafts: int = Field(description="Số lượng bản nháp viết trống (>7 ngày)")
    total_cleanable_records: int = Field(description="Tổng số lượng bản ghi có thể dọn dẹp để giải phóng dung lượng Neon")


class StorageCleanupRequest(BaseModel):
    """Cấu hình các hạng mục dọn dẹp dữ liệu thừa để tiết kiệm bộ nhớ Neon PostgreSQL."""
    clear_read_notifications: bool = Field(default=True, description="Xóa toàn bộ thông báo đã đọc")
    clear_stale_notifications: bool = Field(default=True, description="Xóa thông báo chưa đọc đã quá cũ")
    stale_notifications_days: int = Field(default=30, ge=7, le=180, description="Ngưỡng ngày để coi thông báo chưa đọc là cũ")

    clear_guest_sessions: bool = Field(default=True, description="Xóa phiên học khách vãng lai và các bảng phụ thuộc")
    guest_sessions_days: int = Field(default=7, ge=1, le=90, description="Ngưỡng ngày lưu trữ phiên học của khách")

    clear_abandoned_sessions: bool = Field(default=True, description="Xóa các phiên học bị bỏ dở không hoàn thành")
    abandoned_sessions_days: int = Field(default=14, ge=3, le=90, description="Ngưỡng ngày lưu trữ phiên học bỏ dở")

    clear_guest_ai_usage: bool = Field(default=True, description="Xóa bản ghi lịch sử quota guest AI")
    guest_ai_usage_days: int = Field(default=14, ge=7, le=90, description="Ngưỡng ngày lưu trữ lịch sử guest AI")

    clear_guest_ielts: bool = Field(default=True, description="Xóa dữ liệu nguồn đọc IELTS của khách vãng lai")
    guest_ielts_days: int = Field(default=7, ge=1, le=90, description="Ngưỡng ngày lưu trữ IELTS guest")

    clear_empty_drafts: bool = Field(default=True, description="Xóa bản nháp bài viết trống không có nội dung")
    empty_drafts_days: int = Field(default=7, ge=1, le=60, description="Ngưỡng ngày bản nháp bài viết trống")


class StorageCleanupResponse(BaseModel):
    """Kết quả chi tiết sau khi thực hiện dọn dẹp bộ nhớ."""
    success: bool
    deleted_counts: dict[str, int] = Field(description="Chi tiết số bản ghi đã xóa theo từng bảng / phân loại")
    total_deleted: int = Field(description="Tổng số bản ghi đã được giải phóng")
    message: str = Field(description="Thông điệp tóm tắt kết quả dọn dẹp")
