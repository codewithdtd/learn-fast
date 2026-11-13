# Hướng Dẫn & Báo Cáo Triển Khai: Chuyển Ngữ Màn Hình Khởi Động Sang Tiếng Anh, Đặt Cozy Island Làm Theme Mặc Định & Tích Hợp Biểu Đồ Học Tập

## 1. Các Bước Đã Thực Hiện Theo Thứ Tự

### 1.1. Chuẩn Hóa Màn Hình Đếm Ngược Khởi Động (`StartupWarmupCountdown`)
- Chuyển ngữ 100% giao diện đếm ngược sang tiếng Anh tự nhiên, tạo cảm giác chuyên nghiệp, thân thiện.
- Ẩn/loại bỏ hoàn toàn các thông tin kỹ thuật lộ tầng hạ tầng (không còn nhắc đến Render, Free tier, Spin-up container, FastAPI, PostgreSQL).
- Thiết kế lại các giai đoạn kết nối (`stageMessage`):
  - `45s - 36s`: "☕ Waking up application services..."
  - `35s - 25s`: "🍃 Connecting to learning services..."
  - `24s - 15s`: "📦 Syncing study library & preferences..."
  - `14s - 05s`: "🌱 Setting up your personalized dashboard..."
  - `< 05s`: "🚀 Final step: Getting ready in a moment..."
- Bổ sung kho mẹo học tiếng Anh (`ENGLISH_TIPS`) với các mẫu câu thành ngữ/từ vựng thực tế song ngữ cùng ví dụ minh họa và giải nghĩa bằng tiếng Anh.
- Nút bấm trực quan: "🔄 Connecting..." / "⚡ Connect now" và "🔄 Reload page".

