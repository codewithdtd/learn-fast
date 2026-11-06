# Kế hoạch Sửa lỗi Giao diện Sheet Detail và Practice Exercises (Quick Recall)

## 1. Mục tiêu (Objective)
Khắc phục triệt để lỗi giao diện trên trang Sheet Detail (`/sheets/[sheetId]`) và Practice Exercises (`/sheets/[sheetId]/quick-recall`), đảm bảo:
- Đồng bộ hoàn hảo với toàn bộ hệ thống 6 theme (`light`, `dark`, `retro`, `playful`, `journey`, `island`).
- Khôi phục cấu trúc semantic class chuẩn (`.sheet-detail-*`) để kế thừa trọn vẹn toàn bộ các khối theme CSS (đặc biệt là Cozy Island với các card gỗ mộc mạc, border mềm mại, bảng màu thiên nhiên, và mobile media queries).
- Đảm bảo token Tailwind v4 được ánh xạ đầy đủ trong `@theme inline` (`globals.css`) để các utility primitives (`Button`, `Card`, `Badge`) không bị trong suốt, mất viền hoặc mất màu nền.
- Khôi phục các class button và state views trong `practice-exercises.module.css` và `quick-recall-view.tsx`, sửa lỗi encoding tiếng Việt (UTF-8) ở các nút override và trạng thái kiểm tra.
- Tối ưu ergonomics trên cả 2 phiên bản Web (Desktop) và Mobile (Thumb Zone, không bị double-padding, target chạm >= 44px).

---

## 2. Phạm vi thực hiện (Scope)

### Trong phạm vi (In Scope):
1. **Tailwind v4 Token Mapping**: Giữ và chuẩn hóa ánh xạ `--color-surface`, `--color-surface-low`, `--color-surface-high`, `--color-primary`, `--color-primary-soft`, `--color-green`, `--color-gold`, `--color-error`, `--color-muted`, `--color-outline` trong `@theme inline` tại `frontend/app/globals.css`.
2. **Sheet Detail Component (`frontend/components/sheets/sheet-detail.tsx`)**:
   - Khôi phục cây cấu trúc semantic class (`sheet-detail-content`, `sheet-detail-header`, `sheet-detail-breadcrumb`, `sheet-detail-back`, `sheet-detail-title-row`, `sheet-detail-name-row`, `sheet-detail-layout`, `sheet-detail-main`, `sheet-detail-sidebar`, `sheet-detail-hero-card`, `sheet-detail-primary-action`, `sheet-action-icon`, `sheet-detail-actions`, `sheet-action-grid`, `sheet-action-card`, `sheet-detail-panel`, `sheet-detail-stats`, `sheet-stat`, `sheet-detail-meta-list`, `sheet-priority-panel`, `sheet-status-badge`, `sheet-detail-state`).
   - Loại bỏ double-padding (`px-4 py-6 sm:py-8` chồng chéo với `.sheet-detail-page`).
   - Sử dụng vector icons Lucide hiện đại kết hợp với CSS variables chuẩn.
3. **Practice Exercises UI & CSS (`frontend/components/quick-recall/`)**:
   - Bổ sung class `.primary` và `.secondary` trong `practice-exercises.module.css` tuân thủ 8-state interactive discipline.
   - Sửa lỗi encoding ký tự tiếng Việt (`Tôi đã trả lời đúng`, `✓ Correct`, `✕ Your answer`) trong `practice-exercise-session.tsx`.
   - Chuẩn hóa các nút thử lại (Retry / Back) trong `quick-recall-view.tsx` sang `Button` primitive.
4. **Study Setup & Primitives Encoding**:
   - Sửa encoding UTF-8 trong `frontend/components/study/study-setup.tsx` và `frontend/components/ui/button.tsx`.

### Ngoài phạm vi (Out of Scope):
- Thay đổi logic thuật toán chấm điểm bài tập (`practice-exercises.ts`) hoặc SRS scheduling backend.
- Sửa đổi các trang khác ngoài Sheet Detail, Quick Recall và các primitives liên quan.

---

## 3. Các bước triển khai (Implementation Steps)

### Bước 1: Chuẩn hóa Tailwind v4 `@theme inline` trong `frontend/app/globals.css`
- Đảm bảo toàn bộ CSS variables của Learn-Fast được bind vào Tailwind v4 utility engine:
  `--color-surface`, `--color-surface-low`, `--color-surface-high`, `--color-primary`, `--color-primary-container`, `--color-primary-soft`, `--color-green`, `--color-green-soft`, `--color-gold`, `--color-gold-soft`, `--color-error`, `--color-error-soft`, `--color-muted`, `--color-outline`.

