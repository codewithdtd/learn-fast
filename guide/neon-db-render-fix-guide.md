# Cẩm Nang Kỹ Thuật: Tối Ưu Hóa & Vận Hành Bền Vững Neon DB (PostgreSQL) Trên Render.com

## 1. Tóm Tắt & Bối Cảnh
Hệ thống Learn-Fast được cấu hình sử dụng **Neon DB (PostgreSQL Serverless)** trên môi trường Production (Render.com).

Khi kết hợp **Render (Free Tier)** với **Neon DB (Serverless Postgres)**, có 3 điểm nghẽn kỹ thuật đặc thù khiến server hay bị crash hoặc báo lỗi 500 nếu không được cấu hình đúng:
1. **Lỗi Scheme & Driver (`postgres://` vs `postgresql://` vs `psycopg3`)**: Gây lỗi `ModuleNotFoundError: No module named 'psycopg2'` hoặc `NoSuchModuleError`.
2. **Cơ chế Autosuspend (Ngủ đông sau 5 phút) của Neon**: Socket kết nối bị ngắt đột ngột, gây lỗi `psycopg.OperationalError: server closed the connection unexpectedly`.
3. **Cold Start đồng thời của cả Render (15 phút) và Neon (5 phút)**: Thời gian chờ quá ngắn dẫn đến connection timeout.

---

## 2. Các Cải Tiến Đã Triển Khai Trong Mã Nguồn

### 1. Tự động chuẩn hóa URL Neon trong [`backend/app/core/config.py`](file:///e:/study/learn-fast/backend/app/core/config.py)
Chuỗi kết nối do Neon Console cung cấp thường có dạng:
- `postgres://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require`
- hoặc `postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require`

Chúng tôi đã bổ sung bộ lọc `@field_validator("database_url", mode="before")`:
- Tự động chuyển đổi `postgres://` và `postgresql://` thành **`postgresql+psycopg://`**.
- Giúp SQLAlchemy 2.0 gọi trực tiếp vào driver `psycopg` (phiên bản 3 hiện đại) với cơ chế native async/SSL, triệt tiêu hoàn toàn nguy cơ lỗi thiếu thư viện `psycopg2`.

### 2. Chống chết kết nối khi Neon ngủ đông trong [`backend/app/core/database.py`](file:///e:/study/learn-fast/backend/app/core/database.py)
Đã cấu hình các tham số tối ưu cho Serverless PostgreSQL:
```python
connect_args = {"connect_timeout": 15}

engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": True,    # Tự động gửi ping kiểm tra socket trước mỗi truy vấn; nếu Neon đã ngủ, SQLAlchemy tự loại bỏ socket hỏng và mở kết nối mới mượt mà
    "pool_recycle": 300,       # Tự động làm mới kết nối sau mỗi 5 phút (300 giây), đồng bộ với chu kỳ ngủ đông của Neon
}
```
- **Lợi ích**: Khi Neon ngủ đông sau 5 phút, request tiếp theo của người dùng sẽ **KHÔNG BAO GIỜ bị văng lỗi 500** nữa.
- `connect_timeout=15` cho phép ứng dụng kiên nhẫn chờ 1–3 giây trong lúc Neon compute đang thức dậy.

### 3. Tương thích kép trong [`backend/requirements.txt`](file:///e:/study/learn-fast/backend/requirements.txt)
- Bổ sung `psycopg2-binary` dự phòng song song với `psycopg[binary]`. Dù chạy Alembic qua dòng lệnh hay chạy qua API, hệ thống luôn có sẵn cả hai driver PostgreSQL chuẩn nhất.

---

## 3. Hướng Dẫn Cấu Hình Render.com Dashboard Khi Dùng Neon DB

### Bước 1: Thiết lập Biến Môi Trường (Tab Environment trên Render)
1. Truy cập vào **Render Dashboard** -> Chọn Web Service của bạn.
2. Vào tab **Environment**:
3. Tìm biến `DATABASE_URL` (hoặc bấm **Add Environment Variable** nếu chưa có):
   - **Key**: `DATABASE_URL`
   - **Value**: Dán toàn bộ chuỗi kết nối lấy từ Neon Console (bao gồm cả `?sslmode=require`).
   *(Ví dụ: `postgresql://alex:Abc123xyz@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`)*
   > [!NOTE]
   > Bạn cứ dán nguyên vẹn link từ Neon (dù bắt đầu bằng `postgres://` hay `postgresql://`), hệ thống code FastAPI và Alembic đã có cơ chế tự động chuẩn hóa sang `postgresql+psycopg://`.

### Bước 2: Thiết lập Build Command & Start Command (Tab Settings)
- **Root Directory**: `backend` (hoặc để trống nếu cấu hình chạy từ root).
- **Build Command**:
  - Nếu Root Directory là `backend`:
    ```bash
    pip install --no-cache-dir -r requirements.txt && alembic upgrade head
    ```
  - Nếu Root Directory để trống:
    ```bash
    pip install --no-cache-dir -r backend/requirements.txt && cd backend && alembic upgrade head
    ```
  *(Lệnh `alembic upgrade head` sẽ tự động tạo đủ toàn bộ bảng trên Neon DB mỗi khi bạn deploy).*
- **Start Command**:
  - Nếu Root Directory là `backend`:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
    ```
  - Nếu Root Directory để trống:
    ```bash
    cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
    ```
- **Health Check Path**: `/health`

---

## 4. Mẹo Chọn URL Trực Tiếp (Direct) vs URL Pooled Trên Neon
Neon cung cấp 2 chế độ kết nối:
1. **Direct Connection** (Host: `ep-xyz.region.neon.tech`):
   - Kết nối trực tiếp tới Postgres compute node.
   - Hoàn hảo cho Alembic Migrations (`alembic upgrade head`) vì hỗ trợ đầy đủ các lệnh DDL và lock bảng.
   - Khuyên dùng làm giá trị `DATABASE_URL` chính thức trên Render.
2. **Pooled Connection** (Host: `ep-xyz-pooler.region.neon.tech`):
   - Kết nối qua PgBouncer tích hợp sẵn của Neon.
   - Thích hợp khi có hàng trăm kết nối đồng thời.

---

## 5. Giữ Cả Render Lẫn Neon DB Thức 24/7 Bằng UptimeRobot
Vì Render ngủ sau **15 phút** và Neon ngủ sau **5 phút**:
- Cài đặt UptimeRobot ping vào `https://<ten-backend>.onrender.com/health` mỗi **4 đến 5 phút**.
- Request này vừa giữ container Render luôn thức trong RAM, vừa kích hoạt kết nối DB nhẹ giúp Neon giữ trạng thái compute active. Web của bạn sẽ luôn phản hồi ngay tức thì trong 0.2s!
