# Hướng Dẫn & Báo Cáo: Cập Nhật Toàn Diện Favicon & Khắc Phục Cache Favicon Cũ Trên iOS (Safari)

## 1. Nguyên nhân Kỹ thuật Vì sao iOS Safari Vẫn Hiện Favicon Cũ
Khi người dùng truy cập Learn-Fast trên iPhone / iPad (iOS Safari), việc vẫn thấy favicon cũ (hoặc biểu tượng starter mặc định của Next.js) bắt nguồn từ 3 nguyên nhân cốt lõi:
1. **iOS Safari không hỗ trợ Favicon định dạng SVG**:
   - Trước đây dự án chỉ cấu hình `icon: "/favicon.svg"` trong metadata. Desktop Chrome/Edge/Firefox đọc được SVG, nhưng **Safari trên iOS hoàn toàn bỏ qua SVG favicon** và chỉ tìm kiếm `<link rel="apple-touch-icon">`, `<link rel="icon" type="image/png">` hoặc `/favicon.ico`.
2. **File `app/favicon.ico` và `public/favicon.png` chưa được đồng bộ**:
   - `frontend/app/favicon.ico` vẫn là file starter 25KB mặc định của Next.js từ ngày khởi tạo dự án.
   - `frontend/public/favicon.png` là ảnh cũ và chưa có file `apple-touch-icon.png` (kích thước chuẩn 180x180).
3. **Cơ chế Cache SQLite cực kỳ dai dẳng của iOS (`WebpageIcons.db`)**:
   - iOS Safari lưu favicon và icon trang web vào cơ sở dữ liệu nội bộ trên máy (`WebpageIcons.db`).
   - Khác với desktop (chỉ cần nhấn Ctrl+F5), iOS Safari **không bao giờ tải lại favicon** nếu URL icon giữ nguyên (ví dụ `/favicon.png` hay `/favicon.ico`), trừ khi URL đó có thêm tham số phiên bản (cache-busting query parameter `?v=...`) hoặc người dùng xóa cache Safari.

---

## 2. Các Bước Đã Thực Hiện
1. **Kết xuất bộ icon mới từ SVG vector nhận diện thương hiệu**:
   - Sử dụng Microsoft Edge Headless kết hợp thư viện đồ họa Python Pillow để kết xuất từ `favicon.svg` (biểu tượng cuốn sách mở với ngôi sao vàng trên nền xanh dương `#1F658D`) sang các định dạng chuẩn:
     - `apple-touch-icon.png` (180x180 px, chuẩn độ phân giải cao cho iOS Safari Bookmarks & Add to Home Screen).
     - `favicon.png` và `icon.png` (192x192 px, chuẩn Modern Web & Android PWA).
     - `favicon-32x32.png` & `favicon-16x16.png` (cho tab bar và bookmarks).
     - `favicon.ico` đa tầng kích thước (16x16, 32x32, 48x48, 64x64) thay thế hoàn toàn file starter cũ trong cả `frontend/app/` và `frontend/public/`.
     - `apple-icon.png` cho cơ chế App Router đặc thù của Next.js.
2. **Cập nhật Metadata trong `frontend/app/layout.tsx`**:
   - Khai báo đầy đủ các biến thể icon: `icon`, `shortcut`, `apple`, `apple-touch-icon-precomposed`.
   - Thêm tham số versioning `?v=2` vào tất cả các URL icon để cưỡng chế iOS Safari hủy bỏ cache cũ trong `WebpageIcons.db` ngay lập tức.

---

## 3. Danh sách File Đã Tạo & Cập Nhật

