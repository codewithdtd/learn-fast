# Hướng Dẫn & Báo Cáo Triển Khai Giai Đoạn 4: Tái Cấu Trúc Learning Hub Dashboard, Sheet Detail & Table View

## 1. Các bước đã thực hiện theo thứ tự
1. **Phân tích hiện trạng & Dẹp bỏ "Card Soup" trên Dashboard**:
   - Nhận diện hiện tượng xếp chồng 10+ banner/header AI rác trên Dashboard (`dashboard-view.tsx`).
   - Thiết kế lại Dashboard thành **Actionable Learning Hub**:
     - **Header Bar**: Lời chào cá nhân hóa, ngày tháng, streak chip (Flame) liên kết lịch học, tổng số thẻ đang học, và badge đếm số lượng thẻ đến hạn hôm nay.
     - **Daily Action Hero**: Card nổi bật với viền 1px tinh tế. Tự động chuyển đổi thông minh: Phiên đang học dở (`active_sessions`) -> Thẻ đến hạn (`due_sheets`) -> Thẻ mới (`new_sheets`) -> Queue sạch hoàn thành tất cả. Nút bấm 1-click Start/Continue với icon Play.
     - **Hai cột Desktop / Một cột Mobile Flow**:
       - Cột chính (Main): Danh sách các phiên đang học dở, danh sách sheet đến hạn ôn tập (Due Review), thẻ học từ mới, và lịch sử phiên học gần nhất kèm điểm số.
       - Cột phụ (Sidebar): Banner điểm danh hàng ngày (`DashboardCheckinBanner`), biểu đồ xu hướng học tập (`DashboardLearningChart`), bảng lối tắt nhanh (Quick Practice & Tools) và cảnh báo thẻ yếu (Weak Cards).
     - Giữ nguyên cơ chế đếm ngược `StartupWarmupCountdown` cho backend Render miễn phí khi cold start.
2. **Nâng cấp `Button` Primitive**:
   - Bổ sung hàm tiện ích `buttonVariants({ variant, size, className })` chuẩn phong cách shadcn/ui để có thể áp dụng 8 trạng thái tương tác đồng bộ cho cả thẻ `<button>` lẫn thẻ `<Link>`.
3. **Tái cấu trúc Sheet Detail View (`sheet-detail.tsx`)**:
   - Breadcrumb thanh mảnh có liên kết quay lại workbook.
   - Header hiển thị ảnh bìa workbook, thẻ vị trí, badge trạng thái (`Badge`) và tính năng đổi tên inline.
   - Thẻ Hero học Flashcard chính với thông số SRS (Cấp độ, Chu kỳ lặp, Số lượt ôn).
   - Lưới 2x2 (Desktop) / 1 cột (Mobile) cho 4 chế độ học tập mở rộng:
     - *Practice Exercises* (Quizzes, dịch ngược, điền từ)
     - *Table View* (Duyệt bảng từ vựng, nghe audio, xem ví dụ)
     - *Write Sentences* (Viết câu với từ vựng)
     - *Translate a Story* (Dịch câu chuyện)
   - Sidebar thống kê tiến độ với 4 chỉ số chính dạng ô phẳng và danh sách metadata SRS ngăn nắp.
4. **Tối ưu Bảng Từ Vựng Table View (`table-view-page.tsx`)**:
   - Thanh Toolbar tìm kiếm tức thì với nút xóa `X`.
   - Bộ lọc thẻ: Tất cả, Thẻ yếu (Weak), Thẻ đánh dấu (Bookmarked) có badge đếm số lượng.
   - Nút bật/tắt hiển thị từng cột và nút "Mở rộng tất cả ví dụ".
   - Nút phát âm âm thanh `AudioPronounceButton` tích hợp trực tiếp cạnh từ tiếng Anh và câu ví dụ tiếng Anh, phản hồi ngay lập tức qua Web Speech API.
   - Khắc phục lỗi ẩn nút "Study flashcards" trên mobile (`display: none` trước đây).
5. **Đồng bộ hóa CSS (`globals.css` & `island.css`)**:
   - Loại bỏ các quy tắc ẩn nút học trên mobile.
   - Chuẩn hóa lề 2 bên trên mobile thành 16px (`width: calc(100% - 32px)` / `padding: 16px`), khắc phục hiện tượng dính sát mép màn hình.
   - Tinh chỉnh theme Cozy Island sang Modern Editorial: viền mỏng 1px mộc mạc, bo góc 12-14px, đổ bóng nhẹ nhàng.

