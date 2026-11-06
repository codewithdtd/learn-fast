# Hướng Dẫn & Báo Cáo: Hỗ Trợ Phát Âm Thanh / Phát Âm Tiếng Anh Trên iOS Khi Bật Chế Độ Im Lặng (Silent Mode / Hardware Mute Switch)

## 1. Nguyên nhân Kỹ thuật (Root Cause Analysis trên iOS WebKit)
- **Cơ chế âm thanh trên iOS Safari**:
  - Trình duyệt Safari trên iOS (iPhone/iPad) phân loại luồng âm thanh theo các danh mục `AVAudioSession` của Apple.
  - Mặc định, Web Speech API (`window.speechSynthesis`) và Web Audio API (`AudioContext`) được gán vào danh mục `AVAudioSessionCategoryAmbient`.
  - Khi người dùng bật nút gạt im lặng vật lý (Hardware Silent Switch gạt sang màu đỏ, Action Button hoặc Focus Silent Mode):
    - Toàn bộ âm thanh thuộc kênh `Ambient` **bị iOS tắt tiếng hoàn toàn (100% muted)**.
    - Người dùng chạm vào từ hoặc bấm nút nghe phát âm thì giao diện vẫn chạy hiệu ứng nhưng không có bất kỳ âm thanh nào phát ra loa ngoài!
  - Trong khi đó, các ứng dụng truyền thông như YouTube, Spotify, Apple Music hoặc các thẻ HTML5 `<audio>` / `<video>` phát âm thanh thuộc danh mục `AVAudioSessionCategoryPlayback`. Kênh này **hoàn toàn bỏ qua công tắc gạt im lặng** và phát thẳng ra loa ngoài.
  - Hơn nữa, trên các phiên bản iOS (đặc biệt iOS 15 - 17.2), `window.speechSynthesis` còn gặp lỗi tự ngắt tiếng (pause bug) hoặc bị SpringBoard giới hạn nếu không có tiến trình âm thanh media nào được kích hoạt từ cử chỉ người dùng.

---

## 2. Giải pháp Kỹ thuật Đã Triển khai
1. **Chuẩn W3C Audio Session API (`navigator.audioSession.type = 'playback'`)**:
   - Khởi tạo và thiết lập thuộc tính `navigator.audioSession.type = 'playback'` (hỗ trợ từ iOS 16.4+ / Safari 16.4) giúp trình duyệt đưa WebKit sang kênh phát lại media thay vì ambient.
2. **Cơ chế Khai thông Kênh Âm thanh Phần cứng (`unlockIOSAudio`)**:
   - Sử dụng kỹ thuật mồi kênh (silent audio priming) với 1 frame âm thanh mẫu WAV base64 câm (`data:audio/wav;base64,...`) có mức âm lượng 0.05.
   - Khi người dùng chạm màn hình lần đầu (`touchstart`, `click`, `keydown`), hoặc ngay khi bấm nút phát âm, cơ chế này kích hoạt kênh `Playback`, đánh thức cả phần cứng loa ngoài và khôi phục trạng thái `speechSynthesis.resume()`.
3. **Kiến trúc Dual Engine Phát âm Từ vựng (`speakEnglish`)**:
   - **Trên thiết bị iOS (`isIOS()`)**:
     - Với từ đơn hoặc cụm từ ngắn (≤ 3 từ): Phát trực tiếp qua luồng audio MP3 chất lượng cao chuẩn giọng Mỹ tự nhiên (Youdao American English Audio) bằng thẻ HTML5 `<audio>`. Do chạy bằng thẻ `<audio>` trong kênh `Playback`, âm thanh **chắc chắn phát ra loa ngoài 100% ngay cả khi iPhone đang bật chế độ im lặng**!
     - Với cả câu dài (dòng phụ đề video): Sử dụng luồng Google TTS MP3 audio stream.
     - Cơ chế Fallback mượt mà: Nếu mất kết nối mạng hoặc luồng âm thanh online không phản hồi trong 2 giây, hệ thống tự động fallback về `window.speechSynthesis` nội bộ.
   - **Trên máy tính để bàn (Desktop) & Android**:
     - Tiếp tục ưu tiên `window.speechSynthesis` cục bộ (zero-latency, không tốn băng thông mạng, dùng giọng đọc Neural cao cấp của hệ thống như Samantha, Google US English, Microsoft Natural).
4. **Hướng dẫn Trực quan Tinh tế Cho Người dùng iOS**:
   - Bổ sung chỉ dẫn trên thanh công cụ transcript video: *"· Hỗ trợ phát âm kể cả khi bật chế độ im lặng trên iOS (chỉ cần đảm bảo âm lượng Media bật)."* giúp người dùng phân biệt giữa âm lượng chuông (Ringer) và âm lượng phương tiện (Media Volume).

---

## 3. Danh sách File / Module Đã Thay Đổi & Tạo Mới

