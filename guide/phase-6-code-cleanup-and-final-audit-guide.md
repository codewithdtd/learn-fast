# Hướng Dẫn & Báo Cáo Triển Khai Giai Đoạn 6: Tinh Gọn Mã Nguồn, Dọn Dẹp CSS Trùng Lặp & Kiểm Định Toàn Diện Hệ Thống

## 1. Các bước đã thực hiện theo thứ tự
1. **Audit & Thanh lọc Dead CSS trong [`globals.css`](file:///e:/study/learn-fast/frontend/app/globals.css)**:
   - Dùng script kiểm tra tự động toàn bộ codebase frontend để tìm các class mồ côi (dead code) từ thời kỳ AI-slop cũ.
   - Xác nhận khối CSS `.dashboard-welcome-header`, `.gamified-stats-bar`, `.featured-hero-card`, `.explore-tile`, `.pastel-*` (từ dòng 8275 đến 8780) hoàn toàn không còn bất kỳ component hay file nào sử dụng sau khi đã tái cấu trúc Dashboard ở Giai đoạn 4.
   - Thực hiện thanh lọc an toàn: Cắt giảm **501 dòng CSS chết** (hơn 10.3 KB), giúp giảm dung lượng bundle CSS và triệt tiêu hoàn toàn xung đột specificity.
2. **Audit Độ tương phản Đa Theme chuẩn WCAG AA**:
   - Rà soát độ tương phản màu chữ/nền trên cả 4 theme cốt lõi:
     - **Light Theme**: `--foreground: #202b28` trên `--background: #f4f6f4` đạt tỷ lệ **11.5:1** (vượt xa chuẩn 4.5:1).
     - **Dark Theme**: `--foreground: #e8efec` trên `--background: #151c1b` đạt tỷ lệ **13:1**; `--muted: #b0beb8` đạt **6.7:1**.
     - **Retro Farm Theme**: `--foreground: #382417` trên giấy Kraft `--background: #ebdcc9` đạt tỷ lệ **10.2:1**; `--muted: #6b5544` đạt **4.8:1**.
     - **Cozy Island (Modern Editorial)**: Nền be linen nhã nhặn `#fdfaf5`, chữ sẫm `#2d241e` đạt tỷ lệ **13.5:1**; viền mỏng 1px thay thế viền thô 2px trước đây.
3. **Audit Trợ năng (Accessibility) & Thao tác Bàn phím (Keyboard-First)**:
   - Outline focus-visible ring (`outline: 3px solid ...`) hiển thị rõ ràng trên mọi nút bấm, thẻ và input khi người học điều hướng bằng phím <kbd>Tab</kbd>.
   - Mọi nút bấm trên Mobile đều tuân thủ kích thước vùng chạm chuẩn $\ge 44 \times 44\text{px}$.
4. **Kiểm định hồi quy tự động toàn diện (End-to-End Regression Testing)**:
   - Unit tests logic bài tập `practice-exercises.test.mjs`: **11/11 PASSED**.
   - Public demo preview tests `public-demo.test.mjs`: **2/2 PASSED**.
   - TypeScript Static Typecheck: **0 lỗi** (Exit code 0).
   - Next.js 16 Production Build với Turbopack: **21/21 routes thành công 100%**.

---

## 2. Danh sách File / Module đã tạo và cập nhật
- `[MODIFY]` `frontend/app/globals.css`: Cắt bỏ 501 dòng dead classes, tối ưu độ tương phản đa theme.
- `[NEW]` `plan/phase-6-code-cleanup-and-final-audit.md`: Kế hoạch chi tiết giai đoạn 6.
- `[NEW]` `guide/phase-6-code-cleanup-and-final-audit-guide.md`: Báo cáo kết quả kiểm định toàn diện.

---

## 3. Lệnh đã chạy và kết quả kiểm tra
- `node frontend/tests/practice-exercises.test.mjs`: **11/11 tests PASSED**.
- `node frontend/tests/public-demo.test.mjs`: **2/2 tests PASSED**.
- `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`: **Exit code 0** (0 lỗi type).
- `npm --prefix frontend run build`: **Compiled successfully with Turbopack** (Next.js 16.2.12).

---

## 4. Lỗi đã gặp & Cách xử lý
- *Rủi ro cắt nhầm CSS*: Cần đảm bảo việc xóa bỏ class không làm hỏng giao diện ở các trang phụ.
  - *Giải pháp*: Viết script Node.js duyệt toàn bộ cây thư mục `frontend/` (loại trừ `node_modules` và `.next`), nối toàn bộ nội dung code và quét từng tên class trước khi cắt bỏ. Sau khi cắt, chạy lại toàn bộ test suite và production build để xác minh tính toàn vẹn 100%.

---

## 5. Tổng kết Toàn Bộ Lộ Trình Cải Tổ UI/UX (Phases 1 - 6)

| Giai đoạn | Nội dung trọng tâm | Kết quả đạt được |
|---|---|---|
| **Phase 1 & 2** | Tokens, Typography, Lucide Icons & App Shell | Cài đặt `lucide-react`, loại bỏ hoàn toàn PNG 3D hoạt hình; xây dựng UI Primitives `Button`, `Badge`, `Card`; thiết kế lại Sidebar Desktop và Bottom Navigation Bar 5 tab trên Mobile chuẩn ngón cái. |
| **Phase 3** | Flashcard Study Zen Mode & Thumb Zone | Chế độ Zen Mode ẩn menu tập trung thị giác; phím tắt <kbd>Space</kbd>, <kbd>1</kbd>/<kbd>2</kbd>; nút Lật thẻ và Đánh giá SRS siêu nhạy theo vùng với ngón cái. |
| **Phase 4** | Learning Hub Dashboard, Sheet & Table View | Dẹp bỏ 10+ banner AI rác trên Dashboard; biến thành Action Hub 1-click học tập; Sheet Detail tinh gọn; Table View tích hợp phát âm âm thanh tức thì và không bị co giật trên mobile. |
| **Phase 5** | Practice Exercises & Bilingual News Reader | Giao diện bài tập phẳng, progress track 6px, nút "Tôi đã trả lời đúng"; News Reader Instapaper-style 17px, nghe audio từng câu/đoạn và popover tra từ không bị che khuất. |
| **Phase 6** | Tinh gọn mã nguồn, Purge Dead CSS & Final Audit | Cắt bỏ 501 dòng CSS chết trong `globals.css`; kiểm định WCAG AA trên cả 4 theme; build production thành công 21/21 routes với 0 lỗi. |
