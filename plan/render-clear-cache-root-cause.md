# Kế hoạch Triển khai: Khắc phục Triệt để Lỗi Render Phải Dùng "Clear build cache & redeploy"

## 1. Mục tiêu
Giải quyết triệt để vấn đề:
- Người dùng phản ánh máy chủ Render báo "Live" nhưng thực tế không khởi động được, thường xuyên lỗi và chỉ khi dùng tính năng **"Clear build cache & redeploy"** thì server mới hoạt động trở lại.
- Xác định và xử lý tận gốc 3 nguyên nhân:
  1. File cơ sở dữ liệu `backend/data/app.db` bị commit và track trong Git. Khi chạy trên Render, app ghi vào file này làm bẩn working tree. Lần deploy tiếp theo (dùng cache), lệnh `git pull` / checkout bị conflict ("Your local changes to the following files would be overwritten by merge: backend/data/app.db") dẫn tới crash quá trình build. Chỉ khi bấm "Clear build cache & deploy", Render xóa sạch container và clone mới thì mới chạy được.
  2. Dependencies build cache xung đột: `passlib[bcrypt]` xung đột với thư viện `bcrypt` hiện đại trong pip wheel cache.
  3. Thiếu cơ chế tự động tạo thư mục `./data` cho SQLite khi deploy sạch không có database file.
  4. Cập nhật `backend/tests/test_admin_access.py` công nhận `GET /` và `GET /health` là public endpoints để toàn bộ test suite pass 100%.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **Git Tracking & .gitignore**:
   - Bỏ theo dõi file `backend/data/app.db` khỏi git index bằng lệnh `git rm --cached`.
   - Cập nhật `.gitignore` chặn toàn bộ file `.db`, `.sqlite`, `.db-wal`, `.db-shm`.
2. **Backend Code**:
   - `backend/app/core/database.py`: Bổ sung cơ chế tự động tạo thư mục cha của SQLite database URL nếu chưa tồn tại.
   - `backend/requirements.txt`: Loại bỏ `passlib[bcrypt]` không còn sử dụng để tránh conflict resolution trong pip cache.
   - `backend/tests/test_admin_access.py`: Bổ sung `("GET", "/")` và `("GET", "/health")` vào danh sách endpoint công khai (health checks).
3. **Tài liệu Hướng dẫn & Báo cáo**:
   - `guide/render-clear-cache-root-cause-guide.md`: Hướng dẫn chi tiết giải thích cho người dùng lý do tại sao Clear Cache mới chạy, cách cài đặt Build Command / Start Command chuẩn trên Render, và giải pháp giữ server không bị ngủ đông.

### Ngoài phạm vi (Out of scope):
- Không thay đổi schema dữ liệu hay các tính năng SRS/Flashcards.

---

## 3. Các bước triển khai
- **Bước 1**: Tạo file `plan/render-clear-cache-root-cause.md`.
- **Bước 2**: Chỉnh sửa `backend/tests/test_admin_access.py` thêm `("GET", "/")` và `("GET", "/health")` vào `IDENTITY_ENDPOINTS`.
- **Bước 3**: Cập nhật `backend/app/core/database.py` để tự động tạo directory cha khi dùng SQLite.
- **Bước 4**: Cập nhật `backend/requirements.txt` loại bỏ package thừa `passlib[bcrypt]`.
- **Bước 5**: Cập nhật `.gitignore` và chạy `git rm --cached backend/data/app.db`.
- **Bước 6**: Chạy toàn bộ pytest backend để kiểm chứng 100% test pass.
- **Bước 7**: Viết tài liệu cẩm nang `guide/render-clear-cache-root-cause-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `backend/tests/test_admin_access.py`
- `[MODIFY]` `backend/app/core/database.py`
- `[MODIFY]` `backend/requirements.txt`
- `[MODIFY]` `.gitignore`
- `[UNTRACK]` `backend/data/app.db`
- `[NEW]` `plan/render-clear-cache-root-cause.md`
- `[NEW]` `guide/render-clear-cache-root-cause-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. `backend/data/app.db` không còn nằm trong git tracking index (`git ls-files backend/data/app.db` trả về rỗng).
2. `.gitignore` ngăn chặn không để file DB bị commit trở lại.
3. Khi khởi động với SQLite mới, app tự tạo thư mục data mà không báo lỗi `unable to open database file`.
4. Pytest chạy thành công 100% bao gồm cả `test_admin_access.py` và `test_health.py`.
5. Cung cấp giải thích cặn kẽ và các bước cấu hình Render Dashboard cho người dùng.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- `pytest tests/test_admin_access.py tests/test_health.py`
- Chạy toàn bộ pytest backend.
- Chạy frontend tests (`node --test frontend/tests/*.test.mjs`).

---

## 7. Rủi ro & Edge cases
- Xóa `backend/data/app.db` khỏi git bằng `--cached` đảm bảo không làm mất dữ liệu SQLite cục bộ của máy lập trình viên.
- `database.py` cần bóc tách URL `sqlite:///` an toàn với cả đường dẫn tương đối `./data/app.db` lẫn bộ nhớ `:memory:`.
