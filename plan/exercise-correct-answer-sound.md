# Kế hoạch Triển khai: Hiệu Ứng Âm Thanh "Ting" Báo Hiệu Câu Trả Lời Đúng Trong Bài Tập

## 1. Mục tiêu
Thêm hiệu ứng âm thanh phản hồi thính giác (auditory feedback / "ting" chime sound) mỗi khi người học hoàn thành một câu hỏi bài tập và đạt kết quả đúng (hoặc chọn "Override as correct"):
- Mang lại cảm giác tưởng thưởng tâm lý (positive reinforcement), tăng hứng thú học tập và sự tập trung tương tự các nền tảng giáo dục chuẩn quốc tế (Duolingo, Quizlet).
- Tạo âm thanh dạng chuông ngân 2 nốt thăng hoa (ascending two-tone chime: G5 -> E6) với sóng âm hài hòa, trong trẻo, êm dịu, không gây chói tai hay khó chịu khi làm bài lâu.
- Tận dụng Web Audio API thuần (Zero external assets, zero bandwidth, latency < 5ms) hoạt động 100% offline và tương thích hoàn toàn với cơ chế mở khóa âm thanh trên iOS Safari.
- Cung cấp nút bật/tắt âm thanh (Sound Toggle 🔊/🔇) lưu trong `localStorage` để người dùng có thể linh hoạt tắt tiếng khi học ở nơi yên tĩnh như thư viện, văn phòng.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **Module Âm thanh Phản hồi (`frontend/lib/sound-effects.ts`)**:
   - Khởi tạo AudioContext an toàn cho SSR (không gây hydration mismatch).
   - Thiết kế hàm `playSuccessSound()` tổng hợp chuỗi dao động âm thanh 2 nốt:
     - Nốt đệm khởi đầu: G5 (783.99 Hz) thời lượng ngắn (0.06s).
     - Nốt ngân "Ting": E6 (1318.51 Hz) kết hợp sóng hài nhẹ, suy giảm theo hàm mũ (exponential decay) kéo dài 0.35s.
   - Quản lý trạng thái bật/tắt âm thanh trong `localStorage` (`learn-fast-exercise-sound`).
   - Tương thích với `unlockIOSAudio()` để phát được trên thiết bị di động iOS.
2. **Giao diện Bài tập Luyện tập (`frontend/components/quick-recall/practice-exercise-session.tsx`)**:
   - Gọi `playSuccessSound()` trong hàm `submit` khi câu trả lời được chấm đúng (`graded.is_correct === true`).
   - Gọi `playSuccessSound()` khi người học bấm nút sửa sai thành đúng (`handleOverrideAsCorrect`).
   - Thêm nút chuyển đổi âm thanh (Sound Toggle Button) tại góc điều khiển của giao diện bài tập.
3. **Bài tập Luyện tập Video (`frontend/components/video-practice/video-practice.tsx`)**:
   - Gọi `playSuccessSound()` trong `checkDictation` khi người học gõ đúng câu chính tả hoặc điền đúng toàn bộ từ còn thiếu.
4. **Kiểm thử & Báo cáo**:
   - Viết unit test trong `frontend/tests/sound-effects.test.mjs`.
   - Kiểm tra strict TypeScript (`tsc --noEmit`) và `npm run build`.
   - Tạo file hướng dẫn trong `guide/exercise-correct-answer-sound-guide.md`.

### Ngoài phạm vi (Out of scope):
- Không thay đổi backend API hay schema database.
- Không thêm âm thanh tiêu cực/tiếng còi khi trả lời sai (để tránh tạo cảm giác thất bại, áp lực tâm lý cho người học).

---

## 3. Các bước triển khai
- **Bước 1**: Xây dựng module `frontend/lib/sound-effects.ts` cung cấp bộ tổng hợp âm thanh `playSuccessSound()`, các hàm đọc/ghi tùy chọn âm thanh và hỗ trợ SSR snapshot an toàn.
- **Bước 2**: Tích hợp vào `frontend/components/quick-recall/practice-exercise-session.tsx`:
  - Kích hoạt âm thanh khi `graded.is_correct` hoặc override.
  - Đặt nút bật/tắt âm thanh tinh tế trên thanh điều khiển.
- **Bước 3**: Tích hợp vào `frontend/components/video-practice/video-practice.tsx` cho phần bài tập Dictation.
- **Bước 4**: Viết unit test cho module `sound-effects.ts` và chạy toàn bộ test suite.
- **Bước 5**: Kiểm tra TypeScript, Next.js production build, và lưu tài liệu hướng dẫn trong `guide/`.

---

## 4. Các file / module dự kiến thay đổi
- `[NEW]` `frontend/lib/sound-effects.ts`
- `[MODIFY]` `frontend/components/quick-recall/practice-exercise-session.tsx`
- `[MODIFY]` `frontend/components/quick-recall/practice-exercises.module.css`
- `[MODIFY]` `frontend/components/video-practice/video-practice.tsx`
- `[NEW]` `frontend/tests/sound-effects.test.mjs`
- `[NEW]` `plan/exercise-correct-answer-sound.md`
- `[NEW]` `guide/exercise-correct-answer-sound-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Khi làm bài tập (Multiple Choice, Type Translation, Cloze, Dictation) và nộp đáp án đúng: phát ra âm thanh "ting" chuông êm dịu, rõ ràng.
2. Khi chọn nút "I was correct (override)": phát âm thanh "ting" tương ứng.
3. Có nút bật/tắt âm thanh (🔊/🔇) hiển thị trực quan và lưu trạng thái vào `localStorage`.
4. Không gây lỗi khi trình duyệt chặn Web Audio hoặc chạy trên SSR (không Hydration Mismatch).
5. 100% test passing, `tsc --noEmit` exit 0, Next.js build thành công.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy unit tests: `node frontend/tests/sound-effects.test.mjs`.
- Chạy toàn bộ test suites: `node --test frontend/tests/*.test.mjs`.
- Chạy TypeScript strict check: `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`.
- Chạy Next.js production build: `npm --prefix frontend run build`.

---

## 7. Rủi ro & Edge cases
- **Chính sách Autoplay của trình duyệt**: Web Audio API yêu cầu tương tác người dùng để resume AudioContext. Do người dùng nhấn nút "Check answer", nhấn Enter hoặc chạm vào màn hình để nộp bài, cử chỉ này tự động cấp quyền phát âm thanh.
- **Tần suất âm thanh**: Nếu người dùng làm bài liên tục rất nhanh, các nốt âm thanh cần tự ngắt kết nối (`oscillator.onended`) để tránh rò rỉ bộ nhớ AudioContext nodes.
