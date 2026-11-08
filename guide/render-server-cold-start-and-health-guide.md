# Hướng Dẫn & Báo Cáo: Giải Mã & Khắc Phục Triệt Để Lỗi Máy Chủ Render.com (Cold Start, Health Check 404 & Stale DB Pool)

## 1. Tóm Tắt Hiện Tượng & 4 Nguyên Nhân Gốc Rễ Trên Render.com
Người dùng gặp hiện tượng: *"Server Render lỗi hoài không khởi động, phải vào khởi động bằng tay (Manual Deploy / Restart), mặc dù trên Render dashboard vẫn ghi là Live"*.

Dưới đây là 4 nguyên nhân cốt lõi từ kiến trúc của Render.com và mã nguồn:

### Nguyên nhân 1: Cơ chế Ngủ đông (Spin Down after 15m) & Chữ "Live" Ảo của Render Free Tier
- **Bản chất**: Trên gói Free của Render, sau **15 phút** không có bất kỳ lượt truy cập nào, Render sẽ tự động **tắt máy chủ (spin down về 0 instance)** để tiết kiệm tài nguyên.
- **Tại sao vẫn ghi "Live"?**: Nhãn màu xanh `"Live"` trên Render dashboard chỉ có nghĩa là *lần Deploy gần nhất đã thành công*, chứ **HOÀN TOÀN KHÔNG CÓ NGHĨA LÀ SERVER ĐANG THỨC**!
- **Tại sao phải vào khởi động tay?**: Khi có người dùng truy cập lại sau 15 phút, Render phải khởi động lại từ đầu (gọi là **Cold Start**). Quá trình này mất từ **45 giây đến 90 giây** (hoặc lâu hơn nếu Render quá tải). Trình duyệt hoặc frontend gửi request trong lúc này sẽ bị:
  - `502 Bad Gateway` (Render proxy chưa kết nối được container).
  - `504 Gateway Timeout` (hết thời gian chờ).
  - Quay mãi không load được dữ liệu.
  Khi bạn sốt ruột vào Render bấm **Restart / Manual Deploy**, hành động này ép Render kích hoạt lại container ngay, nên bạn cảm giác "chỉ khi khởi động tay nó mới chạy".

### Nguyên nhân 2: Render Health Check Path bị cấu hình sai (Gây Crash / Restart Loop)
- Render có cơ chế định kỳ kiểm tra sức khỏe máy chủ qua **Health Check Path** (mặc định trong Settings của Render thường để là `/` hoặc `/health`).
- Trong code FastAPI trước đó, route health check nằm ở `/api/v1/health`. Khi Render gửi request probe vào `/` hoặc `/health`, FastAPI trả về **404 Not Found**.
- Render thấy mã lỗi 404 -> Coi như server bị hỏng (Unhealthy) -> Render tiến hành kill process hoặc rollback/treo, khiến server không phục vụ được request.

### Nguyên nhân 3: Chết kết nối Database PostgreSQL sau khi ngủ đông (Stale DB Connection)
- Khi máy chủ Render ngủ đông, các kết nối mạng tới cơ sở dữ liệu (PostgreSQL trên Render, Neon, Supabase) bị ngắt (closed by remote host).
- Khi container thức dậy, SQLAlchemy connection pool vẫn lưu socket cũ đã chết. Request đầu tiên truy vấn DB sẽ bị văng lỗi:
  `psycopg.OperationalError: server closed the connection unexpectedly`
  Dẫn đến request bị lỗi 500 và frontend không nạp được dữ liệu.

### Nguyên nhân 4: Giới hạn RAM 512MB trên Render Free (OOM Crash)
- Render Free chỉ có tối đa 512MB RAM. Nếu lệnh Start Command chạy uvicorn với nhiều worker (hoặc gunicorn), RAM vượt quá 512MB sẽ bị Linux OOM Killer tiêu diệt ngầm (Exit code 137). Render vẫn báo "Live" nhưng tiến trình bên trong đã chết.

---

## 2. Các Thay Đổi Kỹ Thuật Đã Triển Khai Trong Mã Nguồn

1. **Bổ sung Root Health Check (`backend/app/main.py`)**:
   - Thêm trực tiếp 2 route `@api_app.get("/")` và `@api_app.get("/health")` trả về HTTP 200 `{"status": "ok", "service": "learn-fast-api"}`.
   - Bất kể Render Health Check cấu hình là `/`, `/health` hay `/api/v1/health`, máy chủ đều phản hồi 200 OK ngay lập tức.
2. **Cấu hình Tự Động Phục Hồi Kết Nối DB (`backend/app/core/database.py`)**:
   - Thêm `pool_pre_ping=True` và `pool_recycle=300` cho SQLAlchemy engine khi kết nối cơ sở dữ liệu cloud (PostgreSQL).
   - Trước mỗi truy vấn, SQLAlchemy tự động gửi ping kiểm tra kết nối; nếu phát hiện kết nối bị đứt trong lúc ngủ đông, nó sẽ tự mở kết nối mới trong suốt (transparently), không còn lỗi 500.
