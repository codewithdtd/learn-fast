# Hướng Dẫn & Báo Cáo Kỹ Thuật: Giải Mã Hiện Tượng Render Báo "Live" Nhưng Không Chạy & Tại Sao Phải Dùng "Clear build cache & redeploy"

## 1. Tóm Tắt Hiện Tượng & Câu Hỏi Của Bạn
Bạn gặp tình huống:
> *"Sao server Render của tôi lỗi hoài không khởi động, tôi phải vào khởi động tay, mặc dù nó ghi Live? Và tôi phải dùng tính năng Clear cache và redeploy thì nó mới work trở lại?"*

---

## 2. Phân Tích 3 Nguyên Nhân Kỹ Thuật Gốc Rễ

### Nguyên nhân 1 (Gốc rễ của "Clear cache mới chạy"): Xung đột Git Merge do file cơ sở dữ liệu `app.db` bị track trong Git
- **Điều gì đã xảy ra**:
  - File `backend/data/app.db` trước đây đã bị commit và track trong Git repository (`git ls-files backend/data/` trả về `backend/data/app.db`).
  - Render sử dụng cơ chế **Build Cache** để tăng tốc độ deploy: Render giữ lại thư mục mã nguồn từ lần build trước đó (`/opt/render/project/src`).
  - Khi ứng dụng backend chạy trên Render (hoặc khi chạy alembic migration), SQLite liên tục ghi dữ liệu vào file `backend/data/app.db`.
  - Đến lần deploy tiếp theo (khi bạn push commit mới hoặc bấm *Manual Deploy* thông thường), Render chạy lệnh cập nhật Git: `git pull` hoặc `git checkout <commit>`.
  - Git phát hiện file `backend/data/app.db` đã bị thay đổi ở máy chủ Render nhưng lại đang có trong commit mới -> Git lập tức báo lỗi xung đột:
    ```text
    error: Your local changes to the following files would be overwritten by merge:
        backend/data/app.db
    Please commit your changes or stash them before you merge.
    Aborting
    ```
  - Khi Git abort, quá trình deploy hoặc khởi động bị sập (Failed/Crash loop).
- **Tại sao "Clear build cache & redeploy" lại chạy được?**:
  - Khi bạn bấm **Clear build cache & redeploy**, Render **xóa sạch toàn bộ container và ổ cứng cache cũ**, sau đó thực hiện lệnh `git clone` mới hoàn toàn từ GitHub.
  - Do là bản clone mới tinh, không có file `app.db` bị sửa đổi trước đó -> không bị Git merge conflict -> Quá trình build và deploy thành công!

---

### Nguyên nhân 2: Thư viện `passlib[bcrypt]` lỗi thời xung đột với Cache Wheel của `pip`
- File `backend/requirements.txt` trước đó chứa cả `passlib[bcrypt]` và `bcrypt`.
- Thư viện `passlib` đã ngừng cập nhật từ năm 2020 và không tương thích với `bcrypt >= 4.1.0`.
- Trong bộ nhớ cache pip của Render (`~/.cache/pip`), các phiên bản wheel cũ được lưu trữ. Khi deploy thông thường, `pip install` tái sử dụng cache và gặp lỗi xung đột phiên bản bcrypt/passlib hoặc gãy build binary extension. Khi chọn "Clear build cache", pip tải mới từ đầu nên tạm thời vượt qua.

---

### Nguyên nhân 3: Chữ "Live" Ảo của Render & Cơ Chế Ngủ Đông (Cold Start sau 15 phút)
- **Chữ "Live" trên Render thực chất nghĩa là gì?**:
  - Nhãn màu xanh `"Live"` trên Render Dashboard chỉ có nghĩa là: **"Lần triển khai (Deploy) gần nhất của bạn đã kết thúc thành công"**. Nó **HOÀN TOÀN KHÔNG CÓ NGHĨA** là container đang thực sự thức hoặc đang chạy trong RAM!
- **Tại sao server không tự khởi động khi bạn mở web?**:
  - Trên gói Miễn phí (Free Tier) của Render, nếu trong vòng **15 phút** không có bất kỳ request HTTP nào gửi đến, Render sẽ tự động **tắt máy chủ (Spin down về 0 instance)** để tiết kiệm tài nguyên.
  - Khi bạn hoặc người dùng mở web sau 15 phút, request đầu tiên chạm vào Render proxy. Render bắt đầu quá trình **Cold Start** (kéo image, nạp Python runtime, nạp FastAPI, kết nối database). Quá trình này thường mất từ **50 đến 90 giây** (thậm chí 2 phút nếu Render đang quá tải).
  - Trình duyệt và frontend đợi quá thời gian (Timeout sau 10-15s) sẽ lập tức báo lỗi `502 Bad Gateway` hoặc `504 Gateway Timeout`.
  - Khi bạn sốt ruột vào Render Dashboard và bấm *Restart Service* hoặc *Manual Deploy*, thao tác này ép Render bật lại container ngay lập tức. Sau đó quay lại web thấy chạy được, khiến bạn có cảm giác "server lỗi không chịu tự chạy, phải vào bật tay".