---

## 2. Danh sách File / Module đã tạo và cập nhật
- `[MODIFY]` `frontend/components/ui/button.tsx`: Thêm `buttonVariants` helper.
- `[MODIFY]` `frontend/components/dashboard/dashboard-view.tsx`: Tái cấu trúc toàn bộ Dashboard thành Actionable Learning Hub.
- `[MODIFY]` `frontend/components/sheets/sheet-detail.tsx`: Thiết kế lại trang chi tiết Sheet hiện đại và responsive.
- `[MODIFY]` `frontend/components/sheets/table-view-page.tsx`: Tối ưu bảng từ vựng, tích hợp audio và responsive layout.
- `[MODIFY]` `frontend/app/globals.css`: Sửa khoảng cách mobile 16px, hiển thị nút Study trên mobile.
- `[MODIFY]` `frontend/styles/themes/island.css`: Tinh chỉnh Modern Editorial cho các nút bấm và thẻ Sheet/Table.

---

## 3. Lệnh đã chạy và kết quả kiểm tra
- `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`: **Exit code 0** (0 lỗi type).
- `node frontend/tests/practice-exercises.test.mjs`: **11/11 tests PASSED**.
- `node frontend/tests/public-demo.test.mjs`: **2/2 tests PASSED**.
- `npm --prefix frontend run build`: **Compiled successfully with Turbopack** (Next.js 16.2.12).

---

## 4. Lỗi đã gặp & Cách xử lý
- **Lỗi 1**: `Badge` variant `'accent'` không tồn tại trong kiểu dữ liệu `BadgeProps`.
  - *Giải pháp*: Chuyển sang sử dụng variant `'default'` đồng bộ với hệ thống Design System.
- **Lỗi 2**: `SheetStatus` trong `api.ts` là `"not_started" | "learning" | "learned" | "due"`, nhưng `StatusBadge` cũ ánh xạ các key `new`, `mastered`.
  - *Giải pháp*: Cập nhật bảng map `variantMap` chuẩn xác theo kiểu `SheetStatus` của backend.
- **Lỗi 3**: Nút `Study flashcards` bị mất trên mobile ở trang Table View do rule `.table-view-study-link { display: none; }`.
  - *Giải pháp*: Xóa bỏ display none, đổi sang `display: inline-flex` và hiển thị nút học gọn gàng ngay trên header.

---

## 5. Hướng dẫn trải nghiệm / sử dụng tính năng
1. **Kiểm tra Dashboard (`/`)**:
   - Mở trình duyệt và truy cập trang chủ.
   - Quan sát phần đầu trang: Không còn nhiều banner lặp lại. Bạn sẽ thấy ngay lời chào, ngày hiện tại và thanh streak lửa cam nổi bật.
   - Thẻ **Daily Action Hero** sẽ hiển thị đúng trọng tâm: Nếu có phiên dở dang -> bấm "Continue Practice"; nếu có thẻ đến hạn -> bấm "Start Daily Review".
   - Kiểm tra trên kích thước mobile (F12 Responsive 375px/390px): Khoảng cách 2 bên là 16px đều đặn, không có thanh cuộn ngang khó chịu.
2. **Kiểm tra Sheet Detail (`/sheets/[sheetId]`)**:
   - Truy cập một sheet bất kỳ: Thấy nút bấm "Start Flashcards" to rõ ràng.
   - 4 ô chế độ học tập (Bài tập trắc nghiệm, Table View, Viết câu, Dịch bài) hiển thị sắc nét.
3. **Kiểm tra Table View (`/sheets/[sheetId]/table`)**:
   - Bấm vào biểu tượng loa cạnh từ vựng tiếng Anh để nghe phát âm ngay tức thì.
   - Thử tìm kiếm từ khóa trong ô tìm kiếm.
   - Chuyển đổi giữa các bộ lọc: "Tất cả", "Thẻ yếu", "Đã đánh dấu".
   - Bấm nút "Study Deck" trên cùng để vào thẳng phiên học flashcard.
