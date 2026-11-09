# Kế hoạch Triển khai: Tối Ưu Hóa Chu Trình Ngủ & Thức Tự Nhiên Của Máy Chủ Render (Không Dùng 24/7)

## 1. Mục tiêu
Người dùng yêu cầu:
- **Tắt chức năng bật 24/7**: Không giữ server thức liên tục 24/7 để tiết kiệm hạn ngạch 750 giờ miễn phí/tháng của Render Free Tier.
- **Xử lý triệt để hiện tượng server "down hoài luôn phải redeploy nó mới tỉnh"**:
  1. Loại bỏ vòng lặp ngắt kết nối (Abort Loop) 3.5 giây ở frontend (`pingBackendHealth` và `startup-warmup-countdown.tsx`). Hiện tại frontend liên tục gửi request và hủy sau 3.5 giây, trong khi Render Cold Start cần 45-60 giây. Việc này khiến Render proxy bị dồn connection abort, frontend không bao giờ nhận được kết quả thức dậy và màn hình đếm ngược bị treo đơ ở mốc 0 giây.
  2. Triển khai cơ chế giữ kết nối dài (Long-lived Wakeup Connection 65s): Gửi 1 kết nối duy nhất kiên nhẫn chờ Render thức dậy và chuyển tiếp ngay khi server online.
  3. Bổ sung cơ chế thoát treo khi đồng hồ đếm ngược về 0 giây (nút Thử lại / Tải lại trang).
  4. Hướng dẫn chi tiết cách cấu hình Render Dashboard để tránh bị Render Health Check kill tiến trình.

---

## 2. Phạm vi thực hiện
### Trong phạm vi (In-scope):
1. **`frontend/services/api.ts`**:
   - Nâng timeout mặc định của `pingBackendHealth` lên 65000ms (65 giây) để phù hợp với chu kỳ khởi động thực tế của Render Free Tier.
2. **`frontend/components/shared/startup-warmup-countdown.tsx`**:
   - Tránh spam request lặp lại khi đang có 1 probe inflight.
   - Bổ sung trạng thái xử lý khi `secondsLeft === 0` (hiển thị nút thử lại ngay và tải lại trang, không bị đứng đơ).
3. **Kiểm thử**:
   - Chạy toàn bộ test suite frontend và backend health checks.
4. **Tài liệu**:
   - `plan/render-sleep-and-cold-start-fix.md`
   - `guide/render-sleep-and-cold-start-fix-guide.md`

### Ngoài phạm vi (Out of scope):
- Không thay đổi schema cơ sở dữ liệu hay logic nghiệp vụ học tập.

---

## 3. Các bước triển khai
- **Bước 1**: Tạo file `plan/render-sleep-and-cold-start-fix.md`.
- **Bước 2**: Chỉnh sửa `frontend/services/api.ts` tăng timeout cho `pingBackendHealth`.
- **Bước 3**: Cập nhật `frontend/components/shared/startup-warmup-countdown.tsx` tối ưu cơ chế thăm dò không spam/không abort sớm.
- **Bước 4**: Chạy kiểm thử frontend và backend.
- **Bước 5**: Viết tài liệu cẩm nang `guide/render-sleep-and-cold-start-fix-guide.md`.

---

## 4. Các file / module dự kiến thay đổi
- `[MODIFY]` `frontend/services/api.ts`
- `[MODIFY]` `frontend/components/shared/startup-warmup-countdown.tsx`
- `[NEW]` `plan/render-sleep-and-cold-start-fix.md`
- `[NEW]` `guide/render-sleep-and-cold-start-fix-guide.md`

---

## 5. Tiêu chí hoàn thành (Definition of Done)
1. Frontend kiên nhẫn chờ Render thức dậy tự nhiên mà không gửi request rác hoặc hủy ngang giữa chừng.
2. Màn hình đếm ngược không bao giờ bị đơ/treo vĩnh viễn ở 0 giây.
3. Không có bất kỳ tiến trình 24/7 ngầm nào chạy trong backend.
4. 100% tests pass.
