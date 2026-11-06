# Kế Hoạch Giai Đoạn 4: Tái Cấu Trúc Learning Hub Dashboard, Sheet Detail & Table View

## 1. Mục tiêu
- Xóa bỏ triệt để hiện tượng "AI-slop", "Card Soup" và chồng chéo nhiều khối widget trùng lặp trên Dashboard (`dashboard-view.tsx`).
- Biến Dashboard thành một **Action Hub** tinh gọn chuẩn Linear / Readwise: Hiển thị ngay lời chào tinh tế, streak học tập, thẻ hành động hàng ngày (1-click Start Review hoặc Resume Session), các hàng đợi ôn tập và tiến trình học.
- Tái cấu trúc trang chi tiết Sheet (`sheet-detail.tsx`): loại bỏ thẻ hero to thô, các ô màu pastel AI (`mint`, `gold`), thay thế bằng layout hiện đại với thẻ Study Flashcards nổi bật và 4 chế độ học tập trực quan.
- Tinh chỉnh trang danh sách từ vựng Table View (`table-view-page.tsx`): layout bảng sắc nét, nghe phát âm IPA tức thì không giật, tự động co giãn thẻ thông minh trên mobile, không bị tràn viền (overflow-x).
- Đảm bảo trải nghiệm mượt mà, đồng nhất trên cả Web Desktop và Web Mobile (khoảng cách 2 bên cân đối 16px trên mobile).

---

## 2. Phạm vi thực hiện
- **In-Scope**:
  - `frontend/components/dashboard/dashboard-view.tsx`: Thiết kế lại Dashboard gọn gàng, loại bỏ các khối banner rác/trùng lặp (`ExplorePastelGrid`, `data-journey-classic-only`, duplicate headers). Giữ lại `DashboardLearningChart`, `DashboardCheckinBanner`, `StartupWarmupCountdown` và các session cards.
  - `frontend/components/sheets/sheet-detail.tsx`: Thiết kế lại header, breadcrumb, primary study card, 4 learning modes card và progress data panel sử dụng các primitives `Button`, `Badge`, `Card`.
  - `frontend/components/sheets/table-view-page.tsx`: Cải tiến toolbar, search input, filter chips, column display toggles và responsive table rows với nút âm thanh phát âm tiện dụng.
  - Cập nhật styling trong `frontend/app/globals.css` và `frontend/styles/themes/island.css` để các component giai đoạn 4 sắc nét với viền 1px, bo góc 14-16px, không bóng đổ neon.
- **Out-of-Scope**:
  - Giai đoạn 5 (Bài tập thực hành Practice Exercises & News Reader) sẽ làm ở giai đoạn tiếp theo.
  - Không sửa đổi API contract backend.

---

## 3. Các bước triển khai
- **Bước 1**: Phân tích và cấu trúc lại `frontend/components/dashboard/dashboard-view.tsx`:
  - Gom các thông tin chào hỏi và streak thành một Clean Header mượt mà.
  - Tích hợp **Daily Action Card**: Ưu tiên phiên đang học dở (`active_sessions`) -> Thẻ đến hạn (`due_sheets`) -> Thẻ mới (`new_sheets`). Nút bấm 1-click rõ ràng.
  - Hiển thị 3 chỉ số chính: Streak ngày (Flame), Thẻ đang hoạt động, Badges/Thành tích.
  - Chia 2 cột trên Desktop (Main column: Active Sessions, Due Review, Learn New, Recent Activity; Sidebar: Learning Trends Chart, Checkin Banner, Quick Links).
  - Tối ưu 1 cột trên Mobile với padding 16px chuẩn, không tràn viền.
- **Bước 2**: Tái cấu trúc `frontend/components/sheets/sheet-detail.tsx`:
  - Dùng `Badge` và `Button` chuẩn hóa.
  - Breadcrumb thanh mảnh, tên sheet có thể click sửa inline.
  - Hero study card rõ ràng với nút "Study Flashcards" nổi bật.
  - Grid 4 learning modes (`Write sentences`, `Translate a story`, `Practice Exercises`, `Table View`) bằng `Card` tinh gọn.
  - Sidebar thống kê tiến độ SRS và dropdown ưu tiên học (`PrioritySelector`).
- **Bước 3**: Tối ưu `frontend/components/sheets/table-view-page.tsx`:
  - Tinh giản Toolbar tìm kiếm và các nút lọc (`All`, `Weak`, `Bookmarked`) có badge đếm số lượng.
  - Chống vỡ layout trên mobile: chế độ xem danh sách thẻ co giãn, audio pronunciation bấm là nghe ngay.
- **Bước 4**: Bổ sung & dọn dẹp CSS tương ứng trong `globals.css` và `island.css`.
- **Bước 5**: Kiểm định build Next.js và test tự động.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/components/dashboard/dashboard-view.tsx`
- `[MODIFY]` `frontend/components/sheets/sheet-detail.tsx`
- `[MODIFY]` `frontend/components/sheets/table-view-page.tsx`
- `[MODIFY]` `frontend/app/globals.css`
- `[MODIFY]` `frontend/styles/themes/island.css`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
- [x] Dashboard không còn chồng chéo các banner/header lặp lại; bố cục rõ ràng, sắc nét.
- [x] Sheet Detail và Table View không bị tràn ngang trên mobile (375px - 414px).
- [x] Nút nghe âm thanh phát âm hoạt động nhạy bén, rõ ràng trên từng từ vựng.
- [x] Giữ nguyên 100% logic nghiệp vụ SRS, API calls và xác thực.
- [x] TypeScript biên dịch không lỗi (`npm run build` thành công, 0 lỗi type).
- [x] Toàn bộ test suite tự động (`practice-exercises.test.mjs`, `public-demo.test.mjs`) pass 100%.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `node frontend/tests/practice-exercises.test.mjs` (kỳ vọng 11/11 passed).
- Chạy `node frontend/tests/public-demo.test.mjs` (kỳ vọng 2/2 passed).
- Chạy `npm --prefix frontend run build` (kỳ vọng thành công 0 lỗi).
- Kiểm tra tính tương thích trên giao diện mobile và desktop.

---

## 7. Rủi ro & Edge cases
- **Cold start backend**: Giữ nguyên `StartupWarmupCountdown` để đếm ngược thân thiện khi backend Render thức giấc.
- **Data rỗng**: Khi người dùng chưa có session nào, chưa có sheet nào đến hạn hoặc không có từ vựng, các component Empty State phải hiển thị tinh tế và có đường dẫn điều hướng tới workbook.
- **Tràn ngang trên Table View**: Trên mobile, cấu trúc grid của table view cần chuyển sang block/flex thẻ dọc để không bao giờ bị cắt cụt chữ.
