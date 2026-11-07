# Hướng Dẫn & Báo Cáo: Cập Nhật Toàn Bộ Favicon & App Icon Sang Ảnh Cậu Bé Bút Chì Shin-chan

## 1. Tóm Tắt Yêu Cầu & Kết Quả
Người dùng đã gửi ảnh chân dung Cậu bé bút chì Shin-chan đội mũ tai gấu và yêu cầu đổi favicon toàn bộ ứng dụng sang hình ảnh này.
Hệ thống đã:
- Tối ưu hóa ảnh gốc (736x736 px JPEG) thành đầy đủ 6 định dạng và kích thước tiêu chuẩn cho cả Desktop, Android, iOS Safari và PWA.
- Cập nhật phiên bản cache-busting từ `?v=2` lên `?v=3` trong `frontend/app/layout.tsx` để mọi thiết bị (đặc biệt là iPhone/iPad) ngay lập tức tải icon Shin-chan mới mà không bị dính cache cũ.

---

## 2. Các Bước Đã Thực Hiện Theo Thứ Tự
1. **Xử lý đồ họa & Xuất bản bộ asset icon**:
   - Sử dụng thư viện đồ họa Python Pillow với bộ lọc cao cấp `LANCZOS` để resize ảnh gốc sang các kích thước chuẩn mà không bị vỡ nét hay nhòe hạt:
     - `apple-touch-icon.png` (180x180 px): Chuẩn Apple Touch Icon dành riêng cho iOS Safari Bookmarks, iPad Tab bar và màn hình chính (Add to Home Screen).
     - `apple-icon.png` (180x180 px): Chuẩn File-based metadata trong `app/` của Next.js 16 App Router.
     - `favicon.png` & `icon.png` (192x192 px): Chuẩn Modern Web, Android PWA và các thanh tab hiện đại.
     - `favicon-32x32.png` & `favicon-16x16.png`: Chuẩn tab bar trình duyệt trên Windows, macOS, Linux.
     - `favicon.ico`: Đóng gói đa phân giải 4 tầng kích thước (16x16, 32x32, 48x48, 64x64) đặt ở cả `frontend/app/` và `frontend/public/`.
     - `favicon.svg`: Nhúng bản vẽ Shin-chan độ nét cao phục vụ các trình duyệt ưu tiên vector SVG icon.
2. **Cập nhật Metadata trong `frontend/app/layout.tsx`**:
   - Nâng cấp chuỗi versioning từ `?v=2` lên `?v=3` cho toàn bộ các link icon:
     - `/favicon-32x32.png?v=3`
     - `/favicon-16x16.png?v=3`
     - `/favicon.png?v=3`
     - `/favicon.svg?v=3`
     - `/favicon.ico?v=3`
     - `/apple-touch-icon.png?v=3`
3. **Kiểm tra & Biên dịch đóng gói**:
   - Xác thực TypeScript: `npx tsc -p frontend/tsconfig.json --noEmit` đạt mã thoát 0.
   - Chạy 32/32 tests tự động thành công 100%.
   - Chạy `npm run build` Next.js biên dịch hoàn tất 15 static routes và chèn chính xác 8 thẻ icon links vào `<head>`.

---

## 3. Danh Sách File Đã Cập Nhật

| Thao tác | File Path | Chi tiết thay đổi |
|---|---|---|
| `[MODIFY]` | `frontend/public/apple-touch-icon.png` | Cập nhật ảnh Shin-chan 180x180 px |
| `[MODIFY]` | `frontend/app/apple-icon.png` | Cập nhật ảnh Shin-chan 180x180 px |
| `[MODIFY]` | `frontend/public/favicon.png` | Cập nhật ảnh Shin-chan 192x192 px |
| `[MODIFY]` | `frontend/app/icon.png` | Cập nhật ảnh Shin-chan 192x192 px |
| `[MODIFY]` | `frontend/public/favicon-32x32.png` | Cập nhật ảnh Shin-chan 32x32 px |
| `[MODIFY]` | `frontend/public/favicon-16x16.png` | Cập nhật ảnh Shin-chan 16x16 px |
| `[MODIFY]` | `frontend/app/favicon.ico` | Cập nhật file `.ico` 4 tầng kích thước Shin-chan |
| `[MODIFY]` | `frontend/public/favicon.ico` | Đồng bộ file `.ico` trong thư mục public |
| `[MODIFY]` | `frontend/public/favicon.svg` | Cập nhật SVG nhúng ảnh Shin-chan |
| `[MODIFY]` | `frontend/app/layout.tsx` | Nâng cấp query version sang `?v=3` |
| `[NEW]` | `plan/custom-shinchan-favicon.md` | Bản kế hoạch trước khi thực thi theo chuẩn AGENTS.md |
| `[NEW]` | `guide/custom-shinchan-favicon-guide.md` | Bản hướng dẫn và báo cáo kết quả |

---

## 4. Lệnh Đã Chạy & Kết Quả Kiểm Tra
1. **Kiểm tra TypeScript**:
   ```bash
   npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit
   ```
   *Kết quả*: **Mã thoát 0** (0 lỗi type).
2. **Kiểm tra Bộ Test Frontend**:
   ```bash
   node --test frontend/tests/*.test.mjs
   ```
   *Kết quả*: **Pass 32/32 tests (100%)**.
3. **Biên dịch Production Next.js 16 (Turbopack)**:
   ```bash
   npm --prefix frontend run build
   ```
   *Kết quả*: Biên dịch thành công 15 routes, các link icon `?v=3` xuất hiện đầy đủ trong `<head>` của mã nguồn HTML tĩnh.

---

## 5. Hướng Dẫn Trải Nghiệm & Xem Favicon Shin-chan Mới

### Trên Máy Tính (Chrome / Edge / Firefox / Brave):
- Nhấn phím `Ctrl + F5` (hoặc `Cmd + Shift + R` trên Mac) trên trang web. Tab trình duyệt sẽ ngay lập tức hiển thị gương mặt Shin-chan đội mũ gấu cực kỳ đáng yêu.

### Trên iPhone / iPad (iOS Safari):
- **Cách 1 (Nhanh nhất)**: Mở Safari và truy cập URL với đuôi `?v=3` (hoặc `?reload=1`), ví dụ:
  `http://<dia-chi-ip>:3000/?v=3`
  -> Safari nhận URL mới và tải ngay `apple-touch-icon.png?v=3` Shin-chan.
- **Cách 2 (Thêm vào Màn hình chính / Add to Home Screen)**:
  Bấm nút **Chia sẻ (Share)** ở dưới cùng trình duyệt Safari -> Chọn **Thêm vào MH chính (Add to Home Screen)** -> Biểu tượng Shin-chan đội mũ gấu sẽ xuất hiện làm logo ứng dụng trên màn hình iPhone của bạn.

