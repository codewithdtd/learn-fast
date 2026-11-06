# Hướng Dẫn & Báo Cáo Cải Tiến Giao Diện Transcript & Tính Năng Chạm Phát Âm

## 1. Các bước đã thực hiện theo thứ tự (Execution Steps)

1. **Phân tích hình ảnh thực tế và điều tra nguyên nhân gốc rễ**:
   - Từ ảnh chụp màn hình do người dùng cung cấp (`media_1793947731378_916b264f.png`), phát hiện 3 lớp lỗi CSS lồng nhau khiến transcript trông như một bàn phím viên thuốc thô ráp:
     - Lớp 1: `.segmentLine` bị gán viền kép (`border: 1.5px solid #d4c7b2`) và nền lồng bên trong thẻ `.segment`.
     - Lớp 2: `.wordButton` bị gom nhóm sai vào danh sách button khối 44px (`.primary, .secondary, .playButton, .wordButton...`) và bị ép style theme Cozy Island (`border: 1.5px solid #d4c7b2`, `background: #eae3d8`, `box-shadow: 0 2px 0 #c7bca8`).
     - Lớp 3: Dấu gạch chân chấm chấm (`dotted underline`) dày đặc trên từng chữ làm nát bố cục đọc tiếng Anh tự nhiên.
2. **Tái thiết kế toàn diện CSS Transcript (`video-practice.module.css`)**:
   - Tách `.wordButton` hoàn toàn khỏi các quy tắc button khối.
   - Chuyển đổi `.wordButton` thành inline text tự nhiên: nền trong suốt, không viền, `line-height: 1.72`, `font-size: 1.05rem`.
   - Bổ sung hiệu ứng hover pill tinh tế (`color-mix(in srgb, var(--primary) 14%, transparent)`), hiệu ứng active tactile press (`scale(0.96)`).
   - Thiết kế trạng thái phát âm `data-speaking="true"` với nền primary rực rỡ và animation `pulse-speaking` trực quan.
   - Nâng cấp `.segment`: loại bỏ viền lồng bên trong `.segmentLine`, bổ sung viền nhấn `border-left: 3.5px solid var(--primary)` cho dòng đang phát (`data-active="true"`).
   - Nâng cấp `.timestamp` thành chip bo góc gọn gàng với phông số cố định (`tabular-nums`), chuyển màu tương ứng khi dòng được kích hoạt.
3. **Phát triển tính năng Chạm Phát Âm (Tap-to-Pronounce)**:
   - Thêm state `speakingWord` quản lý từ đang được đọc bằng Web Speech API.
   - Viết hàm `handleWordTap`:
     1. Ngay lập tức gọi `speakEnglish(word, { rate: 0.88 })` với giọng đọc tiếng Anh chuẩn, rõ ràng, tốc độ vừa phải cho người học.
     2. Đánh dấu trạng thái `data-speaking="true"` trên từ đang phát âm để tạo hiệu ứng sóng âm/glow.
     3. Tự động mở drawer/card tra từ vựng (`lookupCard`) hiển thị từ, phiên âm quốc tế (IPA), bản dịch tiếng Việt và định nghĩa.
   - Thêm nút phát âm nhanh cho cả câu (`.linePronounceBtn`) cạnh nút dịch câu.
   - Thêm nút nghe phát âm cho cụm từ bôi đen (`phraseSelectionAction`).
   - Thêm nút loa tròn chuyên dụng (`.pronounceButton`) trong phần tiêu đề tra từ vựng.
4. **Kiểm tra tự động toàn diện**:
   - Chạy 10/10 unit tests `video-practice.test.mjs` (pass 100%).
   - Chạy TypeScript strict typecheck `tsc --noEmit` (pass 100%, 0 errors).
   - Chạy Turbopack production build `npm run build` (pass 100%, 13/13 routes).

---

## 2. Danh sách File / Module đã tạo và cập nhật