### 1.2. Đặt Cozy Island Làm Theme Mặc Định & Khóa Theme Switcher Cho Tài Khoản Thường
- Cập nhật hằng số `DEFAULT_THEME = "island"` trong [theme.ts](file:///e:/study/learn-fast/frontend/lib/theme.ts).
- Tích hợp hook `useAuth()` vào [theme-toggle.tsx](file:///e:/study/learn-fast/frontend/components/layout/theme-toggle.tsx):
  - Kiểm tra `const isAdmin = Boolean(user?.is_superuser)`.
  - Nếu không phải Admin (`!isAdmin`):
    - Tự động đồng bộ và đặt lại theme về `"island"` nếu người dùng trước đó từng lưu theme khác trong trình duyệt.
    - Ẩn hoàn toàn component `ThemeToggle` (`return null`) trên cả Desktop Sidebar lẫn Mobile Top Bar. Khách và người dùng bình thường chỉ trải nghiệm duy nhất theme Cozy Island.
  - Nếu là Admin (`isAdmin === true`):
    - Hiển thị menu chuyển đổi theme với nhãn `Appearance (Admin)` và `Choose theme (Admin)` để quản trị viên có thể kiểm tra và chuyển đổi giữa tất cả 6 themes (Light, Dark, Retro, Playful EdTech, Hero's Journey, Cozy Island).

### 1.3. Bổ Sung Biểu Đồ Hoạt Động Học Tập Vào Cozy Island Dashboard
- Import `DashboardLearningChart` từ `@/components/dashboard/dashboard-learning-chart` vào [cozy-dashboard-view.tsx](file:///e:/study/learn-fast/frontend/components/dashboard/island/cozy-dashboard-view.tsx).
- Bố trí khối biểu đồ `chartSection` nằm giữa hàng widgets thứ 2 (`gridRow2`) và khu vực ghi chú Sticky Notes (`CozyMemosWidget`).
- Bổ sung quy tắc CSS trong [cozy-dashboard.module.css](file:///e:/study/learn-fast/frontend/components/dashboard/island/cozy-dashboard.module.css) để biểu đồ đồng bộ màu giấy ngà (`#f4efe6`), viền đất nung ấm áp (`#d4c7b2`), bo tròn 24px và đổ bóng nhẹ theo đúng ngôn ngữ thiết kế Cozy Island.
- Biểu đồ cho phép người học xem:
  - Thống kê 7 ngày gần nhất: số thẻ từ vựng đã ôn (`Cards reviewed`).
  - Số phiên học và sheets đã hoàn thành (`Sheets studied`).
  - Danh sách sheet đến hạn ôn tập (`Due Sheets`) với số ngày quá hạn và nút bắt đầu ôn tập nhanh (`Start Review`).

---

## 2. Danh Sách File / Module Đã Tạo và Cập Nhật

| File | Trạng thái | Mô tả chi tiết |
| :--- | :--- | :--- |
| `plan/warmup-english-cozy-island-chart-and-admin-themes.md` | `[NEW]` | File kế hoạch tiền thực thi theo quy chuẩn `AGENTS.md`. |
| `frontend/components/shared/startup-warmup-countdown.tsx` | `[MODIFY]` | Chuyển toàn bộ màn hình 45s sang tiếng Anh, ẩn thông tin Render/Free tier/Build, cập nhật stage messages và English tips. |
| `frontend/lib/theme.ts` | `[MODIFY]` | Cập nhật `DEFAULT_THEME` từ `"playful"` sang `"island"`. |
| `frontend/components/layout/theme-toggle.tsx` | `[MODIFY]` | Tích hợp `useAuth`, ẩn switcher đối với người dùng không phải admin, ép về theme `island`, gắn nhãn admin cho quản trị viên. |
| `frontend/components/dashboard/island/cozy-dashboard-view.tsx` | `[MODIFY]` | Nhúng `DashboardLearningChart` vào giao diện Cozy Island Dashboard. |
| `frontend/components/dashboard/island/cozy-dashboard.module.css` | `[MODIFY]` | Định kiểu `.chartSection` đồng điệu với phong cách Cottagecore / Cozy Island. |
| `frontend/tests/theme.test.mjs` | `[MODIFY]` | Cập nhật test case khẳng định `DEFAULT_THEME === "island"`. |
| `guide/warmup-english-cozy-island-chart-and-admin-themes-guide.md` | `[NEW]` | Hướng dẫn và báo cáo kết quả thực thi theo quy chuẩn `AGENTS.md`. |

---

## 3. Lệnh Đã Chạy và Kết Quả Kiểm Tra

### 3.1. Chạy Bộ Kiểm Thử Đơn Vị (Frontend Unit Tests)
```bash
node --test frontend/tests/*.test.mjs
```
**Kết quả:**
- 44/44 tests **PASSED** (100% pass rate).
- Bao gồm kiểm tra logic cử chỉ vuốt thẻ flashcard hai mặt, thuật toán SRS, TTS phát âm câu tiếng Anh, Sound toggle độc lập, và theme registry khẳng định Cozy Island là mặc định.

### 3.2. Kiểm Tra Kiểu Dữ Liệu TypeScript
```powershell
cd frontend; npx tsc --noEmit
```
**Kết quả:**
- Hoàn thành với mã thoát `0`, không có bất kỳ lỗi typecheck nào.

---

## 4. Lỗi Đã Gặp & Cách Xử Lý

1. **Khả năng Hydration Mismatch khi kiểm tra quyền Admin trên Client:**
   - *Vấn đề*: Nếu render theme toggle khác nhau giữa SSR và CSR khi `useAuth` đang tải (`isLoading: true`), React có thể báo cảnh báo Hydration mismatch.
   - *Giải pháp*: Trong SSR và lần render đầu tiên, `user` mặc định là `null` nên `isAdmin` là `false` và trả về `null`. Khi CSR hoàn tất xác thực, nếu là admin thì component mới mount với các tùy chọn tương ứng. React Rules of Hooks luôn được giữ thứ tự tuyệt đối ở đầu hàm trước lệnh return có điều kiện.

2. **Người dùng cũ còn lưu theme khác trong `localStorage`:**
   - *Vấn đề*: Khách vãng lai hoặc tài khoản thường trước đó từng chọn theme `playful` hoặc `journey` sẽ tiếp tục hiển thị theme cũ nếu không được cập nhật.
   - *Giải pháp*: Bổ sung `useEffect` trong `ThemeToggle` phát hiện nếu `!isAdmin && activeTheme !== "island"`, tự động gọi `setTheme("island")` để ghi đè localStorage về Cozy Island ngay khi vào trang.

---

## 5. Hướng Dẫn Trải Nghiệm / Sử Dụng Tính Năng

1. **Kiểm tra màn hình khởi động 45s:**
   - Mở ứng dụng trong trường hợp backend đang ở trạng thái ngủ/khởi động.
   - Quan sát màn hình chờ: tiêu đề "Preparing Your Study Space", thanh đếm ngược thời gian (~30-45s), các câu thông báo tiến trình tích cực (như "Connecting to learning services...", "Syncing study library..."), không còn bất kỳ dấu vết nào của Render hay Free tier.
   - Trong lúc chờ, người học có thể đọc các mẹo tiếng Anh kèm ví dụ mẫu trong ô "Learning Corner".

2. **Kiểm tra Theme Cozy Island & Ẩn bộ chọn theme:**
   - Truy cập trang dưới tư cách khách hoặc đăng nhập tài khoản người học thông thường.
   - Toàn bộ giao diện mặc định là Cozy Island (tone màu giấy ngà mộc mạc, viền pastel ấm áp).
   - Thanh Sidebar bên trái và Mobile Top Bar bên trên **không còn** nút đổi theme.
   - Đăng nhập bằng tài khoản Quản trị viên (`is_superuser = true`):
     - Nút `ThemeToggle` lập tức xuất hiện trở lại với nhãn `Appearance (Admin)`.
     - Quản trị viên có thể tự do bấm chọn thử nghiệm cả 6 bộ theme.

3. **Kiểm tra Biểu đồ học tập trên Cozy Island Dashboard:**
   - Vào trang chủ Dashboard (`/`).
   - Ngay dưới phần AI Skills Workshop và Review Queue, người dùng sẽ thấy biểu đồ hoạt động học tập:
     - Chuyển tab giữa `Cards reviewed` (số thẻ từ vựng đã ôn) và `Sheets studied` (số buổi/bài học).
     - Rê chuột vào từng cột ngày để xem chi tiết số lượng.
     - Cột bên phải hiển thị danh sách các bài học đến hạn (`Due Sheets`) kèm nút ôn tập nhanh.
