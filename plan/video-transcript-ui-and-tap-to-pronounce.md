# Kế hoạch Cải tiến Giao diện Transcript và Tính Năng Chạm Phát Âm (Tap to Pronounce)

## 1. Mục tiêu (Objective)
Giải quyết 2 vấn đề lớn được người dùng phản ánh trong phần Luyện tập Video (`/ai-support?tab=video` và `/demo`):
1. **Khắc phục giao diện transcript xấu và rối mắt**:
   - Loại bỏ hoàn toàn giao diện "mosaic viên thuốc" thô cứng (mỗi từ bị bọc trong một button có viền dày, nền màu be `#eae3d8`, đổ bóng và gạch chân chấm chấm lộn xộn).
   - Loại bỏ cấu trúc card lồng card kép (`.segmentLine` lồng viền bên trong `.segment`).
   - Tái thiết kế giao diện transcript thành văn bản tự nhiên, thanh lịch, typography chuẩn mực (dòng chảy câu liền mạch, khoảng cách chữ tự nhiên, dấu câu gắn kết chính xác).
   - Tối ưu trạng thái dòng đang phát (`data-active="true"`) với thanh nhấn màu thương hiệu mượt mà, badge timestamp tinh tế, tự động cuộn theo video.
2. **Tính năng mới: Chạm vào từ là đọc và phát âm ngay lập tức (Tap-to-Pronounce)**:
   - Khi người dùng chạm hoặc click vào bất kỳ từ nào trong transcript, hệ thống sẽ ngay lập tức phát âm từ đó bằng Web Speech API (`speakEnglish(word, { rate: 0.88 })`).
   - Hiển thị hiệu ứng trực quan sinh động trên từ đang phát âm (highlight hiệu ứng sóng âm/pulse) để người học biết chính xác từ nào đang được đọc.
   - Đồng thời mở popup/drawer tra từ với phiên âm quốc tế (IPA), dịch nghĩa tiếng Việt và nút bấm nghe lại.
   - Bổ sung nút phát âm cho cả dòng câu và cụm từ được bôi đen (phrase selection).

---

## 2. Phạm vi thực hiện (Scope)

### Trong phạm vi (In Scope):
1. **Tái cấu trúc CSS trong `frontend/components/video-practice/video-practice.module.css`**:
   - Tách `.wordButton` hoàn toàn ra khỏi danh sách button khối (`.primary, .secondary, .playButton...`).
   - Xóa bỏ triệt để viền và nền card lồng nhau trên `.segmentLine` ở tất cả các theme (`island`, `journey`, `playful`, `dark`, `retro`).
   - Thiết kế lại `.wordButton` thành inline text tương tác mượt mà: nền trong suốt, hover pill nhẹ nhàng, active tactile scale, và trạng thái `data-speaking="true"` nổi bật.
   - Làm đẹp badge `.timestamp` thành chip nhỏ gọn, bo góc, số tabular rõ ràng.
   - Thêm nút nghe phát âm dòng câu và hiệu ứng sóng âm `pulse-speaking`.
2. **Logic phát âm tức thì trong `frontend/components/video-practice/video-practice.tsx`**:
   - Thêm state quản lý từ đang phát âm `speakingWord` và hàm `handleWordTap`.
   - Gọi `speakEnglish` với giọng đọc tiếng Anh tự nhiên ngay khi chạm từ.
   - Tích hợp `AudioPronounceButton` / speaker icon vào `lookupCard` và `phraseSelectionAction`.
   - Bổ sung hướng dẫn người dùng "Chạm vào từ để nghe phát âm ngay lập tức".
3. **Đồng bộ đa theme**:
   - Đảm bảo giao diện transcript hiển thị đẹp mắt trên cả 6 theme (`island`, `journey`, `playful`, `retro`, `dark`, `light`).

### Ngoài phạm vi (Out of Scope):
- Thay đổi logic video streaming của YouTube IFrame API hoặc server transcript fetcher.
- Thay đổi tính năng chấm điểm dictation (giữ nguyên độ chuẩn xác của unit tests).

---

## 3. Các bước triển khai (Implementation Steps)

### Bước 1: Refactor CSS `video-practice.module.css`
- Gỡ bỏ `.wordButton` khỏi selector `.primary, .secondary, .playButton, .wordButton, .modeButton`.
- Xóa bỏ các quy tắc `:global(:root[data-theme="island"]) .wordButton` và `:global(:root[data-theme="island"]) .segmentLine` gây ra lỗi viền kép và nền be viên thuốc.
- Định dạng `.segmentText` và `.wordButton`:
  - Font chữ mượt mà, `line-height: 1.65 - 1.75`.
  - `.wordButton`: `display: inline; border: none; background: transparent; padding: 1px 3px; border-radius: 6px; cursor: pointer`.
  - Hover: nền mềm `color-mix(in srgb, var(--primary) 12%, transparent)` và đổi màu chữ theo theme.
  - Active: `transform: scale(0.96)`.
  - Speaking: `background: var(--primary); color: #fff; box-shadow: 0 0 10px ...`.