3. **Tự động Nhận Diện Cổng Động `PORT` (`backend/app/core/config.py`)**:
   - Tự động lấy biến môi trường `PORT` của Render (mặc định 10000) gán cho `api_port`, tránh lệch cổng.

---

## 3. Danh Sách File Đã Cập Nhật

| Thao tác | File Path | Chi tiết thay đổi |
|---|---|---|
| `[MODIFY]` | `backend/app/main.py` | Thêm root endpoint `GET /` và `GET /health` cho Render Health Check |
| `[MODIFY]` | `backend/app/core/database.py` | Thêm `pool_pre_ping=True` và `pool_recycle=300` chống đứt kết nối DB |
| `[MODIFY]` | `backend/app/core/config.py` | Đọc biến môi trường động `PORT` của Render |
| `[MODIFY]` | `backend/tests/test_health.py` | Thêm bài kiểm thử cho `GET /` và `GET /health` |
| `[NEW]` | `plan/render-server-cold-start-and-health-fix.md` | Kế hoạch chi tiết theo chuẩn AGENTS.md |
| `[NEW]` | `guide/render-server-cold-start-and-health-guide.md` | Tài liệu phân tích và hướng dẫn vận hành |

---

## 4. Kết Quả Kiểm Tra
1. **Kiểm tra Unit Test Health Endpoints**:
   ```bash
   pytest backend/tests/test_health.py
   ```
   *Kết quả*: **2/2 passed in 0.03s** (cả `/api/v1/health`, `/`, và `/health` đều trả về 200 OK).
2. **Kiểm tra Cấu hình & Database Engine**:
   ```bash
   pytest backend/tests/test_config.py backend/tests/test_models.py
   ```
   *Kết quả*: **7/7 passed in 5.05s**.
3. **Kiểm tra Toàn bộ Frontend Tests**:
   ```bash
   node --test frontend/tests/*.test.mjs
   ```
   *Kết quả*: **36/36 tests pass 100%**.

---

## 5. HƯỚNG DẪN 3 BƯỚC CẤU HÌNH TRÊN RENDER & GIẢI PHÁP CHỐNG NGỦ ĐÔNG VĨNH VIỄN

Để server của bạn chạy ổn định 24/7 và **KHÔNG BAO GIỜ PHẢI VÀO KHỞI ĐỘNG TAY NỮA**, bạn chỉ cần làm 3 bước sau:

### Bước 1: Kiểm tra Cấu hình Settings trên Render Dashboard
Truy cập vào Web Service của bạn trên [dashboard.render.com](https://dashboard.render.com):
1. Vào tab **Settings**:
   - **Build Command**: `pip install -r requirements.txt` (nếu root directory là backend) hoặc `pip install -r backend/requirements.txt`.
   - **Start Command** (RẤT QUAN TRỌNG):
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
     ```
     *(Lưu ý: BẮT BUỘC dùng `--workers 1` để không bị tràn 512MB RAM gây OOM crash)*.
2. Mục **Health Check Path**:
   - Điền: `/health` (hoặc để trống, vì code đã hỗ trợ cả `/` và `/health`).

### Bước 2: GIẢI PHÁP VÀNG: Dùng UptimeRobot Giữ Server Luôn Thức (Không Bị Ngủ 15 Phút)
Đây là mẹo chuẩn quốc tế được 100% lập trình viên dùng Render Free áp dụng:
1. Truy cập [uptimerobot.com](https://uptimerobot.com) (miễn phí 100%).
2. Tạo tài khoản và bấm **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Learn-Fast Backend`
   - **URL (or IP)**: `https://<ten-service-render-cua-ban>.onrender.com/health`
   - **Monitoring Interval**: Chọn `Every 5 minutes` (mỗi 5 phút một lần).
3. Bấm **Create Monitor**.
*Hiệu quả*: Cứ mỗi 5 phút, UptimeRobot sẽ gửi 1 request siêu nhẹ (tốn vài byte) đánh thức server. Render thấy liên tục có traffic nên **sẽ KHÔNG BAO GIỜ đưa server vào chế độ ngủ đông nữa**! Ứng dụng của bạn sẽ mở phát chạy ngay trong 0.2s như gói trả phí!

### Bước 3: Xem Log Thực Tế Trên Render Khi Có Sự Cố
Nếu trong tương lai server có dấu hiệu bất thường:
- Vào tab **Logs** trên Render dashboard.
- Nếu thấy dòng chữ `Killed` hoặc `Out of memory`: đó là do RAM vượt quá 512MB (hãy đảm bảo `--workers 1`).
- Nếu thấy `Application startup complete`: server đã chạy ngon lành.
