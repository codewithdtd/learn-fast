# Kế hoạch Triển khai: Tối ưu Hóa Toàn Diện Kết Nối Neon DB (PostgreSQL Serverless) Trên Render.com

## 1. Mục tiêu
Người dùng xác nhận trong môi trường production thực tế sử dụng **Neon DB (PostgreSQL)** chứ không phải SQLite cục bộ.
Kế hoạch này giải quyết triệt để các vấn đề tương thích giữa Render.com và Neon DB Serverless:
1. **Chuẩn hóa URL kết nối Neon**:
   Neon cung cấp connection string dạng `postgres://...` hoặc `postgresql://...` (kèm `sslmode=require`).
   - Trong SQLAlchemy 2.0: scheme `postgres://` gây lỗi `NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:postgres`.
   - Scheme `postgresql://` mặc định gọi driver `psycopg2` (vốn không có sẵn nếu chỉ cài `psycopg[binary]`), gây lỗi `ModuleNotFoundError: No module named 'psycopg2'`.
   - Cần cơ chế tự động chuẩn hóa mọi chuỗi kết nối PostgreSQL sang `postgresql+psycopg://` để dùng driver `psycopg 3` hiện đại.
2. **Xử lý cơ chế Autosuspend (Ngủ đông sau 5 phút) của Neon DB**:
   Neon Serverless tự động ngắt kết nối và đóng băng compute sau 5 phút không có query. Khi Render hoặc client gửi request đến, socket cũ bị ngắt (`server closed connection unexpectedly`).
   Cần cấu hình `pool_pre_ping=True`, `pool_recycle=300`, và `connect_timeout=15` trên SQLAlchemy Engine để tự động reconnect và chờ compute thức dậy an toàn.
3. **Đảm bảo Alembic Migrations hoạt động trơn tru với Neon**:
   Đảm bảo `alembic upgrade head` nhận diện đúng URL đã chuẩn hóa và tương thích 100% với Neon PostgreSQL.
4. **Cung cấp cẩm nang chi tiết cho người dùng**:
   Giải thích rõ cơ chế Neon DB Serverless, cách lấy đúng Direct URL vs Pooled URL, và cách thiết lập Environment Variable trên Render.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **`backend/app/core/config.py`**:
   - Thêm Pydantic field validator `@field_validator("database_url", mode="before")` để tự động chuẩn hóa `postgres://` và `postgresql://` thành `postgresql+psycopg://`.
2. **`backend/app/core/database.py`**:
   - Thêm `connect_args={"connect_timeout": 15}` cho PostgreSQL/Neon để đợi serverless compute thức dậy mà không bị timeout.
   - Giữ vững `pool_pre_ping=True` và `pool_recycle=300`.
3. **`backend/requirements.txt`**:
   - Bổ sung `psycopg2-binary` dự phòng song song với `psycopg[binary]` để đảm bảo tương thích 100% với bất kỳ công cụ dòng lệnh nào.
4. **Kiểm thử**:
   - Thêm unit test kiểm tra việc chuẩn hóa URL Neon trong `backend/tests/test_config.py`.
   - Chạy test suite backend để kiểm chứng không có lỗi hồi quy.
5. **Tài liệu**:
   - `plan/neon-db-render-fix.md`
   - `guide/neon-db-render-fix-guide.md`

### Ngoài phạm vi (Out of scope):
- Không sửa đổi schema cơ sở dữ liệu.

---

## 3. Các bước triển khai
- **Bước 1**: Tạo file `plan/neon-db-render-fix.md`.
- **Bước 2**: Cập nhật `backend/app/core/config.py` chuẩn hóa URL PostgreSQL sang `postgresql+psycopg://`.
- **Bước 3**: Cập nhật `backend/app/core/database.py` thêm `connect_timeout=15` cho PostgreSQL.
- **Bước 4**: Thêm `psycopg2-binary` vào `backend/requirements.txt`.
- **Bước 5**: Thêm unit test kiểm tra trong `backend/tests/test_config.py` và chạy pytest.
- **Bước 6**: Viết tài liệu hướng dẫn và báo cáo kỹ thuật trong `guide/neon-db-render-fix-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `backend/app/core/config.py`
- `[MODIFY]` `backend/app/core/database.py`
- `[MODIFY]` `backend/requirements.txt`
- `[MODIFY]` `backend/tests/test_config.py`
- `[NEW]` `plan/neon-db-render-fix.md`
- `[NEW]` `guide/neon-db-render-fix-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Cả 2 dạng chuỗi kết nối từ Neon (`postgres://...` và `postgresql://...`) đều được chuẩn hóa tự động sang `postgresql+psycopg://...`.
2. Khi chạy ứng dụng với Neon connection string, không còn gặp lỗi `NoSuchModuleError` hay `ModuleNotFoundError: No module named 'psycopg2'`.
3. Kết nối Neon có `pool_pre_ping=True`, `pool_recycle=300`, và `connect_timeout=15`.
4. Pytest test config pass 100%.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `pytest tests/test_config.py tests/test_health.py`.
- Chạy frontend tests để đảm bảo toàn bộ hệ thống hoạt động ổn định.
