# Kế Hoạch Giai Đoạn 5: Nâng Cấp Giao Diện Bài Tập Thực Hành & Bilingual News Reader

## 1. Mục tiêu
- **Bài tập thực hành (Practice Exercises - `/sheets/[sheetId]/quick-recall`)**:
  - Tái cấu trúc giao diện làm bài tập phẳng, tinh gọn theo phong cách Linear / Duolingo, loại bỏ các chi tiết thừa.
  - Tích hợp thanh tiến trình mượt mà (sleek 6px progress bar), hiển thị rõ ràng vị trí câu hỏi ("Question 3 of 10").
  - Tích hợp phát âm âm thanh (Audio Pronunciation) qua Web Speech API: nghe câu hỏi tiếng Anh, nghe câu ví dụ, và nghe phát âm câu trả lời đúng khi hoàn thành câu.
  - Tối ưu trải nghiệm làm bài bằng bàn phím (<kbd>Enter</kbd> kiểm tra đáp án, <kbd>Enter</kbd> sang câu tiếp theo) và nút "Tôi đã trả lời đúng" (Overrule) khi hệ thống chấm khắt khe.
  - Màn hình kết quả tổng kết trực quan kèm danh sách câu sai để nghe lại phát âm và học lại.
- **Bilingual News Reader (`/reading`)**:
  - Thiết kế trải nghiệm đọc báo chuẩn Instapaper / Readwise Zen Reader trên cả Desktop và Mobile.
  - Tối ưu giao diện mobile: bộ chuyển đổi phân đoạn mượt mà giữa danh sách tin bài (Stories) và màn hình đọc (Reader), tự động cuộn lên đầu khi chọn bài đọc.
  - Typography cho bài đọc: font-size 17px dễ chịu, line-height 1.85 thoáng đãng, giãn cách đoạn hợp lý, không tràn viền.
  - Hỗ trợ nút nghe phát âm câu/đoạn văn tiếng Anh ngay trong bài báo.
  - Bottom-sheet dịch từ/cụm từ trên mobile: hiển thị ngay phía trên thanh Bottom Nav Bar, không bị che khuất bởi safe-area insets, cho phép dịch tức thì và lưu nhanh vào Personal Vocabulary Sheet.

---

## 2. Phạm vi thực hiện
- **In-Scope**:
  - `frontend/components/quick-recall/practice-exercise-session.tsx`: Refactor giao diện làm bài tập trắc nghiệm, gõ bản dịch và điền từ khuyết, tích hợp âm thanh và trạng thái tương tác chuẩn 8 bước.
  - `frontend/components/quick-recall/practice-exercises.module.css`: CSS hiện đại, viền 1px tinh tế, căn lề và bo góc cân đối.
  - `frontend/components/reading/news-reader.tsx`: Tối ưu hóa trình đọc báo, bổ sung nút phát âm từng đoạn văn, nâng cấp trải nghiệm chọn từ dịch và lưu vào sheet.
  - `frontend/components/reading/news-reader.module.css`: Cải tiến bố cục mobile, typography Zen Reader và bottom-sheet popover.
- **Out-of-Scope**:
  - Thuật toán chấm điểm lõi trong `frontend/lib/practice-exercises.ts` (giữ nguyên 100% để bảo toàn độ chính xác và pass toàn bộ test suite).
  - Backend API endpoints.

---

## 3. Các bước triển khai
- **Bước 1**: Nâng cấp `frontend/components/quick-recall/practice-exercise-session.tsx` & `practice-exercises.module.css`:
  - Hiện đại hóa Header với breadcrumb và icon Lucide.
  - Refactor màn hình Setup: 3 thẻ chọn chế độ (`Multiple choice`, `Type the translation`, `Fill in the blank`), 3 dropdown cấu hình dạng ô phẳng.
  - Refactor màn hình câu hỏi (`ExerciseRound`):
    - Thanh tiến trình mượt mà.
    - Cụm câu hỏi có nút nghe phát âm âm thanh `AudioPronounceButton`.
    - Trắc nghiệm 4 đáp án với badge A, B, C, D rõ nét.
    - Input nhập liệu gõ chữ có focus ring chuẩn.
    - Khối phản hồi đúng/sai và nút "Tôi đã trả lời đúng".
  - Refactor màn hình kết quả (`ExerciseResults`): Thẻ điểm số phần trăm lớn, danh sách câu cần xem lại kèm nút nghe phát âm cho từng từ.
