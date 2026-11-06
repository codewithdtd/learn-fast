# Kế hoạch Triển khai: Sửa Favicon Toàn diện, Tạo Apple Touch Icon & Khắc phục Cache Favicon Cũ trên iOS Safari

## 1. Mục tiêu
Giải quyết triệt để vấn đề người dùng truy cập Learn-Fast trên thiết bị di động iOS (iPhone / iPad) vẫn bị hiển thị favicon cũ (hoặc logo Next.js mặc định / icon cũ), đồng thời chuẩn hóa hệ thống favicon và Apple Touch Icon trên toàn bộ nền tảng:
- Tạo mới đầy đủ các asset biểu tượng chuẩn: Apple Touch Icon (`apple-touch-icon.png` 180x180), Favicon PNG (`favicon.png` 192x192 / 512x512 / 32x32), Multi-resolution Favicon ICO (`favicon.ico` 16/32/48/64) mang trọn vẹn nhận diện thương hiệu Learn-Fast (quyển sách mở với ngôi sao vàng trên nền xanh `#1F658D`).
- Khắc phục cơ chế lưu cache siêu cứng đầu của iOS Safari (`WebpageIcons.db`) bằng cache-busting version query (`?v=20261107`) và định danh `apple-touch-icon`.
- Cấu hình file-based metadata chuẩn Next.js 16 App Router (`app/apple-icon.png`, `app/icon.png`, `app/favicon.ico`).
- Viết hướng dẫn chi tiết cách xóa cache favicon trên iOS Safari để người dùng thấy ngay biểu tượng mới mà không cần cài đặt lại trình duyệt.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **Asset Generation (Tạo bộ icon nhận diện mới)**:
   - Từ `frontend/public/favicon.svg` hiện hữu, render ra các file ảnh PNG sắc nét (pixel-perfect) không bị nhòe:
     - `frontend/public/apple-touch-icon.png` (180x180 px - chuẩn iOS Apple Touch Icon cho Safari Bookmarks & Add to Home Screen).
     - `frontend/public/favicon.png` (192x192 px & 512x512 px).
     - `frontend/public/favicon-32x32.png` & `frontend/public/favicon-16x16.png`.
     - `frontend/app/apple-icon.png` (chuẩn App Router cho Apple devices).
     - `frontend/app/icon.png` (chuẩn App Router cho Modern browsers).
     - Thay thế file starter `frontend/app/favicon.ico` cũ bằng file `.ico` chuẩn chứa các layer 16x16, 32x32, 48x48.
2. **Metadata & Head Optimization (`frontend/app/layout.tsx`)**:
   - Cập nhật metadata `icons` bao gồm cả `icon`, `shortcut`, `apple` với kích thước rõ ràng và query version `?v=20261107` để buộc iOS Safari phá vỡ cache cũ.
   - Bổ sung `manifest.json` / WebClip metadata hỗ trợ iOS PWA Add to Home Screen.
3. **User Guidance**:
   - Viết quy trình hướng dẫn người dùng cách refresh favicon trên iOS Safari (Clear Safari Cache hoặc mẹo thêm query param).

### Ngoài phạm vi (Out of scope):
- Không thay đổi logic backend hay database.
- Không sửa đổi cấu trúc trang hay layout components khác.

---

## 3. Các bước triển khai
- **Bước 1**: Tạo script tiện ích trong `scratch/` để render SVG thành các định dạng PNG chuẩn kích thước (180x180, 192x192, 512x512, 32x32, 16x16) và đóng gói thành `.ico` đa kích thước bằng Microsoft Edge Headless + Python Pillow.
- **Bước 2**: Phân bổ các asset mới vào `frontend/public/` và `frontend/app/`.
- **Bước 3**: Cập nhật metadata trong `frontend/app/layout.tsx` với đầy đủ links, rels, sizes và versioning chống cache iOS.
- **Bước 4**: Kiểm thử:
  - Kiểm tra xem file `.ico`, `.png`, `.svg` có thể truy cập hợp lệ qua Next.js server / static builder.
  - Chạy `tsc --noEmit` và `npm run build`.
  - Chạy test suite frontend.
- **Bước 5**: Viết tài liệu báo cáo và hướng dẫn trong `guide/favicon-ios-refresh-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[NEW]` `frontend/public/apple-touch-icon.png`
- `[NEW]` `frontend/public/favicon-32x32.png`
- `[NEW]` `frontend/public/favicon-16x16.png`
- `[NEW]` `frontend/app/apple-icon.png`
- `[NEW]` `frontend/app/icon.png`
- `[MODIFY]` `frontend/public/favicon.png`
- `[MODIFY]` `frontend/app/favicon.ico`
- `[MODIFY]` `frontend/app/layout.tsx`
- `[NEW]` `plan/favicon-ios-refresh-and-apple-touch-icon.md`
- `[NEW]` `guide/favicon-ios-refresh-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Thư mục `frontend/public/` và `frontend/app/` có đầy đủ bộ nhận diện icon mới: `apple-touch-icon.png`, `favicon.ico`, `favicon.png`, `icon.png`, `apple-icon.png`.
2. File `frontend/app/favicon.ico` không còn là file mặc định của Next.js (thay bằng icon Learn-Fast thực tế).
3. `frontend/app/layout.tsx` khai báo đầy đủ icon metadata cho mọi thiết bị (Apple touch icon 180x180, icon PNG 32x32, 16x16, icon SVG, và versioning).
4. `tsc --noEmit` và `npm run build` thành công 100%.
5. Cung cấp hướng dẫn xóa cache favicon trên iOS Safari rõ ràng, dễ thao tác.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy script kiểm tra kích thước và tính toàn vẹn của file ảnh (PNG headers, dimensions 180x180, 512x512, ICO dimensions).
- Kiểm tra output HTML của `next build` xem các thẻ `<link rel="apple-touch-icon">` và `<link rel="icon">` đã được chèn chính xác.
- Chạy `node --test frontend/tests/*.test.mjs`.

---

## 7. Rủi ro & Edge cases
- **Cơ chế cache của iOS Safari**: iOS Safari lưu trữ favicon trong SQLite cache nội bộ rất lâu. Nếu chỉ đổi file mà không đổi URL hoặc không có versioning query parameter `?v=...`, thiết bị của người dùng đã từng mở trang web sẽ tiếp tục đọc ảnh cũ từ local storage của máy cho đến khi xóa lịch sử web hoặc cache bị purge.
  -> *Giải pháp*: Cung cấp cả thẻ `apple-touch-icon` mới có version query `?v=2` VÀ hướng dẫn thao tác xóa cache trên Safari.