| Thao tác | File Path | Mục đích |
|---|---|---|
| `[NEW]` | `frontend/public/apple-touch-icon.png` | Apple Touch Icon 180x180 px chuẩn iOS Safari |
| `[NEW]` | `frontend/public/favicon-32x32.png` | Favicon PNG 32x32 px |
| `[NEW]` | `frontend/public/favicon-16x16.png` | Favicon PNG 16x16 px |
| `[NEW]` | `frontend/app/apple-icon.png` | App Router file-based Apple Icon 180x180 px |
| `[NEW]` | `frontend/app/icon.png` | App Router file-based Modern Icon 192x192 px |
| `[MODIFY]` | `frontend/public/favicon.png` | Cập nhật PNG 192x192 px theo nhận diện mới |
| `[MODIFY]` | `frontend/app/favicon.ico` | Thay thế file starter Next.js bằng file .ico đa kích thước mới |
| `[MODIFY]` | `frontend/public/favicon.ico` | Đồng bộ file .ico trong thư mục public |
| `[MODIFY]` | `frontend/app/layout.tsx` | Khai báo metadata icon toàn diện kèm `?v=2` chống cache |
| `[NEW]` | `plan/favicon-ios-refresh-and-apple-touch-icon.md` | Plan theo chuẩn AGENTS.md |
| `[NEW]` | `guide/favicon-ios-refresh-guide.md` | Báo cáo và cẩm nang hướng dẫn |

---

## 4. Lệnh Đã Chạy & Kết Quả Kiểm Tra
1. **Kiểm tra TypeScript**:
   ```bash
   npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit
   ```
   *Kết quả*: **Mã thoát 0** (không có lỗi kiểu dữ liệu).
2. **Chạy Unit Test Suite**:
   ```bash
   node --test frontend/tests/*.test.mjs
   ```
   *Kết quả*: **32/32 tests pass 100%**.
3. **Biên dịch Production Next.js Build**:
   ```bash
   npm --prefix frontend run build
   ```
   *Kết quả*: Next.js App Router nhận diện các route tĩnh mới:
   - `○ /apple-icon.png`
   - `○ /icon.png`
   Và chèn đầy đủ 8 thẻ icon link tags vào `<head>` của trang HTML:
   - `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" type="image/png"/>`
   - `<link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml"/>`
   - `<link rel="icon" href="/favicon-32x32.png?v=2" sizes="32x32" type="image/png"/>`
   - `<link rel="icon" href="/favicon-16x16.png?v=2" sizes="16x16" type="image/png"/>`
   - `<link rel="icon" href="/favicon.ico?v=2" sizes="any"/>`

---

## 5. Hướng Dẫn Xem Favicon Mới Ngay Trên iOS Safari

Do iOS Safari có cơ chế cache icon cực kỳ kiên cố, nếu bạn vừa cập nhật và mở lại tab cũ mà Safari vẫn chưa hiện icon mới, hãy áp dụng 1 trong 3 cách sau:

### Cách 1 (Nhanh nhất - Không cần xóa dữ liệu web):
1. Mở Safari trên iPhone, nhập URL trang web và thêm đuôi query bất kỳ vào sau, ví dụ:
   `https://your-domain.com/?reload=1` (hoặc `http://localhost:3000/?reload=1`)
2. Bấm **Đi (Go)**. Safari sẽ coi đây là trang mới và ngay lập tức tải lại bộ icon `apple-touch-icon.png?v=2` mới!

### Cách 2 (Dành cho tính năng "Thêm vào màn hình chính" / Add to Home Screen):
1. Xóa biểu tượng WebClip cũ trên màn hình chính (nếu đã lưu trước đó).
2. Mở lại trang web trên Safari, bấm nút **Chia sẻ (Share)** ở thanh điều hướng dưới cùng.
3. Chọn **Thêm vào MH chính (Add to Home Screen)**.
4. Bạn sẽ thấy biểu tượng xem trước là **cuốn sách mở và ngôi sao vàng trên nền xanh dương** tuyệt đẹp.

### Cách 3 (Làm sạch hoàn toàn Cache Favicon trên iOS):
1. Mở **Cài đặt (Settings)** trên iPhone -> Chọn **Safari** (hoặc Cài đặt -> Ứng dụng -> Safari trên iOS 18).
2. Cuộn xuống cuối chọn **Nâng cao (Advanced)** -> **Dữ liệu trang web (Website Data)**.
3. Tìm kiếm tên miền ứng dụng (hoặc localhost) và vuốt sang trái chọn **Xóa (Delete)**.
4. Mở lại Safari truy cập trang, toàn bộ icon mới sẽ hiển thị sắc nét 100%.