- `[MODIFY]` [frontend/components/video-practice/video-practice.module.css](file:///e:/study/learn-fast/frontend/components/video-practice/video-practice.module.css): Xóa bỏ các viền/nền viên thuốc thô kệch, tái thiết kế typography tự nhiên, chip thời gian, nút phát âm cả dòng và hiệu ứng sóng âm `pulse-speaking`.
- `[MODIFY]` [frontend/components/video-practice/video-practice.tsx](file:///e:/study/learn-fast/frontend/components/video-practice/video-practice.tsx): Tích hợp tính năng Tap-to-Pronounce ngay khi chạm từ, nút phát âm toàn dòng, phát âm cụm từ chọn lọc và fix type an toàn.
- `[NEW]` [plan/video-transcript-ui-and-tap-to-pronounce.md](file:///e:/study/learn-fast/plan/video-transcript-ui-and-tap-to-pronounce.md): Kế hoạch thực hiện.
- `[NEW]` [guide/video-transcript-ui-and-tap-to-pronounce-guide.md](file:///e:/study/learn-fast/guide/video-transcript-ui-and-tap-to-pronounce-guide.md): Báo cáo & hướng dẫn sử dụng.

---

## 3. Lệnh đã chạy và kết quả kiểm tra

| Lệnh kiểm tra | Kết quả | Trạng thái |
| :--- | :--- | :--- |
| `node frontend/tests/video-practice.test.mjs` | 10/10 subtests passed (18ms) | ✅ PASS |
| `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` | Exit code 0, 0 lỗi TypeScript | ✅ PASS |
| `npm --prefix frontend run build` | Turbopack build thành công 13/13 routes (11.9s) | ✅ PASS |

---

## 4. Lỗi đã gặp & Cách xử lý (Troubleshooting Log)

1. **Lỗi `title={transcript.title}` type mismatch**:
   - *Triệu chứng*: `tsc` báo lỗi `Type 'string | null' is not assignable to type 'string | undefined'`.
   - *Nguyên nhân*: API `VideoTranscript` định nghĩa `title` có thể nhận `null`, trong khi React JSX `title` prop yêu cầu `string | undefined`.
   - *Giải pháp*: Sử dụng nullish coalescing `title={transcript.title ?? undefined}` và fallback hiển thị `{transcript.title ?? "YouTube Video"}`.
2. **Lỗi `Property 'language' does not exist on type 'VideoTranscript'`**:
   - *Triệu chứng*: `tsc` báo lỗi không tìm thấy thuộc tính `language`.
   - *Nguyên nhân*: Trong `VideoTranscript` tại `services/api.ts`, trường này có tên là `language_code`.
   - *Giải pháp*: Cập nhật thành `transcript.language_code?.toUpperCase()`.

---

## 5. Hướng dẫn trải nghiệm tính năng trên trình duyệt

1. **Truy cập trang Luyện tập Video**:
   - Chạy `npm --prefix frontend run dev` hoặc script `dev.bat`.
   - Truy cập `http://localhost:3000/ai-support?tab=video` (hoặc `/demo` chọn tab Video).
2. **Tải một video mẫu hoặc dán link YouTube**:
   - Dán một link YouTube có phụ đề tiếng Anh (hoặc dùng video mẫu có sẵn).
   - Nhấn **Load video**.
3. **Chiêm ngưỡng giao diện Transcript mới**:
   - Các câu transcript hiển thị dạng đoạn văn tiếng Anh tự nhiên, font chữ thanh thoát (17px), khoảng cách dòng thoáng (line-height 1.72), không còn bất kỳ viền viên thuốc màu be thô ráp nào.
   - Chip thời gian (ví dụ `0:12`) hiển thị tinh tế ở đầu dòng, tự động đổi màu khi video phát đến đoạn đó.
   - Dòng đang phát (`data-active`) có dải màu nhấn thương hiệu `border-left` nổi bật và nền sáng nhẹ nhàng.
4. **Trải nghiệm tính năng Chạm Phát Âm (Tap-to-Pronounce)**:
   - **Chạm/Click vào bất kỳ từ nào** (ví dụ: `Orienteering`, `participants`, `compasses`):
     - Hệ thống sẽ **ngay lập tức phát âm từ đó qua loa/tai nghe** với giọng đọc chuẩn xác (Web Speech API).
     - Từ đang phát âm sẽ sáng lên với hiệu ứng màu primary và sóng âm nhẹ.
     - Cùng lúc đó, bảng tra từ vựng (`lookupCard`) ở cột bên cạnh sẽ tự động mở ra, hiển thị từ vựng kèm **phiên âm quốc tế (IPA)** (ví dụ `· /ˌtʃæm.pi.ən.ʃɪp/`), nghĩa tiếng Việt và nút loa để bấm nghe lại bất cứ lúc nào.
   - **Nghe phát âm cả dòng câu**:
     - Bấm vào biểu tượng loa nhỏ bên cạnh nút dịch ở từng dòng transcript để nghe đọc toàn bộ câu bằng giọng đọc rõ ràng, tốc độ vừa phải.
   - **Nghe phát âm cụm từ tự chọn**:
     - Quét chọn (bôi đen) 2-3 từ liên tiếp: thanh công cụ sẽ xuất hiện với 2 nút: **Listen** (nghe phát âm cả cụm) và **Translate selection** (dịch cụm từ).
