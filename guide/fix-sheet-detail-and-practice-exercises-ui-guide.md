# Hướng Dẫn & Báo Cáo Sửa Lỗi Giao Diện Sheet Detail và Practice Exercises

## 1. Các bước đã thực hiện theo thứ tự (Execution Steps)

1. **Điều tra nguyên nhân gốc rễ (Root Cause Analysis)**:
   - Phát hiện `@theme inline` trong `frontend/app/globals.css` chỉ khai báo `--color-background` và `--color-foreground`, hoàn toàn thiếu các token semantic `--surface`, `--surface-low`, `--surface-high`, `--primary`, `--green`, `--gold`, `--error`, `--muted`, `--outline`. Do đó, Tailwind v4 không tạo ra các class utility (`bg-surface`, `border-outline`, `bg-primary`, ...), khiến các component primitive (`Card`, `Button`, `Badge`) bị trong suốt, mất viền và mất màu nền.
   - Phát hiện `frontend/components/sheets/sheet-detail.tsx` đã bị gỡ toàn bộ các semantic class (`.sheet-detail-*`) và thay bằng utility divs, dẫn đến tách rời hoàn toàn với hàng trăm quy tắc styling của các theme trong `globals.css` và `styles/themes/island.css` (đặc biệt là Cozy Island và Retro Farm), đồng thời gây double-padding trên mobile/desktop.
   - Phát hiện `frontend/components/quick-recall/practice-exercises.module.css` bị khuyết các class `.primary` và `.secondary` khiến các nút retry/back trên trang Quick Recall bị mất style native HTML thô.
2. **Khai báo Semantic Color Tokens trong Tailwind v4**:
   - Cập nhật `@theme inline` trong `frontend/app/globals.css` để ánh xạ đầy đủ 14 biến màu hệ thống sang Tailwind v4 utilities.
3. **Refactor Khôi phục Cấu trúc Chuẩn cho `SheetDetailView`**:
   - Khôi phục toàn bộ cây semantic `.sheet-detail-*` trong `frontend/components/sheets/sheet-detail.tsx` (`sheet-detail-content`, `sheet-detail-header`, `sheet-detail-breadcrumb`, `sheet-detail-back`, `sheet-detail-title-row`, `sheet-detail-layout`, `sheet-detail-main`, `sheet-detail-sidebar`, `sheet-detail-hero-card`, `sheet-detail-primary-action`, `sheet-action-grid`, `sheet-action-card`, `sheet-detail-panel`, `sheet-detail-stats`, `sheet-stat`, `sheet-detail-meta-list`, `sheet-priority-panel`, `sheet-status-badge`, `sheet-detail-state`).
   - Tích hợp vector icons Lucide hiện đại (`ArrowLeft`, `ArrowRight`, `Play`, `Sparkles`, `Layers`, `Edit3`, `BookOpen`, `BarChart3`).
   - Loại bỏ double-padding (`px-4 py-6 sm:py-8`), để `.sheet-detail-page` quản lý padding theo chuẩn responsive.
4. **Cập nhật Button Primitives & CSS cho Practice Exercises**:
   - Bổ sung class `.primary` và `.secondary` vào `practice-exercises.module.css` tuân thủ 8-state button discipline (hover translation, active tactile scale 0.98).
   - Chuẩn hóa `quick-recall-view.tsx` sử dụng unified `Button` primitive.
   - Xác nhận UTF-8 chuẩn xác trên các nút override ("Tôi đã trả lời đúng") và trạng thái quiz ("✓ Correct", "✕ Your answer").
5. **Kiểm tra tự động toàn diện (Comprehensive Verification)**:
   - Chạy TypeScript typecheck: pass 100% không có lỗi.
   - Chạy suite 11 unit tests `practice-exercises.test.mjs`: pass 11/11.
   - Chạy 2 unit tests `public-demo.test.mjs`: pass 2/2.
   - Chạy Turbopack production build `npm run build`: pass 13/13 static & dynamic routes.

---

## 2. Danh sách File / Module đã tạo và cập nhật

