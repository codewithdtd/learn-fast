# Kế Hoạch Triển Khai: Chuyển Ngữ Màn Hình Khởi Động Sang Tiếng Anh, Đặt Cozy Island Làm Theme Mặc Định & Tích Hợp Biểu Đồ Học Tập (Warmup English, Admin Themes, Cozy Island Chart)

## 1. Mục tiêu
Người dùng yêu cầu:
> *"chỗ đợi 45s khi khởi động á nên viết bằng tiếng anh, cũng thay đổi ẩn đi các thông tin server build vì nói thằng ra quá lộ là render và lộ là free các thứ - nên chỉ để thông báo là chờ đợi rối đếm thời gian thôi. Còn theme thì cũng chỉ nên giữ defalu mỗi them e cozy island thôi mấy theme khác ẩn đi chỉ đăng nhập admin mưới thấy được, ngoài ra ở them cozy cũng thêm cái chart đếm số từ/ số sheeet đã học giống mấy theme kia vào"*

Ba yêu cầu trọng tâm:
1. **Màn hình khởi động 45s (`StartupWarmupCountdown`)**:
   - Viết toàn bộ nội dung bằng tiếng Anh tự nhiên, thân thiện.
   - Ẩn hoàn toàn các thông tin kỹ thuật lộ liễu về Render, Free Tier, FastAPI, PostgreSQL, container sleep/wake.
   - Giữ lại thông báo chờ đợi nhẹ nhàng, thanh đếm ngược thời gian, góc đọc mẹo thành ngữ tiếng Anh, và nút kết nối thủ công / reload khi về 0s.
2. **Quản lý Theme & Quyền Admin**:
   - Đặt `DEFAULT_THEME = "island"` (Cozy Island) làm theme mặc định duy nhất cho tất cả người dùng và khách vãng lai.
   - Ẩn bộ chọn theme đối với người dùng thông thường và khách.
   - Chỉ hiển thị bộ chọn theme (ThemeToggle với đầy đủ 6 theme) khi đăng nhập với tài khoản Admin (`user?.is_superuser === true`).
   - Nếu người dùng thông thường trước đó từng lưu theme khác trong `localStorage`, tự động khôi phục về `island`.
3. **Bổ sung Chart Học Tập vào Cozy Island Dashboard**:
   - Tích hợp component `DashboardLearningChart` (biểu đồ thống kê 7 ngày về số từ ôn tập, số buổi học/sheet đã học và dự báo thẻ cần ôn) vào `CozyDashboardView`.
   - Bố cục hài hòa với giao diện Animal Crossing / Cottagecore của Cozy Island.

---

## 2. Phạm vi thực hiện
- **In-Scope**:
  - `frontend/components/shared/startup-warmup-countdown.tsx`: Viết lại 100% bằng tiếng Anh, loại bỏ thuật ngữ Render/Free/Build.
  - `frontend/lib/theme.ts`: Đổi `DEFAULT_THEME` thành `"island"`.
  - `frontend/components/layout/theme-toggle.tsx`: Kiểm tra quyền admin qua `useAuth()`. Chỉ hiển thị menu đổi theme khi `user?.is_superuser === true`.
  - `frontend/components/dashboard/island/cozy-dashboard-view.tsx`: Nhúng `DashboardLearningChart` hiển thị số từ/số sheet đã học.
  - `frontend/components/dashboard/island/cozy-dashboard.module.css`: Thêm kiểu dáng bọc biểu đồ `.chartWrapper`.
  - `frontend/tests/theme.test.mjs`: Cập nhật test case cho `DEFAULT_THEME = "island"`.
  - `guide/warmup-english-cozy-island-chart-and-admin-themes-guide.md`: Tài liệu hướng dẫn sau thực thi.
- **Out of Scope**:
  - Không thay đổi logic backend hay database models.

---

## 3. Các bước triển khai
- **Bước 1**: Viết lại component `StartupWarmupCountdown`:
  - Tiêu đề: "Preparing your study space...", thông điệp tiến trình bằng tiếng Anh.
  - Loại bỏ hộp giải thích Render Free Tier.
  - Cập nhật toàn bộ các mẹo trong learning corner sang tiếng Anh.
- **Bước 2**: Đổi `DEFAULT_THEME` sang `"island"` trong `frontend/lib/theme.ts`.
- **Bước 3**: Cập nhật `ThemeToggle` trong `frontend/components/layout/theme-toggle.tsx`:
  - Lấy `user` từ `useAuth()`.
  - Nếu không phải admin (`!user?.is_superuser`): ẩn toggle hoặc chỉ cho phép dùng `island`.
  - Nếu là admin: hiển thị menu đổi theme có nhãn Admin.
- **Bước 4**: Tích hợp `DashboardLearningChart` vào `CozyDashboardView` và cập nhật CSS trong `cozy-dashboard.module.css`.
- **Bước 5**: Cập nhật `frontend/tests/theme.test.mjs` và chạy toàn bộ test suite frontend `node --test frontend/tests/*.test.mjs`.
- **Bước 6**: Chạy kiểm tra kiểu dữ liệu TypeScript `cd frontend; npx tsc --noEmit`.
- **Bước 7**: Tạo file Guide báo cáo kết quả và commit thay đổi.

---

## 4. Tiêu chí hoàn thành (Definition of Done)
1. Màn hình đếm ngược 45s hoàn toàn bằng tiếng Anh, không chứa bất kỳ từ nào liên quan đến Render, Free Tier hay backend build.
2. Theme mặc định khi tải trang là Cozy Island (`data-theme="island"`).
3. Người dùng bình thường / khách không thấy nút đổi sang theme khác. Chỉ admin mới thấy và chuyển đổi được.
4. Giao diện Cozy Island Dashboard có hiển thị biểu đồ học tập (Cards Reviewed & Sessions).
5. 100% tests pass và không có lỗi TypeScript.
