# Hướng Dẫn & Báo Cáo: Hiệu Ứng Âm Thanh "Ting" Báo Hiệu Câu Trả Lời Đúng Trong Bài Tập

## 1. Tóm Tắt Tính Năng
Đã bổ sung hiệu ứng âm thanh chuông "ting" (chime of success) mỗi khi người học hoàn thành một câu hỏi bài tập và đạt kết quả đúng (hoặc chọn "Override as correct"):
- **Âm thanh thăng hoa, trong trẻo**: Chuỗi dao động 2 nốt hài âm thăng tiến (G5: 783.99 Hz chuẩn bị -> E6: 1318.51 Hz ngân vang chuông "ting" kết hợp sóng hài E7: 2637.02 Hz) với đường cong suy giảm tự nhiên (exponential decay) kéo dài ~0.38s. Mang lại cảm giác phấn khởi, kích thích tâm lý học tập (positive reinforcement) tương tự Duolingo hay Quizlet.
- **Web Audio API thuần (Zero Latency & 100% Offline)**: Không tải file media từ mạng, độ trễ phản hồi < 5ms ngay khi người học nhấn "Check answer" hoặc phím Enter.
- **Nút bật/tắt âm thanh (Sound Toggle 🔊 / 🔇)**: Được tích hợp tinh tế trên thanh điều khiển bài tập và lưu trạng thái vào `localStorage` (`learn-fast-exercise-sound`), hỗ trợ người học tắt tiếng khi ở thư viện hay văn phòng.

---

## 2. Các Bước Đã Thực Hiện Theo Thứ Tự
1. **Xây dựng Audio Engine `frontend/lib/sound-effects.ts`**:
   - Sử dụng Web Audio API (`AudioContext`) tổng hợp âm sắc chuông "ting" 2 tầng nốt với envelope mượt mà.
   - Cơ chế tự động đánh thức (`context.resume()`) khi người dùng tương tác, tương thích với cả iOS WebKit và Android/Desktop.
   - Lưu trữ tùy chọn bật/tắt trong `localStorage` với API `useSyncExternalStore` an toàn cho SSR (không gây hydration mismatch).
2. **Tạo Component `frontend/components/shared/sound-toggle-button.tsx`**:
   - Nút bật/tắt âm thanh hiển thị trực quan (Sound ON / Sound OFF) với icon `Volume2` và `VolumeX`.
   - Khi bật lại âm thanh, phát thử một nốt "ting" nhẹ xem trước (audio preview).
3. **Tích hợp vào Giao diện Bài tập `PracticeExerciseSession`**:
   - Gọi `playSuccessSound()` trong hàm `submit` khi `graded.is_correct === true`.
   - Gọi `playSuccessSound()` trong hàm `handleOverrideAsCorrect` khi người học sửa câu trả lời thành đúng.
   - Hiển thị nút bật/tắt âm thanh ở Header trang thiết lập bài tập và ở thanh tiến trình của từng câu hỏi.
4. **Tích hợp vào Bài tập Video `VideoPractice`**:
   - Gọi `playSuccessSound()` trong `checkDictation` khi người học gõ đúng câu hoặc điền đúng từ bị ẩn.
5. **Kiểm thử Toàn Diện**:
   - Viết unit test trong `frontend/tests/sound-effects.test.mjs` (kiểm tra SSR snapshot, toggle state, subscriber, và runtime execution).
   - Chạy toàn bộ 36 bài test tự động của frontend.
   - Xác thực TypeScript (`tsc --noEmit`) đạt mã thoát 0.
   - Biên dịch Next.js production build (`npm run build`).

---

## 3. Danh Sách File Đã Tạo & Cập Nhật

| Thao tác | File Path | Mục đích |
|---|---|---|
| `[NEW]` | `frontend/lib/sound-effects.ts` | Engine âm thanh tổng hợp nốt "ting" chuông và quản lý tùy chọn âm thanh. |
| `[NEW]` | `frontend/components/shared/sound-toggle-button.tsx` | Nút bật/tắt âm thanh bài tập hỗ trợ hydration chuẩn. |
| `[MODIFY]` | `frontend/components/quick-recall/practice-exercise-session.tsx` | Tích hợp phát âm thanh khi đúng, override và nhúng nút toggle âm thanh. |
| `[MODIFY]` | `frontend/components/quick-recall/practice-exercises.module.css` | Bổ sung class `.headerTop` và `.roundModeWrap` cho layout nút toggle. |
| `[MODIFY]` | `frontend/components/video-practice/video-practice.tsx` | Tích hợp phát âm thanh khi làm đúng bài tập Dictation. |
| `[NEW]` | `frontend/tests/sound-effects.test.mjs` | 4 bài test unit kiểm thử sound-effects engine. |
| `[NEW]` | `plan/exercise-correct-answer-sound.md` | Kế hoạch chi tiết theo chuẩn AGENTS.md. |
| `[NEW]` | `guide/exercise-correct-answer-sound-guide.md` | Báo cáo và hướng dẫn trải nghiệm. |

---

## 4. Lệnh Đã Chạy & Kết Quả Kiểm Tra
1. **Kiểm tra Unit Test Sound Effects Engine**:
   ```bash
   node frontend/tests/sound-effects.test.mjs
   ```
   *Kết quả*: **Pass 4/4 tests**.
2. **Kiểm tra Toàn bộ Test Suite Frontend**:
   ```bash
   node --test frontend/tests/*.test.mjs
   ```
   *Kết quả*: **Pass 36/36 tests (100%)**.
3. **Kiểm tra Kiểu Dữ liệu TypeScript**:
   ```bash
   npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit
   ```
   *Kết quả*: **Mã thoát 0** (0 lỗi type).
4. **Biên dịch Production Next.js Build**:
   ```bash
   npm --prefix frontend run build
   ```
   *Kết quả*: Biên dịch thành công 15 static routes và dynamic routes với 0 cảnh báo.

---

## 5. Hướng Dẫn Trải Nghiệm Tính Năng
1. Truy cập vào phần bài tập của bất kỳ sheet nào (hoặc trang Demo `/demo/exercises`):
   - Ví dụ: Vào một sheet từ vựng -> Bấm **Practice Exercises** (hoặc nút **Test your recall**).
2. Chọn bất kỳ chế độ bài tập nào:
   - **Multiple Choice** (Trắc nghiệm): Chọn đáp án đúng -> Bấm **Check answer** (hoặc nhấn `Enter`) -> Âm thanh chuông **"ting"** trong trẻo, vui tai sẽ phát lên ngay lập tức!
   - **Type Translation** (Gõ dịch nghĩa): Gõ đúng từ -> Nhấn `Enter` -> Âm thanh chuông phát báo hiệu thành công.
   - **Fill in the blank** (Điền từ vào câu ví dụ): Điền đúng từ còn thiếu -> Nhấn `Enter` -> Nghe chuông "ting" chúc mừng.
   - Nếu bạn gõ câu gần đúng bị chấm sai nhưng bấm nút **"I was correct (override)"**: âm thanh chuông "ting" cũng sẽ phát lên để ghi nhận câu trả lời đúng.
3. **Nút Bật / Tắt Âm thanh**:
   - Ở góc trên màn hình bài tập có nút **Sound ON 🔊** / **Sound OFF 🔇**.
   - Bấm vào nút này để tắt âm thanh nếu muốn học trong yên lặng; trạng thái được lưu lại cho các lần học sau.

