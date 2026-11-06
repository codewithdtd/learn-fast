# Kế hoạch Triển khai: Hỗ trợ Phát Âm thanh / Phát âm Tiếng Anh trên iOS khi Bật Chế độ Im Lặng (Silent Mode / Hardware Mute Switch)

## 1. Mục tiêu
Giải quyết triệt để vấn đề thiết bị iOS (iPhone, iPad) khi bật công tắc gạt im lặng (Physical Silent Switch / Action Button / Chế độ Tập trung Focus) không thể nghe thấy âm thanh phát âm từ vựng tiếng Anh (Web Speech Synthesis / Audio Pronunciation) trên toàn bộ ứng dụng Learn-Fast:
- Đảm bảo khi người dùng chạm phát âm từng từ, cụm từ trong transcript video, từ điển, thẻ flashcard, bảng từ vựng..., âm thanh vẫn phát rõ ràng qua loa ngoài như các ứng dụng YouTube, Spotify.
- Nâng cấp Audio Session của WebKit / Safari lên category `'playback'` và mồi thông kênh phần cứng âm thanh (Hardware Media Channel Priming).
- Bổ sung cơ chế fallback âm thanh phát âm trực tuyến (Online Audio Pronunciation Fallback) bằng thẻ HTML5 `<audio>` khi Web Speech Synthesis bị Apple Safari chặn hoàn toàn trong chế độ im lặng.
- Cung cấp thông báo gợi ý tinh tế (non-intrusive hint) cho người dùng iOS nếu âm lượng phương tiện (Media Volume) đang bị chỉnh về 0%.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **`frontend/lib/speech.ts`**:
   - Tích hợp chuẩn WebKit `navigator.audioSession.type = 'playback'`.
   - Cơ chế `unlockIOSAudio()`: Kích hoạt kênh âm thanh Media thông qua thẻ HTML5 Audio phát 1 khung âm thanh câm (silent buffer), loại bỏ việc iOS xếp Web Speech vào kênh `Ambient`.
   - Lắng nghe sự kiện chạm đầu tiên của người dùng (`touchstart`, `click`, `keydown`) để tự động mở khóa (auto-prime) audio session.
   - Thêm cơ chế fallback phát âm từ vựng tiếng Anh qua luồng Audio MP3 chuẩn quốc tế (Youdao / Dict voice API) khi Web Speech API trên iOS bị hệ thống im lặng chặn.
   - Đảm bảo hàm `isIOSDevice()` nhận diện chính xác iPhone, iPad, iPod và iPadOS desktop-mode Safari (`maxTouchPoints > 1`).
2. **`frontend/components/video-practice/video-practice.tsx`**:
   - Gọi `unlockIOSAudio()` trước khi thực hiện phát âm từng từ (`speakEnglish`) hoặc phát âm thanh từ điển.
   - Bổ sung thông điệp gợi ý thân thiện cho người dùng iOS khi sử dụng tính năng phát âm: "💡 Mẹo iOS: Nếu máy đang gạt nút im lặng, âm thanh vẫn phát bình thường qua kênh Media (hãy tăng âm lượng Media nếu chưa nghe thấy)".
3. **`frontend/components/shared/audio-pronounce-button.tsx`**:
   - Sử dụng engine `speakEnglish` nâng cấp, hoạt động mượt mà không bị ngắt tiếng trên iOS Silent Mode.

### Ngoài phạm vi (Out of scope):
- Không thay đổi backend API hay schema database (thuần túy xử lý ở tầng Audio Engine và UI Client).
- Không can thiệp vào các ứng dụng hay tiến trình ngoài trình duyệt.

---

## 3. Các bước triển khai
- **Bước 1**: Nâng cấp module `frontend/lib/speech.ts`:
  - Khai báo type an toàn cho `navigator.audioSession`.
  - Viết hàm `unlockIOSAudio()` với cờ `isAudioUnlocked`.
  - Sử dụng silent WAV/MP3 data URI hợp lệ để mở kênh `AVAudioSessionCategoryPlayback`.
  - Cung cấp hàm `playAudioFallback(text, options)` khi Web Speech bị ngắt hoặc trên iOS nếu cần.
  - Tự động gắn event listener mở khóa ngay từ lần chạm đầu tiên của người dùng.
- **Bước 2**: Đồng bộ `frontend/components/shared/audio-pronounce-button.tsx` và `frontend/components/video-practice/video-practice.tsx`:
  - Đảm bảo mọi vị trí phát âm đều gọi thông qua speech engine đã được unlock.
  - Bổ sung hint thân thiện cho người dùng trên iOS.
- **Bước 3**: Chạy kiểm thử:
  - Unit tests cho video practice (`video-practice.test.mjs`).
  - TypeScript strict typecheck (`tsc --noEmit`).
  - Next.js production build (`npm run build`).
- **Bước 4**: Tạo tài liệu hướng dẫn và báo cáo kết quả trong `guide/ios-silent-mode-audio-playback-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/lib/speech.ts`: Triển khai `navigator.audioSession`, HTML5 audio priming, iOS device detection và audio fallback.
- `[MODIFY]` `frontend/components/video-practice/video-practice.tsx`: Gắn audio unlocker và mẹo hướng dẫn người dùng iOS.
- `[MODIFY]` `frontend/components/shared/audio-pronounce-button.tsx`: Tối ưu hóa kích hoạt âm thanh trên mobile touch.
- `[NEW]` `plan/ios-silent-mode-audio-playback.md`: Kế hoạch chi tiết theo quy chuẩn AGENTS.md.
- `[NEW]` `guide/ios-silent-mode-audio-playback-guide.md`: Hướng dẫn trải nghiệm và báo cáo kỹ thuật.

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Trên Safari iOS, khi iPhone bật công tắc im lặng (Silent Switch ON / Red indicator), âm thanh phát âm từ vựng tiếng Anh vẫn phát được ra loa ngoài bình thường.
2. Không gây lỗi Hydration mismatch trên Next.js (SSR snapshot trả về giá trị an toàn, chỉ chạy trên client).
3. Đạt 100% không có lỗi TypeScript (`tsc --noEmit` exit 0).
4. `npm run build` thành công, không phát sinh lỗi đóng gói hay bundle size đột biến.
5. Kiểm thử hiện có (`video-practice.test.mjs`) pass 10/10.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Chạy `node frontend/tests/video-practice.test.mjs` kiểm tra độ hồi quy các chức năng video practice.
- Chạy `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` xác thực kiểu dữ liệu TypeScript.
- Chạy `npm --prefix frontend run build` kiểm tra toàn bộ luồng biên dịch Next.js App Router.

---

## 7. Rủi ro & Edge cases
- **Khác biệt âm lượng Ringer vs Media**: Trên iOS, khi gạt nút im lặng, thanh âm lượng chuông (Ringer) về 0. Nếu người dùng cũng đang để Media volume ở 0%, họ sẽ không nghe thấy gì dù kênh đã mở -> Cần có tooltip/hint nhắc nhở người dùng tăng volume media.
- **Safari Autoplay Policy**: WebKit chỉ cho phép mở kênh âm thanh khi có tương tác người dùng (`touchstart`/`click`) -> Tất cả lệnh `play()` và `audioSession` phải nằm trong callback tương tác hoặc sau khi đã prime kênh từ cú chạm đầu tiên.