### Bước 2: Refactor `frontend/components/sheets/sheet-detail.tsx`
- Kết nối lại toàn bộ semantic classes tương thích với `globals.css` và `styles/themes/island.css`.
- Giữ các tính năng hiện đại:
  - Vector Lucide icons (`ArrowLeft`, `ArrowRight`, `Play`, `Sparkles`, `Layers`, `Edit3`, `BookOpen`, `BarChart3`).
  - Inline sheet renaming qua `InlineNameEditor`.
  - Sheet study priority selector qua `PrioritySelector`.
  - Bìa workbook qua `WorkbookCover`.
  - Hiển thị badge trạng thái SRS (`StatusBadge`).
  - Lưới các chế độ học: Flashcard Hero CTA, Quizzes (Practice Exercises), Table View, Sentence Writing, Story Translation.

### Bước 3: Sửa CSS & Encoding trong Practice Exercises
- Trong `frontend/components/quick-recall/practice-exercises.module.css`:
  - Thêm `.primary` và `.secondary` button styling hỗ trợ 8 trạng thái tương tác.
- Trong `frontend/components/quick-recall/practice-exercise-session.tsx`:
  - Sửa ký tự tiếng Việt UTF-8 chuẩn cho nút Overrule: "Tôi đã trả lời đúng".
  - Sửa ký tự biểu tượng đúng/sai: "✓ Correct" và "✕ Your answer".
- Trong `frontend/components/quick-recall/quick-recall-view.tsx`:
  - Dùng `Button` primitive cho nút Try Again và nút Quay lại Workbooks.

### Bước 4: Sửa Encoding UTF-8 trong các component liên quan
- `frontend/components/ui/button.tsx`: Sửa nhãn sr-only `Đang xử lý…`.
- `frontend/components/study/study-setup.tsx`: Sửa các ký tự `…`, `›`, `·`.

---

## 4. Các file dự kiến thay đổi (Files to Modify)
- `[MODIFY]` `frontend/app/globals.css`
- `[MODIFY]` `frontend/components/sheets/sheet-detail.tsx`
- `[MODIFY]` `frontend/components/quick-recall/practice-exercises.module.css`
- `[MODIFY]` `frontend/components/quick-recall/practice-exercise-session.tsx`
- `[MODIFY]` `frontend/components/quick-recall/quick-recall-view.tsx`
- `[MODIFY]` `frontend/components/ui/button.tsx`
- `[MODIFY]` `frontend/components/study/study-setup.tsx`
- `[NEW]` `plan/fix-sheet-detail-and-practice-exercises-ui.md`
- `[NEW]` `guide/fix-sheet-detail-and-practice-exercises-ui-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. `/sheets/[sheetId]` hiển thị hoàn hảo ở tất cả các theme (Playful, Cozy Island, Retro Farm, Dark, Light, Learning Journey).
2. Không còn hiện tượng card trong suốt, mất viền hay double-padding.
3. Mobile layout responsive mượt mà: breadcrumb ẩn trên màn hình nhỏ, header co giãn hợp lý, nút chạm to rõ ràng (>= 44px).
4. `/sheets/[sheetId]/quick-recall` hiển thị đầy đủ màu sắc, nút Play pronunciation hoạt động ngay lập tức, nút nộp bài / kiểm tra hiển thị rõ ràng.
5. Không còn lỗi font/encoding ký tự tiếng Việt (UTF-8 hiển thị chuẩn xác).
6. TypeScript typecheck không có lỗi: `tsc --noEmit` pass 100%.
7. Toàn bộ unit tests chạy pass 100% (`practice-exercises.test.mjs`, `public-demo.test.mjs`).
8. Production build Next.js (`npm run build`) thành công 100%.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Run `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`
- Run `node frontend/tests/practice-exercises.test.mjs`
- Run `node frontend/tests/public-demo.test.mjs`
- Run `npm --prefix frontend run build`

---

## 7. Rủi ro & Edge Cases
- **Bảo toàn File Encoding**: Dùng Node script đọc ghi file với UTF-8 chuẩn xác, tránh PowerShell pipe gây lỗi encoding Windows-1252.
- **Bảo toàn Business Logic**: Giữ nguyên toàn bộ logic gọi API, cập nhật tên sheet, đổi priority và state management.