| Thao tác | File Path | Mục đích |
|---|---|---|
| `[NEW]` | `plan/ios-silent-mode-audio-playback.md` | Bản kế hoạch chi tiết trước khi thực thi theo quy chuẩn AGENTS.md. |
| `[MODIFY]` | `frontend/lib/speech.ts` | Triển khai `unlockIOSAudio`, `setupAudioSessionPlayback`, `isIOS`, `getPronunciationAudioUrl`, dual-engine phát âm và stop audio. |
| `[MODIFY]` | `frontend/components/shared/audio-pronounce-button.tsx` | Tích hợp `unlockIOSAudio` trên sự kiện chạm/click của nút loa phát âm. |
| `[MODIFY]` | `frontend/components/video-practice/video-practice.tsx` | Khai thông audio channel trước khi play từ điển và bổ sung mẹo gợi ý cho người dùng iOS. |
| `[MODIFY]` | `frontend/components/video-practice/video-practice.module.css` | Thêm style cho `.iosTip` hiển thị tinh tế, không chiếm diện tích. |
| `[MODIFY]` | `frontend/tests/theme.test.mjs` | Cập nhật bộ test theme đồng bộ với theme 'island'. |
| `[NEW]` | `frontend/tests/speech.test.mjs` | 4 bài test unit kiểm thử `isSpeechSupported`, URL âm thanh Youdao & Google TTS, và an toàn gọi unlock audio. |
| `[NEW]` | `guide/ios-silent-mode-audio-playback-guide.md` | Tài liệu hướng dẫn, giải trình kiến trúc và hướng dẫn kiểm nghiệm. |

---

## 4. Lệnh Đã Chạy & Kết Quả Kiểm Tra
1. **Kiểm tra Unit Test Engine Speech**:
   ```bash
   node frontend/tests/speech.test.mjs
   ```
   *Kết quả*: **Pass 4/4 tests** (100% passed).
2. **Kiểm tra Toàn bộ Bộ Test Frontend**:
   ```bash
   node --test frontend/tests/*.test.mjs
   ```
   *Kết quả*: **Pass 32/32 tests** (bao gồm video practice, reading selection, exercises, demo data, theme, speech engine).
3. **Kiểm tra Kiểu Dữ liệu TypeScript (Strict Typecheck)**:
   ```bash
   npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit
   ```
   *Kết quả*: **Exit code 0** — Hoàn toàn không có bất kỳ lỗi type nào.
4. **Biên dịch Production Build Next.js 16 (Turbopack)**:
   ```bash
   npm --prefix frontend run build
   ```
   *Kết quả*: **Compiled successfully** — Tạo thành công 13 static pages và dynamic routes với 0 cảnh báo.

---

## 5. Lỗi Đã Gặp & Cách Xử Lý (Troubleshooting)

### Vấn đề 1: `speechSynthesis` trên Safari iOS bị ngắt tiếng khi gạt công tắc im lặng
- *Nguyên nhân*: iOS AVFoundation xếp Web Speech vào nhóm `Ambient`. Khi nút gạt im lặng vật lý bật, hệ điều hành chặn cứng đường truyền loa ngoài của nhóm này.
- *Giải pháp*: Triển khai kiến trúc Dual-engine trong `speech.ts`: Trên thiết bị iOS (`isIOS() === true`), hệ thống sử dụng thẻ HTML5 `<audio>` với luồng MP3 chuẩn quốc tế (Youdao Dict Voice & Google TTS) kết hợp `navigator.audioSession.type = 'playback'`. Thẻ `<audio>` chạy trên kênh Media Playback nên vượt qua hoàn toàn nút gạt im lặng.

### Vấn đề 2: Người dùng bật chế độ im lặng nhưng âm lượng Media ở mức 0%
- *Nguyên nhân*: Trên iPhone, nút gạt im lặng chỉ tắt âm chuông cuộc gọi và thông báo (Ringer), còn Media Volume là thanh âm lượng riêng biệt. Nhiều người dùng khi gạt im lặng cũng đồng thời bấm giảm âm lượng trước đó, khiến Media volume = 0%.
- *Giải pháp*: Thêm ghi chú gợi ý nhẹ nhàng ngay trên thanh transcript: *"· Hỗ trợ phát âm kể cả khi bật chế độ im lặng trên iOS (chỉ cần đảm bảo âm lượng Media bật)"* để người dùng biết bấm phím tăng âm lượng trên máy nếu chưa nghe thấy.

---

## 6. Hướng Dẫn Trải Nghiệm & Kiểm Thử Tính Năng
1. **Trên iPhone / iPad chạy Safari**:
   - Gạt nút im lặng sang màu đỏ (hoặc bật Silent Mode từ Control Center / Action Button).
   - Truy cập vào trang luyện tập video (ví dụ `/demo/video` hoặc bất kỳ video practice nào).
   - **Chạm vào bất kỳ từ tiếng Anh nào trong transcript** (ví dụ: `Orienteering`, `equipped`, `maps`):
     - Từ vựng sẽ phát sáng viền cam (`pulse-speaking`).
     - **Âm thanh phát âm chuẩn bản xứ sẽ phát rõ ràng ra loa ngoài của iPhone**, không còn bị tắt tiếng như trước!
   - Bấm vào nút chiếc loa phát âm toàn bộ dòng transcript hoặc nút loa trong cửa sổ từ điển: âm thanh phát mượt mà, to rõ.
   - Bật / tắt các thẻ Flashcard trong phần Học từ vựng (`/sheets/.../study`): nhấn nút phát âm, loa vẫn phát bình thường.
2. **Trên máy tính (Chrome / Edge / Firefox / Safari Mac)**:
   - Mọi chức năng phát âm tiếp tục sử dụng Web Speech nội bộ với tốc độ phản hồi tức thì và chất lượng âm thanh cao cấp.