- Nâng cấp `.segment`:
  - Bỏ card bên trong `.segmentLine`.
  - Dòng đang phát (`data-active="true"`): `border-left: 3.5px solid var(--primary)`, nền highlight dịu mắt.
- Nâng cấp `.timestamp`:
  - Biến thành chip thời gian bo góc `tabular-nums`, nổi bật khi segment active.

### Bước 2: Tích hợp Tính Năng Tap-to-Pronounce trong `video-practice.tsx`
- Import `speakEnglish` và `stopSpeech` từ `@/lib/speech`.
- Khai báo state: `const [speakingWord, setSpeakingWord] = useState<string | null>(null);`
- Cập nhật component `TranscriptWords`:
  - Khi click vào từ:
    1. Ngăn nổi bọt `event.stopPropagation()` (để không nhảy video nếu người dùng chỉ muốn nghe từ).
    2. Kích hoạt phát âm: `speakEnglish(value, { onStart: () => setSpeakingWord(value), onEnd: () => setSpeakingWord(null), onError: () => setSpeakingWord(null) })`.
    3. Gọi `onSelectWord(value)` để tra từ điển, hiển thị phiên âm IPA và nghĩa tiếng Việt.
  - Truyền prop `speakingWord` để gán thuộc tính `data-speaking={speakingWord === value}` lên button.
- Bổ sung nút phát âm âm thanh (loa) cho cả câu trong từng dòng segment.
- Bổ sung phát âm cho cụm từ bôi đen (`phraseSelectionAction`).

### Bước 3: Kiểm định và Tối ưu Responsive
- Đảm bảo hiển thị hoàn hảo trên Mobile: khoảng cách chạm ngón tay thoải mái, không bị chạm nhầm dấu câu, không bị giật trang khi phát âm.
- Đảm bảo chuyển đổi mượt mà giữa các chế độ Shadowing và Dictation.

---

## 4. Các file dự kiến thay đổi (Files to Modify)
- `[MODIFY]` `frontend/components/video-practice/video-practice.module.css`
- `[MODIFY]` `frontend/components/video-practice/video-practice.tsx`
- `[NEW]` `plan/video-transcript-ui-and-tap-to-pronounce.md`
- `[NEW]` `guide/video-transcript-ui-and-tap-to-pronounce-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Giao diện transcript hiển thị dạng văn bản tiếng Anh tự nhiên, thanh thoát, không còn các khối "viên thuốc" màu be viền dày thô ráp.
2. Dòng transcript đang phát có điểm nhấn rõ ràng (`border-left` màu thương hiệu, nền sáng dịu, chip thời gian nổi bật).
3. Chạm vào bất kỳ từ nào: từ đó phát âm ngay lập tức qua loa/tai nghe bằng Web Speech API giọng chuẩn.
4. Từ đang phát âm có hiệu ứng highlight visual rõ ràng.
5. Popup tra từ hiển thị đồng thời đầy đủ từ, phiên âm IPA, nghĩa tiếng Việt và nút phát lại.
6. TypeScript typecheck (`tsc --noEmit`) đạt 100% không có lỗi.
7. Unit test `video-practice.test.mjs` đạt 10/10 test cases.
8. Next.js production build (`npm run build`) thành công 100%.

---

## 6. Kế hoạch kiểm thử (Verification Plan)
- Run `node frontend/tests/video-practice.test.mjs` (kiểm tra không hồi quy logic segmentation và dictation).
- Run `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit` (kiểm tra type an toàn tuyệt đối).
- Run `npm --prefix frontend run build` (kiểm tra build production).
- Kiểm tra trực quan trên trình duyệt ở cả 6 theme (`island`, `journey`, `playful`, `retro`, `dark`, `light`) và các kích thước màn hình Mobile/Desktop.

---

## 7. Rủi ro & Edge Cases
- **Xung đột giữa Chạm từ và Tua video**: Khi click vào thẻ dòng (`segment`), video sẽ nhảy đến giây đó. Khi click vào từ, bắt buộc phải dùng `event.stopPropagation()` để việc phát âm từ không làm video bị nhảy thời gian không mong muốn.
- **Xung đột giữa Chạm từ và Bôi đen cụm từ**: Nếu người dùng quét chọn 2 từ trở lên bằng chuột hoặc ngón tay (`window.getSelection()`), hệ thống sẽ ưu tiên tính năng dịch cụm từ ("Translate selection") thay vì phát âm 1 từ đơn lẻ.
- **Trình duyệt không hỗ trợ Web Speech API**: Sử dụng fallback an toàn (vẫn tra từ và hiển thị phiên âm IPA bình thường mà không gây crash ứng dụng).