- `[MODIFY]` [frontend/app/globals.css](file:///e:/study/learn-fast/frontend/app/globals.css): Bổ sung 14 semantic tokens vào `@theme inline`.
- `[MODIFY]` [frontend/components/sheets/sheet-detail.tsx](file:///e:/study/learn-fast/frontend/components/sheets/sheet-detail.tsx): Khôi phục toàn bộ semantic CSS classes, tích hợp Lucide vector icons, inline renaming và status badges.
- `[MODIFY]` [frontend/components/quick-recall/practice-exercises.module.css](file:///e:/study/learn-fast/frontend/components/quick-recall/practice-exercises.module.css): Thêm class `.primary` và `.secondary`.
- `[MODIFY]` [frontend/components/quick-recall/quick-recall-view.tsx](file:///e:/study/learn-fast/frontend/components/quick-recall/quick-recall-view.tsx): Dùng `Button` primitive cho trạng thái error/retry.
- `[NEW]` [plan/fix-sheet-detail-and-practice-exercises-ui.md](file:///e:/study/learn-fast/plan/fix-sheet-detail-and-practice-exercises-ui.md): Kế hoạch thực hiện.
- `[NEW]` [guide/fix-sheet-detail-and-practice-exercises-ui-guide.md](file:///e:/study/learn-fast/guide/fix-sheet-detail-and-practice-exercises-ui-guide.md): Tài liệu hướng dẫn & nghiệm thu.

---

## 3. Lệnh đã chạy và kết quả kiểm tra

| Lệnh kiểm tra | Kết quả | Trạng thái |
| :--- | :--- | :--- |
| `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` | Exit code 0, không có lỗi type | ✅ PASS |
| `node frontend/tests/practice-exercises.test.mjs` | 11/11 subtests passed (51ms) | ✅ PASS |
| `node frontend/tests/public-demo.test.mjs` | 2/2 subtests passed (27ms) | ✅ PASS |
| `npm --prefix frontend run build` | Turbopack build thành công 13/13 routes | ✅ PASS |

---

## 4. Lỗi đã gặp & Cách xử lý (Troubleshooting Log)

1. **Lỗi Tailwind v4 không sinh CSS cho custom semantic variables**:
   - *Triệu chứng*: Các thẻ `Card`, `Button`, `Badge` dùng `bg-surface`, `bg-primary`, `border-outline` đều bị trong suốt và mất border.
   - *Nguyên nhân*: Tailwind v4 sử dụng engine `@theme` mới; các biến CSS trong `:root` không tự động biến thành utility class nếu không được bind trong `@theme inline`.
   - *Giải pháp*: Khai báo rõ ràng `--color-surface: var(--surface)`, `--color-primary: var(--primary)`, ... trong `@theme inline` ở đầu `globals.css`.
2. **Lỗi mất theme styling trên trang Sheet Detail**:
   - *Triệu chứng*: Chọn theme Cozy Island, Dark hoặc Retro nhưng trang `/sheets/[sheetId]` hiển thị lộn xộn, mất card viền gỗ/cottage, font chữ xô lệch.
   - *Nguyên nhân*: Việc thay thế toàn bộ class `.sheet-detail-*` bằng inline Tailwind utilities làm đứt gãy kết nối với theme stylesheets trong `island.css` và `globals.css`.
   - *Giải pháp*: Giữ nguyên cây cấu trúc semantic class chuẩn (`.sheet-detail-*`), kết hợp vector icons Lucide và các helper components.

---

## 5. Hướng dẫn trải nghiệm / sử dụng tính năng

1. **Khởi động ứng dụng**:
   - Mở terminal: chạy `npm --prefix frontend run dev` hoặc script `dev.bat` / `dev.ps1`.
   - Truy cập trình duyệt: `http://localhost:3000`.
2. **Kiểm tra trang Sheet Detail (`/sheets/[sheetId]`)**:
   - Đăng nhập và mở bất kỳ sheet nào (hoặc dùng `/demo`).
   - Kiểm tra breadcrumb điều hướng, nút Back, bìa sheet, tên sheet (có thể click để sửa tên trực tiếp).
   - Kiểm tra card Hero "Choose your study mode" với nút "Study Flashcards" nổi bật.
   - Kiểm tra lưới "Learning modes" (Practice Exercises, Table View, Use this word, Translate a story) hover mượt mà với hiệu ứng trượt mũi tên.
   - Kiểm tra cột bên phải hiển thị đầy đủ thông số SRS (Cards, Priority, Reviews, Lapses, Interval).
   - Chuyển đổi giữa các theme: **Cozy Island**, **Retro Farm**, **Playful EdTech**, **Light**, **Dark** qua Theme Toggle ở góc trái màn hình để thấy giao diện biến đổi hoàn hảo theo từng phong cách.
   - Mở Developer Tools (F12) chuyển sang chế độ Mobile (iPhone / Pixel / 375px - 430px): giao diện tự động thu gọn breadcrumb, co giãn header, xếp chồng 1 cột mượt mà, không bị tràn màn hình hay xô lệch nút.
3. **Kiểm tra trang Practice Exercises (`/sheets/[sheetId]/quick-recall`)**:
   - Nhấn vào card "Practice Exercises" từ trang Sheet Detail.
   - Chọn chế độ bài tập (Multiple Choice, Reverse Translation, hoặc Cloze).
   - Kiểm tra nút "Start Practice" hiển thị màu primary đậm rõ ràng, bấm mượt với hiệu ứng tactile active.
   - Trong lúc làm bài:
     - Nhấn vào icon phát âm loa bên cạnh câu hỏi tiếng Anh để nghe Web Speech API phát âm chuẩn xác.
     - Kiểm tra các lựa chọn A, B, C, D hoặc ô gõ từ vựng.
     - Bấm Enter để kiểm tra câu trả lời: câu đúng hiển thị tick xanh `✓ Correct`, câu sai hiển thị `✕ Your answer` kèm nút "Tôi đã trả lời đúng" (Overrule).
   - Màn hình kết quả: hiển thị điểm phần trăm, danh sách các từ cần ôn tập kèm nút nghe lại phát âm, và 2 nút "Try Another Round" / "Change Exercise Mode" cân đối, đẹp mắt.
