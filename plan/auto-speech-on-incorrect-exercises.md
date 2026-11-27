# Kế Hoạch Triển Khai: Tự Động Đọc Câu Tiếng Anh Đúng Cả Khi Trả Lời Sai Trong Bài Tập (Auto Speech on Incorrect Exercises)

## 1. Mục tiêu
Người dùng yêu cầu:
> *"sửa thêm là dù trả lời sai cũng tự động đọc - đọc câu đúng"*

Mục tiêu cụ thể:
1. Khi người học làm bài tập (trắc nghiệm, dịch thuật, điền từ vào chỗ trống trong Quick Recall):
   - **Nếu trả lời đúng**: Phát chuông mừng "ting ting" (nếu bật chuông) và tự động đọc từ/cụm từ tiếng Anh đúng (nếu bật đọc từ).
   - **Nếu trả lời sai**: **Không** phát chuông "ting ting", nhưng **vẫn tự động phát âm đọc từ / cụm từ tiếng Anh đúng** (nếu bật đọc từ) để người học lập tức nghe và tiếp thu phát âm chuẩn của đáp án ngay tại thời điểm mắc lỗi.
2. Tách biệt hoàn toàn âm thanh chuông "ting ting" và giọng đọc tiếng Anh:
   - Nếu người dùng tắt chuông: Vẫn đọc câu đúng.
   - Nếu người dùng tắt giọng đọc: Chỉ phát chuông khi đúng, không đọc khi sai.
   - Khi chuyển sang câu tiếp theo: Hủy ngay lệnh đọc đang chờ và dừng ngay âm thanh đang phát để không bị chồng chéo.

---

## 2. Phạm vi thực hiện

### 2.1. In-Scope:
- `frontend/components/quick-recall/practice-exercise-session.tsx`:
  - Nâng cấp hàm xử lý âm thanh `triggerCorrectAnswerAudio` thành `triggerAnswerFeedbackAudio(question, isCorrect)`.
  - Trong hàm `submit`: Gọi `triggerAnswerFeedbackAudio(question, graded.is_correct)` cho cả kết quả đúng lẫn sai.
  - Trong hàm `handleOverrideAsCorrect`: Giữ nguyên việc gọi phát chuông "ting" và đọc câu đúng khi người học bấm overrule thành đúng.
- `frontend/tests/practice-exercises.test.mjs` (hoặc test liên quan):
  - Bổ sung test kiểm thử đảm bảo hàm trích xuất câu đọc đúng và cơ chế điều phối âm thanh hoạt động chuẩn xác cho cả trường hợp đúng lẫn sai.
- `guide/auto-speech-on-incorrect-exercises-guide.md`:
  - Lưu tài liệu hướng dẫn và báo cáo kết quả sau thực thi theo quy định `AGENTS.md`.

### 2.2. Out-of-Scope:
- Không thay đổi backend hay database.
- Không thay đổi thuật toán chấm điểm hay thứ tự câu hỏi trong hàng đợi bài tập.

---

## 3. Các bước triển khai

- **Bước 1**: Cập nhật hàm điều phối âm thanh trong `frontend/components/quick-recall/practice-exercise-session.tsx`:
  - Đổi tên thành `triggerAnswerFeedbackAudio(currentQ: ExerciseQuestion, isCorrect: boolean)`.
  - Logic:
    - Nếu `isCorrect && getExerciseSoundEnabled()`: Phát chuông `playSuccessSound()`.
    - Nếu `getExerciseSpeechEnabled()`: Hẹn giờ đọc cụm từ tiếng Anh đúng `getExerciseEnglishSentence(currentQ, round.settings)`. Thời gian trễ là 300ms nếu có chuông "ting", hoặc 50ms nếu sai (hoặc tắt chuông).
- **Bước 2**: Trong hàm `submit`:
  - Gọi `triggerAnswerFeedbackAudio(question, graded.is_correct)`.
- **Bước 3**: Cập nhật / bổ sung unit test trong `frontend/tests/practice-exercises.test.mjs`.
- **Bước 4**: Kiểm thử xác minh:
  - Chạy `node --test frontend/tests/*.test.mjs`.
  - Chạy `powershell -Command "cd frontend; npx tsc --noEmit"`.
- **Bước 5**: Viết tài liệu `guide/auto-speech-on-incorrect-exercises-guide.md` và commit git.

---

## 4. Tiêu chí hoàn thành (Definition of Done)
1. Khi trả lời sai câu hỏi bài tập, hệ thống tự động phát âm đọc từ / cụm từ tiếng Anh đúng sau 50ms (nếu tính năng phát âm đang bật).
2. Chuông "ting ting" chỉ kêu khi trả lời đúng (hoặc bấm overrule đúng), không bao giờ kêu khi trả lời sai.
3. Khi người dùng tắt tính năng phát âm qua SoundToggle, hệ thống giữ im lặng khi làm sai (chỉ giữ chuông khi đúng nếu bật chuông).
4. Khi chuyển câu tiếp theo, âm thanh và bộ hẹn giờ của câu cũ được dọn dẹp sạch sẽ, không bị đọc chồng chéo.
5. 100% tests pass và không có lỗi TypeScript.

---

## 5. Kế hoạch kiểm thử (Verification Plan)
- Chạy unit tests: `node --test frontend/tests/*.test.mjs`.
- Kiểm tra kiểu dữ liệu TypeScript: `cd frontend; npx tsc --noEmit`.

---

## 6. Rủi ro & Edge Cases
- **Chồng chéo âm thanh khi bấm Next nhanh**: Nếu người học trả lời sai rồi bấm phím Next ngay lập tức, `speechTimerRef.current` và `stopSpeech()` trong `submit` sẽ hủy ngay lệnh đọc đang đợi, đảm bảo không có âm thanh sót lại từ câu trước.
