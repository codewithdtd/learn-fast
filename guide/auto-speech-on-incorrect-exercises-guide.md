# Hướng Dẫn & Báo Cáo Triển Khai: Tự Động Đọc Câu Tiếng Anh Đúng Cả Khi Trả Lời Sai Trong Bài Tập (Auto Speech on Incorrect Exercises)

## 1. Các Bước Đã Thực Hiện Theo Thứ Tự

### 1.1. Điều Phối Âm Thanh Phản Hồi Trong Bài Tập ([practice-exercise-session.tsx](file:///e:/study/learn-fast/frontend/components/quick-recall/practice-exercise-session.tsx))
- Nâng cấp cơ chế phát âm từ `triggerCorrectAnswerAudio` thành `triggerAnswerFeedbackAudio(currentQ: ExerciseQuestion, isCorrect: boolean)`.
- **Logic điều phối âm thanh**:
  - **Khi trả lời ĐÚNG (`isCorrect === true`)**:
    - Nếu bật âm thanh (`getExerciseSoundEnabled()`): Phát chuông reo "ting ting" chúc mừng (`playSuccessSound()`).
    - Nếu bật giọng đọc (`getExerciseSpeechEnabled()`): Chờ 300ms cho tiếng chuông ngân vang (hoặc 50ms nếu tắt chuông), sau đó tự động phát âm đọc từ / cụm từ tiếng Anh mục tiêu đang học (`speakEnglish(phrase)`).
  - **Khi trả lời SAI (`isCorrect === false`)**:
    - **Không** phát chuông "ting ting" (tiếng chuông ăn mừng chỉ dành riêng cho đáp án đúng).
    - Nếu bật giọng đọc (`getExerciseSpeechEnabled()`): Tự động phát âm câu/từ tiếng Anh chuẩn ngay sau 50ms để người học được nghe và sửa phát âm kịp thời ngay tại thời điểm mắc lỗi.
- **Tại hàm nộp bài `submit`**:
  - Gọi `triggerAnswerFeedbackAudio(question, graded.is_correct)` cho tất cả các câu trả lời (cả đúng lẫn sai).
- **Tại nút "Tôi đã đúng" (`handleOverrideAsCorrect`)**:
  - Gọi `triggerAnswerFeedbackAudio(question, true)` để phát lại tiếng chuông "ting" và phát âm câu đúng.
- **Hủy âm thanh khi chuyển câu**:
  - Giữ nguyên cơ chế `stopSpeech()` và `clearTimeout(speechTimerRef.current)` ngay khi người dùng bấm Next sang câu tiếp theo, đảm bảo không có âm thanh đọc chồng chéo giữa các câu hỏi.

### 1.2. Bổ Sung Kiểm Thử Đơn Vị ([practice-exercises.test.mjs](file:///e:/study/learn-fast/frontend/tests/practice-exercises.test.mjs))
- Bổ sung test case `answer audio feedback plays sound only on correct, but speaks target English phrase on both correct and incorrect`:
  - Xác minh khi trả lời đúng (bật cả sound + speech): Có chuông `ting` và đọc câu tiếng Anh sau 300ms.
  - Xác minh khi trả lời sai (bật cả sound + speech): **Không** có chuông `ting`, nhưng **có** đọc câu tiếng Anh chuẩn sau 50ms.
  - Xác minh khi tắt giọng đọc (speech disabled): Hoàn toàn không phát âm khi trả lời sai, chỉ phát chuông khi đúng.

---

## 2. Danh Sách File / Module Đã Tạo và Cập Nhật

| File | Trạng thái | Mô tả chi tiết |
| :--- | :--- | :--- |
| `plan/auto-speech-on-incorrect-exercises.md` | `[NEW]` | Kế hoạch triển khai theo chuẩn `AGENTS.md`. |
| `frontend/components/quick-recall/practice-exercise-session.tsx` | `[MODIFY]` | Cập nhật hàm `triggerAnswerFeedbackAudio` để tự động đọc câu đúng cả khi làm sai và phát chuông khi làm đúng. |
| `frontend/tests/practice-exercises.test.mjs` | `[MODIFY]` | Thêm bài kiểm thử mô phỏng ma trận âm thanh Đúng/Sai và Bật/Tắt voice. |
| `guide/auto-speech-on-incorrect-exercises-guide.md` | `[NEW]` | Báo cáo và hướng dẫn chi tiết theo chuẩn `AGENTS.md`. |

---

## 3. Lệnh Đã Chạy và Kết Quả Kiểm Tra

### 3.1. Chạy Kiểm Thử Đơn Vị Frontend (Node.js Test Runner)
```bash
node --test frontend/tests/*.test.mjs
```
**Kết quả:**
- **49/49 tests PASSED** (100% pass rate).
- Bao gồm kiểm tra trích xuất cụm từ tiếng Anh, ma trận âm thanh đúng/sai, cử chỉ vuốt thẻ flashcard, SRS engine, và bộ lọc từ vựng.

### 3.2. Kiểm Tra Kiểu Dữ Liệu TypeScript
```powershell
cd frontend; npx tsc --noEmit
```
**Kết quả:**
- Hoàn thành với mã thoát `0`, không có lỗi kiểu dữ liệu.

### 3.3. Kiểm Thử Backend (Pytest)
```powershell
backend\.venv\Scripts\pytest.exe backend/tests/test_flashcard_api.py
```
**Kết quả:**
- **8/8 passed** (100% pass rate).

---

## 4. Lỗi Đã Gặp & Cách Xử Lý

1. **Độ trễ phát âm khi làm sai:**
   - *Vấn đề*: Nếu dùng cùng độ trễ 300ms của câu đúng khi làm sai, người học sẽ cảm thấy giao diện bị trễ (lag) vì không có tiếng chuông "ting" lấp đầy khoảng thời gian 300ms đó.
   - *Giải pháp*: Khi `isCorrect === false`, độ trễ được rút ngắn chỉ còn 50ms, giọng đọc phát âm đáp án đúng gần như tức thì ngay khi hộp thoại phản hồi hiện ra.

---

## 5. Hướng Dẫn Trải Nghiệm / Sử Dụng Tính Năng

1. **Luyện tập bài tập (Quick Recall):**
   - Vào một Sheet bất kỳ -> Bấm chọn **"Practice Exercises"** (`/sheets/[sheetId]/quick-recall`).
   - Đảm bảo biểu tượng chiếc loa (Sound / Speech) ở góc trên đang ở trạng thái Bật.
2. **Thử nghiệm trả lời SAI:**
   - Cố tình nhập hoặc chọn một đáp án sai.
   - Bấm Submit:
     - Giao diện báo đỏ "Not quite. Here is the expected answer:".
     - **Không có** tiếng chuông "ting ting".
     - Hệ thống **tự động đọc to** từ / cụm từ tiếng Anh chuẩn của đáp án để bạn nghe và ghi nhớ phát âm đúng.
3. **Thử nghiệm trả lời ĐÚNG:**
   - Nhập đáp án đúng.
   - Bấm Submit:
     - Chuông "ting ting" vang lên.
     - Hệ thống tiếp tục phát âm từ / cụm từ tiếng Anh chuẩn.
4. **Tắt âm thanh tùy ý:**
   - Bấm vào nút chiếc loa để tắt giọng đọc (chỉ giữ tiếng ting ting) hoặc tắt toàn bộ âm thanh nếu đang học ở nơi yên tĩnh.
