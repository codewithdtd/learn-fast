# Kế Hoạch Giai Đoạn 6: Tinh Gọn Mã Nguồn, Dọn Dẹp CSS & Kiểm Định Toàn Diện Hệ Thống

## 1. Mục tiêu
- **Dọn dẹp mã nguồn CSS**: Loại bỏ triệt để hơn 500 dòng CSS rác / mồ côi (dead code) của các class AI cũ trong `globals.css` (như `.dashboard-welcome-header`, `.gamified-stats-bar`, `.featured-hero-card`, `.explore-tile`, v.v.).
- **Audit độ tương phản chuẩn WCAG AA**:
  - Rà soát toàn bộ 4 theme cốt lõi: Light, Dark, Retro Farm, Cozy Island.
  - Đảm bảo độ tương phản màu chữ với nền đạt chuẩn $\ge 4.5:1$ cho nội dung văn bản thường và $\ge 3:1$ cho tiêu đề/icon.
- **Audit khả năng trợ năng & thao tác bàn phím (Keyboard-driven Navigation)**:
  - Outline `:focus-visible` sắc nét, rõ ràng trên mọi nút bấm, ô input, thẻ học flashcard và bài tập thực hành.
  - Vùng chạm ngón cái trên Mobile đạt chuẩn tối thiểu $\ge 44 \times 44\text{px}$.
- **Kiểm định toàn diện (End-to-End Regression Testing)**:
  - Chạy toàn bộ test suites (`practice-exercises.test.mjs`, `public-demo.test.mjs`).
  - Chạy kiểm tra kiểu tĩnh TypeScript (`tsc --noEmit`).
  - Chạy lệnh build tối ưu hóa sản phẩm (`npm run build` với Turbopack trên Next.js 16.2.12).

---

## 2. Phạm vi thực hiện
- **In-Scope**:
  - `frontend/app/globals.css`: Dọn dẹp hơn 500 dòng CSS chết, tinh chỉnh outline focus-visible và semantic tokens.
  - Rà soát các theme tokens trong `frontend/app/globals.css` và `frontend/styles/themes/island.css`.
  - Kiểm tra và đảm bảo không có bất kỳ regression nào trên tất cả 21 dynamic & static routes của ứng dụng.
  - Xóa các file script scratch tạm thời.
- **Out-of-Scope**:
  - Thêm các tính năng mới ngoài lộ trình 6 giai đoạn.
  - Thay đổi cấu trúc cơ sở dữ liệu.

---

## 3. Các bước triển khai
- **Bước 1**: Rà soát và loại bỏ dead CSS classes trong `globals.css` (đã quét đối chiếu mã nguồn và xác nhận không còn bất kỳ component nào sử dụng).
- **Bước 2**: Audit tương phản WCAG AA trên 4 bảng màu Semantic Design Tokens (`light`, `dark`, `retro`, `island`):
  - Kiểm tra tỷ lệ tương phản của `--foreground`, `--muted`, `--primary`, `--green`, `--gold`, `--error` trên các nền `--background` và `--surface`.
- **Bước 3**: Rà soát khả năng điều hướng bàn phím:
  - Kiểm tra focus-visible ring (`outline: 3px solid ...`).
  - Phím <kbd>Space</kbd> / <kbd>Enter</kbd> cho Flashcard và Practice Exercises.
  - Phím <kbd>1</kbd>..<kbd>4</kbd> đánh giá SRS.
- **Bước 4**: Kiểm thử hồi quy tự động:
  - Unit tests: `practice-exercises.test.mjs` (11/11).
  - Public demo tests: `public-demo.test.mjs` (2/2).
  - TypeScript typecheck: `tsc -p frontend/tsconfig.json --noEmit` (0 lỗi).
  - Next.js 16 production build: `npm --prefix frontend run build` (21/21 routes thành công).
- **Bước 5**: Viết Guide hoàn thiện `guide/phase-6-code-cleanup-and-final-audit-guide.md` và commit vào nhánh `ui-ver3`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/app/globals.css`
- `[NEW]` `plan/phase-6-code-cleanup-and-final-audit.md`
- `[NEW]` `guide/phase-6-code-cleanup-and-final-audit-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
- [x] Đã xóa bỏ hơn 500 dòng CSS chết khỏi `globals.css`, giảm thiểu kích thước bundle.
- [x] Độ tương phản màu trên cả 4 theme (`light`, `dark`, `retro`, `island`) đạt chuẩn WCAG AA ($\ge 4.5:1$).
- [x] Khả năng tiếp cận bàn phím và vùng chạm mobile hoạt động chuẩn xác.
- [x] Toàn bộ test suite tự động đạt kết quả 100% Pass.
- [x] Production build của Next.js hoàn thành không phát sinh cảnh báo lỗi.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `node frontend/tests/practice-exercises.test.mjs` (11/11 passed).
- Chạy `node frontend/tests/public-demo.test.mjs` (2/2 passed).
- Chạy `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` (0 errors).
- Chạy `npm --prefix frontend run build` (exit code 0).

---

## 7. Rủi ro & Edge cases
- **Cắt nhầm CSS**: Đã dùng script Node.js quét toàn bộ mã nguồn frontend để kiểm tra sự tồn tại của từng class name trước khi xóa.
