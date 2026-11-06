# Kế hoạch Triển khai: Thay đổi Favicon & App Icon Sang Ảnh Cậu Bé Bút Chì Shin-chan Theo Yêu Cầu Người Dùng

## 1. Mục tiêu
Thay đổi toàn bộ hệ thống Favicon, Apple Touch Icon và App Icon của ứng dụng Learn-Fast sang hình ảnh mới được người dùng cung cấp (Cậu bé bút chì Shin-chan đội mũ gấu cực dễ thương):
- Chuyển đổi và tối ưu hóa hình ảnh gốc (736x736 px JPEG) thành đầy đủ các kích thước biểu tượng tiêu chuẩn công nghiệp:
  - `apple-touch-icon.png` (180x180 px - chuẩn iOS Safari Bookmark, Tab bar iPad, WebClip Add to Home Screen).
  - `apple-icon.png` (180x180 px - chuẩn Next.js App Router).
  - `favicon.png` & `icon.png` (192x192 px & 512x512 px - chuẩn PWA & Modern Browser).
  - `favicon-32x32.png` & `favicon-16x16.png` (chuẩn Desktop Browser tabs).
  - `favicon.ico` đa tầng kích thước (16x16, 32x32, 48x48, 64x64) đặt ở cả `app/` và `public/`.
  - `favicon.svg` nhúng vector/base64 đảm bảo hiển thị sắc nét trên các trình duyệt hỗ trợ SVG icon.
- Nâng cấp phiên bản cache-busting trong `frontend/app/layout.tsx` từ `?v=2` lên `?v=3` để đảm bảo các trình duyệt di động (iOS Safari, Android Chrome) và desktop lập tức nạp favicon mới, không bị giữ lại cache cũ.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **Asset Processing & Generation**:
   - Sử dụng Python Pillow để resize ảnh Shin-chan với thuật toán lọc cao cấp `LANCZOS` chống vỡ hạt ở mọi kích thước nhỏ (16px, 32px, 48px, 64px, 180px, 192px, 512px).
   - Đóng gói file `.ico` chuẩn đa phân giải chứa đồng thời 4 tầng kích thước: 16x16, 32x32, 48x48, 64x64.
   - Tạo file `frontend/public/favicon.svg` nhúng PNG chất lượng cao để đáp ứng các trình duyệt ưu tiên SVG.
2. **Metadata Updating (`frontend/app/layout.tsx`)**:
   - Cập nhật phiên bản query sang `?v=3` cho toàn bộ thẻ `icon`, `shortcut`, `apple`, `apple-touch-icon-precomposed`.
3. **Verification & Building**:
   - Kiểm tra tính toàn vẹn của tất cả các file ảnh vừa tạo.
   - Chạy TypeScript typecheck và `npm run build` của Next.js.
   - Chạy toàn bộ bộ test frontend (32/32 tests).
4. **Post-execution Guide**:
   - Tạo tài liệu hướng dẫn và báo cáo trong `guide/custom-shinchan-favicon-guide.md`.

### Ngoài phạm vi (Out of scope):
- Không thay đổi logic backend hay database.
- Không sửa đổi các component hay logic học tập.

---

## 3. Các bước triển khai
- **Bước 1**: Viết script xử lý ảnh trong thư mục scratch để chuyển đổi ảnh `media_1793994713480_643dc686.jpg` thành bộ icon đầy đủ kích thước và ghi đè vào `frontend/public/` và `frontend/app/`.
- **Bước 2**: Tạo file `frontend/public/favicon.svg` chứa hình ảnh Shin-chan.
- **Bước 3**: Cập nhật `frontend/app/layout.tsx` với query version `?v=3`.
- **Bước 4**: Chạy kiểm tra TypeScript (`tsc --noEmit`), chạy bộ test frontend (`node --test`), và build Next.js (`npm run build`).
- **Bước 5**: Viết tài liệu báo cáo và hướng dẫn trong `guide/custom-shinchan-favicon-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/app/favicon.ico`
- `[MODIFY]` `frontend/public/favicon.ico`
- `[MODIFY]` `frontend/public/apple-touch-icon.png`
- `[MODIFY]` `frontend/app/apple-icon.png`
- `[MODIFY]` `frontend/public/favicon.png`
- `[MODIFY]` `frontend/app/icon.png`
- `[MODIFY]` `frontend/public/favicon-32x32.png`
- `[MODIFY]` `frontend/public/favicon-16x16.png`
- `[MODIFY]` `frontend/public/favicon.svg`
- `[MODIFY]` `frontend/app/layout.tsx`
- `[NEW]` `plan/custom-shinchan-favicon.md`
- `[NEW]` `guide/custom-shinchan-favicon-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Toàn bộ các file favicon và apple-icon trong cả `frontend/public/` và `frontend/app/` được thay thế bằng ảnh Shin-chan mới.
2. `favicon.ico` chứa đầy đủ 4 kích thước (16, 32, 48, 64).
3. `apple-touch-icon.png` có kích thước chuẩn 180x180 px sắc nét, bo viền tự nhiên khi iOS hiển thị.
4. `frontend/app/layout.tsx` sử dụng query version `?v=3`.
5. `tsc --noEmit` và `npm run build` thành công 100%.
6. Toàn bộ 32 unit tests tiếp tục pass mà không có hồi quy.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Script kiểm tra format, kích thước (width, height) của từng file sinh ra.
- Kiểm tra output HTML của `next build` xem các thẻ link icon đã trỏ chính xác đến `?v=3`.
- Chạy `node --test frontend/tests/*.test.mjs`.

---

## 7. Rủi ro & Edge cases
- **Cơ chế cache của iOS Safari**: Người dùng cần được nhắc nhở mở lại tab hoặc thêm query `?reload=1` nếu Safari trên máy họ chưa tự động purge cache icon cũ.