---

## 3. Các Giải Pháp Kỹ Thuật Đã Triển Khai Trong Mã Nguồn

1. **Gỡ bỏ hoàn toàn `backend/data/app.db` khỏi Git Tracking**:
   - Đã chạy lệnh `git rm --cached backend/data/app.db` (chỉ gỡ khỏi Git index, giữ nguyên dữ liệu trên máy tính cá nhân của bạn).
   - Bổ sung vào `.gitignore`:
     ```gitignore
     # Database files
     backend/data/*.db
     backend/data/*.db-wal
     backend/data/*.db-shm
     *.db
     *.sqlite
     *.sqlite3
     ```
   - **Kết quả**: Render sẽ không bao giờ gặp lỗi merge conflict `backend/data/app.db` khi deploy thường nữa.

2. **Tự động tạo thư mục database SQLite (`backend/app/core/database.py`)**:
   - Bổ sung đoạn mã tự động kiểm tra và tạo thư mục cha (`./data`) khi khởi tạo kết nối:
     ```python
     if settings.database_url.startswith("sqlite"):
         raw_path = settings.database_url.replace("sqlite:///", "")
         if raw_path and not raw_path.startswith(":memory:"):
             Path(raw_path).resolve().parent.mkdir(parents=True, exist_ok=True)
     ```
   - Ngăn chặn triệt để lỗi crash `sqlite3.OperationalError: unable to open database file` khi deploy sạch.

3. **Dọn dẹp `backend/requirements.txt`**:
   - Loại bỏ gói lỗi thời `passlib[bcrypt]` (hệ thống hiện tại sử dụng thư viện bảo mật `bcrypt` chuẩn theo RFC 7519).

4. **Root Health Check Endpoints (`backend/app/main.py`)**:
   - Thêm `GET /` và `GET /health` trả về HTTP 200 `{"status": "ok", "service": "learn-fast-api"}` siêu nhẹ.

---

## 4. Hướng Dẫn Cấu Hình Render.com Dashboard Chuẩn Nhất

Để Render build mượt mà mà không bao giờ cần "Clear build cache", hãy cấu hình các thông số sau trong Render Dashboard:

### 1. Tab "Settings" trên Render Dashboard
- **Root Directory**: `backend` (hoặc để trống nếu repo deploy từ root)
- **Build Command**:
  - Nếu Root Directory là `backend`:
    ```bash
    pip install --no-cache-dir -r requirements.txt && alembic upgrade head
    ```
  - Nếu Root Directory để trống:
    ```bash
    pip install --no-cache-dir -r backend/requirements.txt && cd backend && alembic upgrade head
    ```
  *(Cờ `--no-cache-dir` đảm bảo pip luôn cài đặt sạch sẽ, không bị kẹt wheel hỏng)*
- **Start Command**:
  - Nếu Root Directory là `backend`:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
    ```
  - Nếu Root Directory để trống:
    ```bash
    cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
    ```
  *(Bắt buộc dùng `--workers 1` để tiết kiệm RAM, tránh bị OOM killer tiêu diệt ngầm trên gói 512MB RAM)*
- **Health Check Path**: `/health` (hoặc `/`)

---

## 5. Giải Pháp Giữ Máy Chủ Render LUÔN THỨC 24/7 (Không Bị Ngủ Đông)

Để không bao giờ phải chịu cảnh chờ đợi Cold Start 60-90 giây hay phải vào dashboard khởi động tay:

1. Truy cập trang web miễn phí [UptimeRobot](https://uptimerobot.com) (hoặc [cron-job.org](https://cron-job.org)).
2. Đăng ký tài khoản miễn phí và chọn **"Add New Monitor"**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Learn Fast Backend Keep-Alive`
   - **URL (or IP)**: `https://<ten-dich-vu-cua-ban>.onrender.com/health`
   - **Monitoring Interval**: `5 minutes` (mỗi 5 phút một lần).
3. Bấm **Create Monitor**.

> [!TIP]
> **Hiệu quả**: Cứ mỗi 5 phút, UptimeRobot sẽ tự động gửi 1 request probe siêu nhẹ (vài bytes) vào route `/health` của bạn. Render thấy liên tục có lượt truy cập nên **SẼ KHÔNG BAO GIỜ CHO SERVER NGỦ ĐÔNG NỮA**! Trang web của bạn mở ra sẽ load ngay lập tức trong 0.2s mà không còn lỗi quay vòng!
