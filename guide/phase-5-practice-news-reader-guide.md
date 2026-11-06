# Hướng Dẫn & Báo Cáo Triển Khai Giai Đoạn 5: Nâng Cấp Giao Diện Bài Tập Thực Hành & Bilingual News Reader

## 1. Các bước đã thực hiện theo thứ tự
1. **Hiện đại hóa Bài tập thực hành ([`practice-exercise-session.tsx`](file:///e:/study/learn-fast/frontend/components/quick-recall/practice-exercise-session.tsx))**:
   - Thay thế toàn bộ icon cũ bằng vector icons từ `lucide-react` (`ArrowLeft`, `ArrowRight`, `Check`, `CheckCircle2`, `Sparkles`, `Layers`, `RotateCcw`, `Volume2`, `Play`).
   - Tối ưu màn hình chọn chế độ: 3 thẻ chọn chế độ (`Multiple choice`, `Type the translation`, `Fill in the blank`) và 3 dropdown cấu hình dạng ô phẳng, thanh lịch.
   - Nâng cấp trải nghiệm câu hỏi:
     - Thanh tiến trình mượt mà 6px hiển thị tiến độ "Question X of Y".
     - Tích hợp nút phát âm âm thanh [`AudioPronounceButton`](file:///e:/study/learn-fast/frontend/components/shared/audio-pronounce-button.tsx) ngay cạnh câu hỏi tiếng Anh.
     - Trắc nghiệm 4 đáp án với huy hiệu A, B, C, D rõ ràng, phản hồi trạng thái đúng/sai tức thì (xanh lá nhạt viền xanh lá cho đáp án đúng; đỏ nhạt viền đỏ cho lựa chọn sai).
     - Hỗ trợ phím tắt <kbd>Enter</kbd> để kiểm tra đáp án và <kbd>Enter</kbd> lần nữa để sang câu tiếp theo.
     - Nút **"Tôi đã trả lời đúng"** (Overrule) cho phép người học sửa đổi đánh giá câu trả lời khi viết tắt hoặc dùng từ đồng nghĩa, cập nhật điểm số ngay lập tức.
     - Tích hợp nút nghe phát âm âm thanh tiếng Anh ở dòng đáp án đúng.
   - Màn hình kết quả tổng kết: thẻ phần trăm điểm số lớn, tóm tắt câu đúng lần đầu và danh sách các câu cần ôn lại kèm nút nghe âm thanh cho từng từ.
2. **Nâng cấp CSS Bài tập thực hành ([`practice-exercises.module.css`](file:///e:/study/learn-fast/frontend/components/quick-recall/practice-exercises.module.css))**:
   - Viền mỏng 1px tinh tế, loại bỏ bóng đổ nặng, bo góc 12-16px đồng nhất với toàn bộ hệ thống Design System.
   - Trạng thái hover và active scale 0.98 chuẩn mực theo kỷ luật 8 trạng thái tương tác.
3. **Nâng cấp Trình đọc báo News Reader ([`news-reader.tsx`](file:///e:/study/learn-fast/frontend/components/reading/news-reader.tsx))**:
   - Tích hợp nút nghe phát âm âm thanh [`AudioPronounceButton`](file:///e:/study/learn-fast/frontend/components/shared/audio-pronounce-button.tsx) cho:
     - Tiêu đề bài báo tiếng Anh (Headline).
     - Đoạn tóm tắt mở đầu (Summary).
     - Từng đoạn văn (`paragraph`) trong toàn bộ nội dung bài báo.
   - Tinh chỉnh Segmented Control trên mobile: chuyển đổi mượt mà giữa danh sách tin bài (Stories) và bài đọc (Reader), tự động cuộn lên đầu bài khi chọn bài.
   - Thêm nút quay lại rõ ràng `<ArrowLeft /> Choose another story`.
4. **Tối ưu CSS Trình đọc báo ([`news-reader.module.css`](file:///e:/study/learn-fast/frontend/components/reading/news-reader.module.css))**:
   - Typography chuẩn Instapaper / Readwise Zen Reader: font-size 17px (`1.0625rem`), line-height 1.85, giãn dòng thoáng đãng, chống mỏi mắt.
   - Cân đối lề mobile 16px (`padding: 16px 16px calc(98px + env(safe-area-inset-bottom))`).
   - Tinh chỉnh popover tra từ dạng Bottom-Sheet trên mobile: vị trí `bottom: calc(72px + env(safe-area-inset-bottom))` và `z-index: 90` để không bao giờ bị che khuất bởi Bottom Navigation Bar.

---

## 2. Danh sách File / Module đã tạo và cập nhật
- `[MODIFY]` `frontend/components/quick-recall/practice-exercise-session.tsx`: Refactor giao diện bài tập thực hành, tích hợp audio và overrule button.
- `[MODIFY]` `frontend/components/quick-recall/practice-exercises.module.css`: CSS hiện đại, viền 1px, progress bar mượt mà.
- `[MODIFY]` `frontend/components/reading/news-reader.tsx`: Tích hợp audio phát âm từng đoạn văn bài báo và icon Lucide.
- `[MODIFY]` `frontend/components/reading/news-reader.module.css`: Tối ưu typography Zen Reader 17px, audio button từng đoạn và mobile bottom-sheet.
- `[NEW]` `plan/phase-5-practice-news-reader-redesign.md`: Kế hoạch chi tiết giai đoạn 5.
- `[NEW]` `guide/phase-5-practice-news-reader-guide.md`: Báo cáo kết quả và hướng dẫn kiểm thử.

---

## 3. Lệnh đã chạy và kết quả kiểm tra
- `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`: **Exit code 0** (0 lỗi type).
- `node frontend/tests/practice-exercises.test.mjs`: **11/11 tests PASSED**.
- `node frontend/tests/public-demo.test.mjs`: **2/2 tests PASSED**.
- `npm --prefix frontend run build`: **Compiled successfully with Turbopack** (Next.js 16.2.12).

---

## 4. Lỗi đã gặp & Cách xử lý
- **Lỗi & Trở ngại**: Khi người dùng chọn từ/cụm từ trên màn hình cảm ứng điện thoại, popover dịch từ trước đây có nguy cơ bị thanh Bottom Navigation Bar 56px che mất nút bấm "Add to sheet".
  - *Giải pháp*: Điều chỉnh `bottom: calc(72px + env(safe-area-inset-bottom))` và nâng `z-index: 90`, biến popover thành bottom-sheet nổi tinh tế ngay phía trên thanh điều hướng dưới mà không va chạm.

---

## 5. Hướng dẫn trải nghiệm / sử dụng tính năng
1. **Trải nghiệm Bài tập thực hành (`/sheets/[sheetId]/quick-recall`)**:
   - Truy cập vào bất kỳ Sheet nào và chọn tab **"Practice Exercises"**.
   - Chọn chế độ: Trắc nghiệm (Multiple choice), Gõ bản dịch (Type translation) hoặc Điền từ (Fill in the blank).
   - Trong lúc làm bài:
     - Bấm biểu tượng loa để nghe phát âm câu hỏi tiếng Anh.
     - Dùng phím <kbd>Enter</kbd> để kiểm tra đáp án và tiếp tục.
     - Nếu trả lời gõ từ bị hệ thống báo sai do viết tắt hoặc từ đồng nghĩa, bấm nút **"Tôi đã trả lời đúng"** để ghi nhận điểm ngay lập tức.
     - Nghe phát âm đáp án tiếng Anh khi hoàn thành câu.
   - Xem màn hình tổng kết điểm số phần trăm và danh sách câu sai để nghe phát âm lại.
2. **Trải nghiệm Trình đọc báo Bilingual News Reader (`/reading`)**:
   - Truy cập `/reading`.
   - Chọn một bài báo: quan sát tiêu đề và nội dung bài báo có font chữ 17px thoáng đãng, sắc nét.
   - Bấm biểu tượng loa cạnh tiêu đề hoặc cạnh bất kỳ đoạn văn nào (`paragraph`) để nghe phát âm tiếng Anh toàn bộ đoạn đó.
   - Chạm vào bất kỳ từ nào hoặc bôi đen cụm từ để mở bottom-sheet tra từ và bấm "Add to sheet" để lưu vào Personal Vocabulary Sheet.
   - Trên điện thoại: dùng thanh chuyển đổi `[ Stories (N) ]` và `[ Reading ]` tiện lợi.
