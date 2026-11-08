# Kế hoạch Triển khai: Khắc phục Triệt để Lỗi Máy chủ Render (Cold Start, Health Check 404, Stale DB Pool)

## 1. Mục tiêu
Giải quyết toàn diện vấn đề máy chủ Backend Render (Render.com) bị lỗi, không tự khởi động được, phải vào dashboard khởi động bằng tay dù Render vẫn hiển thị trạng thái "Live":
- Bổ sung root endpoint `GET /` và `GET /health` trả về HTTP 200 `{"status": "ok"}` trực tiếp trên FastAPI để vượt qua mọi cấu hình Health Check của Render (vốn mặc định gọi vào `/` hoặc `/health` thay vì `/api/v1/health`).
- Cấu hình SQLAlchemy Connection Pool chống chết kết nối (`pool_pre_ping=True`, `pool_recycle=300`) khi kết nối PostgreSQL bị Render đóng nhàn rỗi trong lúc ngủ đông.
- Đảm bảo cấu hình backend tự động nhận diện biến môi trường `PORT` do Render cấp phát động (tránh lỗi lệch cổng).
- Cung cấp cẩm nang chi tiết hướng dẫn thiết lập UptimeRobot / Cron ping giữ máy chủ luôn thức (không bị ngủ đông 15 phút), cùng hướng dẫn kiểm tra cấu hình Start Command & RAM trên Render.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **`backend/app/main.py`**:
   - Thêm route `GET /` và `GET /health` trả về `{"status": "ok", "service": "learn-fast-api"}` song song với route hiện có `/api/v1/health`.
2. **`backend/app/core/database.py`**:
   - Thêm `pool_pre_ping=True` và `pool_recycle=300` cho SQLAlchemy engine khi kết nối tới cơ sở dữ liệu cloud (PostgreSQL) để tự động reconnect sau cold start.
3. **`backend/app/core/config.py`**:
   - Nhận diện linh hoạt biến môi trường `PORT` của Render làm giá trị mặc định cho `api_port`.
4. **Kiểm thử & Báo cáo**:
   - Chạy bộ kiểm thử backend với pytest.
   - Viết cẩm nang hướng dẫn trong `guide/render-server-cold-start-and-health-guide.md` giải thích cặn kẽ 5 nguyên nhân gốc rễ và từng bước cấu hình trên Render.com + UptimeRobot.

### Ngoài phạm vi (Out of scope):
- Không thay đổi schema cơ sở dữ liệu hay logic nghiệp vụ flashcards/writing/reading.

---

## 3. Các bước triển khai
- **Bước 1**: Cập nhật `backend/app/core/database.py` bổ sung `pool_pre_ping=True` và `pool_recycle=300`.
- **Bước 2**: Cập nhật `backend/app/main.py` thêm `GET /` và `GET /health`.
- **Bước 3**: Cập nhật `backend/app/core/config.py` đọc biến môi trường `PORT` nếu có.
- **Bước 4**: Chạy kiểm thử pytest backend.
- **Bước 5**: Viết tài liệu báo cáo và cẩm nang hướng dẫn người dùng trong `guide/render-server-cold-start-and-health-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `backend/app/core/database.py`
- `[MODIFY]` `backend/app/main.py`
- `[MODIFY]` `backend/app/core/config.py`
- `[NEW]` `plan/render-server-cold-start-and-health-fix.md`
- `[NEW]` `guide/render-server-cold-start-and-health-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. `GET /` và `GET /health` trả về HTTP 200 OK.
2. `GET /api/v1/health` tiếp tục hoạt động bình thường.
3. SQLAlchemy engine có `pool_pre_ping=True` cho PostgreSQL.
4. Toàn bộ tests của backend pass 100%.
5. Cung cấp hướng dẫn chi tiết cách cấu hình Render Dashboard và giải pháp UptimeRobot chống ngủ đông.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `pytest backend/tests` (hoặc lệnh pytest môi trường ảo của backend).
- Test endpoint `GET /` và `GET /health` qua testclient hoặc curl.

---

## 7. Rủi ro & Edge cases
- **Cấu hình SQLite cục bộ**: `pool_pre_ping` chỉ nên áp dụng hoặc hoạt động an toàn với SQLite/PostgreSQL mà không gây lỗi tham số `create_engine`.