- **Bước 2**: Nâng cấp `frontend/components/reading/news-reader.tsx` & `news-reader.module.css`:
  - Thêm nút nghe phát âm âm thanh `AudioPronounceButton` cho tiêu đề và từng đoạn văn (`paragraph`) của bài báo tiếng Anh.
  - Cải tiến Mobile Segmented Control giữa danh sách tin và bài đọc, thêm nút quay lại "← Choose another story" rõ ràng.
  - Tối ưu kích thước chữ đọc báo chuẩn editorial (17px / line-height 1.85).
  - Tối ưu popover tra từ trên mobile: nâng vị trí bottom lên trên thanh Bottom Nav Bar (`bottom: calc(72px + env(safe-area-inset-bottom))`) để không bị che khuất.
- **Bước 3**: Kiểm định build Next.js và test tự động:
  - Chạy `node frontend/tests/practice-exercises.test.mjs` (11/11 passed).
  - Chạy `node frontend/tests/public-demo.test.mjs` (2/2 passed).
  - Chạy `tsc -p frontend/tsconfig.json --noEmit` (0 lỗi).
  - Chạy `npm --prefix frontend run build` (build thành công 100%).
- **Bước 4**: Lưu báo cáo Guide vào `guide/phase-5-practice-news-reader-guide.md` và commit git.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/components/quick-recall/practice-exercise-session.tsx`
- `[MODIFY]` `frontend/components/quick-recall/practice-exercises.module.css`
- `[MODIFY]` `frontend/components/reading/news-reader.tsx`
- `[MODIFY]` `frontend/components/reading/news-reader.module.css`
- `[NEW]` `plan/phase-5-practice-news-reader-redesign.md`
- `[NEW]` `guide/phase-5-practice-news-reader-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
- [x] Bài tập thực hành có giao diện phẳng, thanh tiến trình mượt mà, đầy đủ nút phát âm âm thanh.
- [x] Nút "Tôi đã trả lời đúng" hiển thị rõ ràng và cập nhật điểm số ngay khi bấm.
- [x] Trình đọc báo News Reader tối ưu hoàn hảo trên mobile: có tab chuyển đổi, không bị tràn viền, tra từ/cụm từ không bị che bởi thanh điều hướng dưới.
- [x] Có nút nghe phát âm cho từng đoạn văn trong bài báo.
- [x] Toàn bộ test suite tự động (`practice-exercises.test.mjs`, `public-demo.test.mjs`) pass 100%.
- [x] TypeScript biên dịch không lỗi (`npm run build` thành công, 0 lỗi).

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `node frontend/tests/practice-exercises.test.mjs` (kỳ vọng 11/11 passed).
- Chạy `node frontend/tests/public-demo.test.mjs` (kỳ vọng 2/2 passed).
- Chạy `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` (kỳ vọng 0 lỗi).
- Chạy `npm --prefix frontend run build` (kỳ vọng thành công 100%).

---

## 7. Rủi ro & Edge cases
- **Chạm trên màn hình cảm ứng**: Tra từ bằng cách chạm (tap to lookup) trên mobile cần phân biệt giữa cuộn trang và chạm từ. Đã có logic `caretPositionFromPoint` và `getReadingWordAtOffset`, cần giữ vững cơ chế này.
- **Audio pronunciation không khả dụng**: Trình duyệt không hỗ trợ Web Speech API cần ẩn nút âm thanh nhẹ nhàng thông qua `isSpeechSupported()` mà không gây vỡ layout.
- **Phím Enter trên CJK / bộ gõ tiếng Việt**: Ngăn submit khi người dùng đang gõ Telex/VNI (`event.nativeEvent.isComposing`).
