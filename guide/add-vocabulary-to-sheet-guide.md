# Hướng Dẫn & Báo Cáo Triển Khai: Chức Năng Thêm Từ Vựng Thủ Công Cho Từng Sheet (Add Flashcard to Sheet)

## 1. Các Bước Đã Thực Hiện Theo Thứ Tự

### 1.1. Tầng Backend & Phân Quyền Multi-tenancy (IDOR Protection)
- **Cập nhật Schema WorkbookReference**: Bổ sung trường `user_id: int | None = None` vào [workbook.py](file:///e:/study/learn-fast/backend/app/schemas/workbook.py) để trả về thông tin chủ sở hữu workbook trong `SheetDetail`.
- **Mở rộng phân quyền endpoint thêm từ vựng**:
  - Tại [flashcards.py](file:///e:/study/learn-fast/backend/app/api/flashcards.py), thay thế phụ thuộc cứng `get_current_admin` bằng `get_current_user` và bổ sung hàm kiểm tra quyền `ensure_sheet_mutable`.
  - **Quy tắc bảo mật**:
    - Quản trị viên (`current_user.is_superuser`): Có quyền thêm từ vào bất kỳ sheet nào.
    - Chủ sở hữu Workbook (`sheet.workbook.user_id == current_user.id`): Có quyền thêm từ vào các sheet thuộc workbook riêng của mình.
    - Người dùng khác hoặc khách vãng lai: Bị chặn an toàn với mã lỗi `403 Forbidden` hoặc `401 Unauthorized`.
- **Bổ sung kiểm thử backend**:
  - Trong [test_flashcard_api.py](file:///e:/study/learn-fast/backend/tests/test_flashcard_api.py), thêm test case `test_owner_can_add_words_to_own_private_sheet_and_other_users_are_forbidden` xác minh cả chiều thêm thành công lẫn chiều ngăn chặn truy cập trái phép.

### 1.2. Tầng Frontend Client Service & Types
- Trong [api.ts](file:///e:/study/learn-fast/frontend/services/api.ts):
  - Cập nhật định nghĩa kiểu `SheetDetail` có trường `workbook: { id: number; name: string; user_id?: number | null }`.
  - Cập nhật hàm `createFlashcardInSheet` nhận cả tham số `example_vi?: string` (câu dịch ví dụ tiếng Việt).

### 1.3. Xây Dựng Component Modal Thêm Từ Vựng (`AddFlashcardModal`)
- Tạo mới [add-flashcard-modal.tsx](file:///e:/study/learn-fast/frontend/components/sheets/add-flashcard-modal.tsx):
  - Hỗ trợ các trường:
    - *English Phrase / Word* (`phrase` - bắt buộc, tối đa 200 ký tự).
    - *Vietnamese Meaning* (`meaning` - bắt buộc, tối đa 600 ký tự).
    - *English Example* (`example_en` - tùy chọn, tối đa 2000 ký tự).
    - *Vietnamese Translation* (`example_vi` - tùy chọn, tối đa 2000 ký tự).
  - Tích hợp chuẩn trợ năng WCAG AA: Focus trap, phím tắt `Escape` để đóng, autofocus trường từ vựng.
  - Tùy chọn **"Add another word after saving"** (Thêm tiếp từ khác sau khi lưu): Giúp người học có thể liên tục nạp nhiều từ vựng một cách mượt mà mà không phải mở lại modal nhiều lần.
  - Bắt lỗi thông minh:
    - Báo lỗi trùng từ (HTTP 409): "This word or phrase already exists in this sheet."
    - Báo lỗi quyền hạn (HTTP 403): "You do not have permission to add words to this sheet."

### 1.4. Tích Hợp Vào Giao Diện Quản Lý Từ Vựng
- **Trang Table View** ([table-view-page.tsx](file:///e:/study/learn-fast/frontend/components/sheets/table-view-page.tsx)):
  - Thêm nút `+ Add Word` trên thanh tiêu đề `TableViewHeader` cho người có quyền quản lý sheet (`canManage = isAdmin || isOwner`).
  - Thêm nút `+ Add first word` ngay trong màn hình rỗng (`TableViewMessage`) khi sheet mới tạo chưa có từ nào.
  - Cập nhật state `cards` và `card_count` lập tức sau khi thêm từ thành công.
  - Mở rộng quyền sửa (`persistCardContent`) và xóa (`removeFlashcard`) cho chủ sở hữu workbook thay vì chỉ có admin.
- **Trang Chi Tiết Sheet** ([sheet-detail.tsx](file:///e:/study/learn-fast/frontend/components/sheets/sheet-detail.tsx)):
  - Bổ sung `ActionButtonCard` "Add Vocabulary" vào lưới chế độ học tập để người dùng có thể nạp từ mới trực tiếp ngay khi đang xem tổng quan sheet.

---

## 2. Danh Sách File / Module Đã Tạo và Cập Nhật

| File | Trạng thái | Mô tả chi tiết |
| :--- | :--- | :--- |
| `plan/add-vocabulary-to-sheet.md` | `[NEW]` | Kế hoạch chi tiết theo chuẩn `AGENTS.md`. |
| `backend/app/schemas/workbook.py` | `[MODIFY]` | Bổ sung `user_id` vào schema `WorkbookReference`. |
| `backend/app/api/flashcards.py` | `[MODIFY]` | Thay `get_current_admin` bằng `get_current_user` + `ensure_sheet_mutable`. |
| `backend/tests/test_flashcard_api.py` | `[MODIFY]` | Thêm test case xác minh quyền thêm từ của Owner và chặn Stranger. |
| `frontend/services/api.ts` | `[MODIFY]` | Cập nhật kiểu `SheetDetail` và chữ ký `createFlashcardInSheet`. |
| `frontend/components/sheets/add-flashcard-modal.tsx` | `[NEW]` | Component modal nhập từ vựng kèm tính năng thêm tiếp nhiều từ. |
| `frontend/components/sheets/table-view-page.tsx` | `[MODIFY]` | Tích hợp nút `+ Add Word`, `+ Add first word`, và gắn modal. |
| `frontend/components/sheets/sheet-detail.tsx` | `[MODIFY]` | Bổ sung `ActionButtonCard` "Add Vocabulary" và gắn modal. |
| `frontend/tests/add-flashcard.test.mjs` | `[NEW]` | Unit test kiểm thử chuẩn hóa dữ liệu thẻ và phân quyền. |
| `guide/add-vocabulary-to-sheet-guide.md` | `[NEW]` | Báo cáo và hướng dẫn chi tiết theo chuẩn `AGENTS.md`. |

---

## 3. Lệnh Đã Chạy và Kết Quả Kiểm Tra

### 3.1. Kiểm Thử Backend (Pytest)
```powershell
backend\.venv\Scripts\pytest.exe backend/tests/test_flashcard_api.py
```
**Kết quả:**
- **8/8 passed** (100% pass rate).
- Bao gồm kiểm tra: Thêm từ vựng thành công không đổi trạng thái SRS, chặn khách vãng lai (401), chặn tài khoản khác trên sheet riêng (403), chống trùng từ (409), kiểm tra payload rỗng (422), và chủ sở hữu thêm từ vào sheet của mình (201).

### 3.2. Kiểm Thử Frontend Unit Tests
```bash
node --test frontend/tests/*.test.mjs
```
**Kết quả:**
- **48/48 passed** (100% pass rate).
- Bao gồm 4 subtest mới kiểm tra việc trim khoảng trắng, chuyển đổi ví dụ rỗng về `undefined`, từ chối từ trống và phân quyền `canUserManageSheet`.

### 3.3. Kiểm Tra Kiểu Dữ Liệu TypeScript
```powershell
cd frontend; npx tsc --noEmit
```
**Kết quả:**
- Hoàn thành với mã thoát `0`, không có bất kỳ lỗi TypeScript nào.

---

## 4. Lỗi Đã Gặp & Cách Xử Lý

1. **Khởi tạo đối tượng model Workbook trong bài test:**
   - *Lỗi*: `TypeError: 'is_showcase' is an invalid keyword argument for Workbook` và `AttributeError: type object 'SheetPriority' has no attribute 'NORMAL'`.
   - *Nguyên nhân*: Model `Workbook` trong cơ sở dữ liệu không dùng cột `is_showcase`, và enum `SheetPriority` sử dụng các giá trị `HIGH`, `MEDIUM`, `LOW`.
   - *Giải pháp*: Cập nhật fixture test sử dụng đúng các thuộc tính chuẩn: `Workbook(name=..., user_id=..., original_filename="owner.xlsx", sheet_count=1, total_cards=0)` và `SheetPriority.MEDIUM`.

2. **Chênh lệch kiểu dữ liệu `sheetId` giữa các trang:**
   - *Lỗi*: `sheet-detail.tsx(260,11): error TS2322: Type 'number' is not assignable to type 'string'`.
   - *Nguyên nhân*: Trang `table-view-page.tsx` nhận `sheetId` từ URL dạng `string`, trong khi `sheet.id` trong đối tượng `SheetDetail` là `number`.
   - *Giải pháp*: Cho phép `AddFlashcardModalProps` nhận `sheetId: string | number` và chuyển đổi sang `String(sheetId)` trước khi gửi API request.

---

## 5. Hướng Dẫn Trải Nghiệm / Sử Dụng Tính Năng

1. **Thêm từ vựng từ trang Table View:**
   - Truy cập vào một sheet bất kỳ mà bạn sở hữu (hoặc tài khoản admin): ví dụ vào `/workbooks` -> chọn Workbook -> bấm vào Sheet -> chọn **Table View** (hoặc truy cập trực tiếp `/sheets/[sheetId]/table`).
   - Ở góc trên bên phải, bên cạnh nút *"Study Deck"*, bạn sẽ thấy nút **"+ Add Word"**.
   - Nếu sheet hoàn toàn chưa có từ vựng nào, màn hình sẽ hiển thị nút nổi bật **"+ Add first word"**.
   - Bấm vào nút để mở hộp thoại:
     - Nhập từ tiếng Anh (ví dụ: `serendipity`).
     - Nhập nghĩa tiếng Việt (ví dụ: `sự may mắn tình cờ`).
     - (Tùy chọn) Nhập câu ví dụ tiếng Anh và dịch tiếng Việt.
     - Tích chọn *"Add another word after saving"* nếu bạn muốn nhập liên tiếp nhiều từ mà không cần đóng mở lại popup.
     - Bấm **"Save Word"**. Từ mới sẽ lập tức xuất hiện trong bảng và số lượng thẻ tăng lên mà không cần tải lại trang.

2. **Thêm từ vựng từ trang Chi tiết Sheet (Sheet Detail):**
   - Vào trang chi tiết sheet (`/sheets/[sheetId]`).
   - Trong khu vực **"Learning modes"** (Các chế độ học tập), bên cạnh các thẻ bài tập, bạn sẽ thấy thêm thẻ **"Add Vocabulary"** màu xanh mint.
   - Bấm vào thẻ này để mở ngay form nhập từ vựng cho sheet đó.
