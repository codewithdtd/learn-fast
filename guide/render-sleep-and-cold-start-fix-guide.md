# Hướng Dẫn & Báo Cáo Kỹ Thuật: Vận Hành Chế Độ Ngủ Tự Nhiên & Khắc Phục Lỗi Màn Hình Treo "Server Down Phải Redeploy"

## 1. Xác Nhận Về Yêu Cầu "Tắt Chức Năng Bật 24/7"
- **Trong mã nguồn không có bất kỳ tiến trình 24/7 nào**: Toàn bộ backend FastAPI và cơ sở dữ liệu Neon DB được thiết kế thuần túy theo chuẩn **On-Demand / Serverless** (tự động ngủ khi nhàn rỗi để không tiêu tốn giờ chạy miễn phí).
- **Khuyến nghị 24/7 trước đó**: Lời khuyên trước đây là sử dụng công cụ ngoài (UptimeRobot). Nếu bạn đã tạo monitor trên UptimeRobot, bạn chỉ cần bấm **Pause** hoặc **Delete** monitor đó đi. Máy chủ của bạn sẽ tự động ngủ đông sau 15 phút không dùng theo đúng ý bạn, bảo toàn 100% hạn ngạch 750 giờ miễn phí mỗi tháng của Render!

---

## 2. Giải Mã Hiện Tượng "Server Cứ Báo Down Hoài, Phải Bấm Redeploy Mới Tỉnh"

Hiện tượng này bắt nguồn từ **3 nguyên nhân kỹ thuật thực tế** sau:

### Nguyên nhân 1 (Thủ phạm chính khiến màn hình bị đơ): Lỗi ngắt kết nối quá sớm (Abort Loop sau 3.5s) ở Frontend
- **Điều gì đã xảy ra trước đây**:
  - Khi Render ngủ đông, lần truy cập đầu tiên kích hoạt quá trình khởi động (Cold Start), Render proxy cần **45 đến 60 giây** để dựng container và nạp FastAPI.
  - Trong lúc đó, frontend hiển thị màn hình đếm ngược (`StartupWarmupCountdown`) và gửi lệnh thăm dò `pingBackendHealth`.
  - Tuy nhiên, trong code cũ, `pingBackendHealth` bị giới hạn thời gian chờ chỉ **3.5 giây** (`timeoutMs = 3500`), và cứ mỗi 2.8 giây lại gửi một request mới rồi tự hủy!
  - **Hậu quả**:
    1. Request của bạn bị trình duyệt hủy ngang khi Render mới chỉ đang boot được 3.5 giây.
    2. Frontend **KHÔNG BAO GIỜ nhận được phản hồi HTTP 200** từ máy chủ.
    3. Đồng hồ đếm ngược chạy từ 45 giây về đến **0 giây** rồi đứng im, bị **treo đơ vĩnh viễn** ở màn hình chờ!
    4. Bạn nhìn thấy màn hình đơ ở 0s, tưởng rằng server đã bị "down/chết", nên vào Render bấm *Redeploy*!
    5. Khi bạn bấm Redeploy, bạn đợi trên Render 1-2 phút cho nó deploy xong. Lúc này server đã thức sẵn trong RAM rồi, bạn mở web lại thì thấy chạy được, dẫn đến cảm giác *"chỉ khi redeploy nó mới tỉnh"*.

---

### Nguyên nhân 2: Render Health Check Path bị đánh dấu "Unhealthy" và tự động KILL tiến trình
- Trong Render Dashboard -> Tab **Settings** -> Có một ô cấu hình tên là **"Health Check Path"**.
- Nếu ô này bị điền sai hoặc trỏ vào một route yêu cầu quyền admin / route lỗi:
  - Render sẽ gửi request kiểm tra sức khỏe ngầm.
  - Thấy lỗi 404/403/500 -> Render đánh giá container là **Unhealthy** -> Render gửi lệnh **SIGTERM/SIGKILL tiêu diệt container**.
  - Khi container bị Render kill, mọi request của người dùng sau đó sẽ nhận mã `502 Bad Gateway`, và Render **SẼ KHÔNG TỰ KHỞI ĐỘNG LẠI NỮA** mà bắt buộc bạn phải vào bấm *Redeploy*!
- **Khắc phục**: Đảm bảo trong Render Dashboard, mục **Health Check Path** để là: `/health` (hoặc `/`, hoặc để trống).

---

### Nguyên nhân 3: Xung đột chuỗi kết nối Neon DB (`psycopg2` vs `psycopg3`)
- Khi chuỗi kết nối từ Neon bắt đầu bằng `postgres://` hoặc `postgresql://`:
  - Trong các commit trước đó (trước commit `a020274`), SQLAlchemy cố gọi driver `psycopg2` vốn không có trong môi trường, khiến server bị crash ngay khi khởi động.
  - Hiện tại, bộ lọc tự động chuẩn hóa sang `postgresql+psycopg://` đã được kích hoạt, đảm bảo không còn lỗi thiếu driver.

---

## 3. Các Cải Tiến Đã Triển Khai Ở Frontend (Commit Mới)

1. **Nâng Timeout Probe lên 65 Giây ([`frontend/services/api.ts`](file:///e:/study/learn-fast/frontend/services/api.ts))**:
   - `pingBackendHealth` giờ đây kiên nhẫn giữ kết nối với Render proxy lên tới 65 giây.
   - Khi Render vừa dựng xong container (sau 40–50s), Render lập tức trả lời HTTP 200 cho request đang đợi, frontend nhận được tín hiệu ngay lập tức và tự động vào ứng dụng mượt mà.

2. **Cơ chế Single-Flight Probe Chống Spam ([`frontend/components/shared/startup-warmup-countdown.tsx`](file:///e:/study/learn-fast/frontend/components/shared/startup-warmup-countdown.tsx))**:
   - Chỉ duy trì 1 kết nối probe duy nhất, không hủy kết nối sau 3.5s, không spam request rác lên Render proxy.

3. **Chống Treo Đơ Ở 0 Giây**:
   - Nếu quá thời gian đếm ngược mà máy chủ vẫn đang xử lý, màn hình hiển thị trạng thái thông báo rõ ràng kèm nút **"🔄 Tải lại trang"** và **"⚡ Thử kết nối ngay"**, người dùng không bao giờ bị kẹt lại ở màn hình trắng.

---

## 4. Hướng Dẫn Kiểm Tra Render Dashboard Để Server Hoạt Động Bền Vững

Vào **Render Dashboard** của Web Service backend và kiểm tra 3 điểm sau:

1. **Tab "Environment"**:
   - Đảm bảo biến `DATABASE_URL` có giá trị là chuỗi kết nối từ Neon DB (kèm `?sslmode=require`).
2. **Tab "Settings"**:
   - **Health Check Path**: Nhập `/health` (hoặc để trống).
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
     ```
     *(Nếu thư mục gốc là root repo: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`)*
3. **Không cần công cụ ping ngoài**:
   - Bạn cứ để server ngủ tự nhiên.
   - Khi cần học, bạn mở trang web -> màn hình Warmup sẽ đếm ngược 45s -> tự động chuyển vào dashboard ngay khi Render thức dậy mà không cần bạn phải bấm Redeploy thủ công nữa!
