# Kế Hoạch Triển Khai: Chức Năng Thêm Từ Vựng Thủ Công Cho Từng Sheet (Add Flashcard to Sheet)

## 1. Mục tiêu
Người dùng phản ánh:
> *"hiện tại k có chức năng thêm từ vựng cho từng sheet hả"*
> *"thực hiện đi"*

Mục tiêu là xây dựng luồng thêm từ vựng thủ công hoàn chỉnh từ Backend đến Frontend UI:
1. Cho phép người dùng thêm từng từ/cụm từ vựng kèm nghĩa tiếng Việt và câu ví dụ vào một Sheet cụ thể.
2. Đảm bảo phân quyền bảo mật (Multi-tenancy IDOR): Admin có thể thêm từ vào mọi sheet; người dùng có tài khoản có thể thêm từ vào các sheet thuộc Workbook do chính họ sở hữu; khách vãng lai (Guest) hoặc người không có quyền sở hữu sẽ bị chặn an toàn.
3. Cung cấp giao diện Dialog/Modal thêm từ vựng thân thiện, đồng bộ với thiết kế Cozy Island, hỗ trợ thêm nhanh liên tục ("Thêm tiếp từ khác") và cập nhật danh sách thẻ tức thì không cần tải lại trang.

---

## 2. Phạm vi thực hiện

### 2.1. In-Scope:
- **Backend**:
  - `backend/app/schemas/workbook.py`: Bổ sung trường `user_id: int | None = None` vào `WorkbookReference` để frontend nhận biết chủ sở hữu của sheet.
  - `backend/app/api/flashcards.py`: Mở rộng quyền gọi API `POST /api/v1/sheets/{sheet_id}/cards` cho cả Admin lẫn Owner của Workbook chứa sheet (`current_user.is_superuser or sheet.workbook.user_id == current_user.id`).
  - `backend/tests/test_flashcard_api.py`: Bổ sung kiểm thử tự động xác minh chủ sở hữu thêm thẻ thành công, khách vãng lai bị chặn (401), người không sở hữu bị chặn (403).
- **Frontend API & Types**:
  - `frontend/services/api.ts`:
    - Cập nhật kiểu `SheetDetail.workbook` hỗ trợ `user_id?: number | null`.
    - Cập nhật hàm `createFlashcardInSheet` chấp nhận cả `example_vi?: string`.
- **Frontend UI & Components**:
  - `frontend/components/sheets/add-flashcard-modal.tsx`: Component Modal thêm từ vựng chuyên nghiệp, có focus trap, phím tắt Esc, validate trường trống, tùy chọn "Add another word" (Thêm tiếp từ khác) để nhập hàng loạt thuận tiện, thông báo lỗi trùng từ nếu backend trả về 409.
  - `frontend/components/sheets/table-view-page.tsx`:
    - Thêm nút `+ Add Word` trên thanh điều hướng header (hiển thị khi có quyền quản lý sheet).
    - Thêm nút `+ Add first word` trong màn hình rỗng (`TableViewMessage`) khi sheet chưa có từ nào.
    - Cập nhật state `cards` ngay lập tức sau khi thêm từ thành công.
    - Sửa logic `canEdit` để chủ sở hữu workbook cũng có quyền sửa/xóa thẻ giống admin.
  - `frontend/components/sheets/sheet-detail.tsx`:
    - Bổ sung nút / ActionCard "+ Add Word" để người dùng có thể mở modal thêm từ ngay từ trang chi tiết sheet.
- **Frontend Tests**:
  - Tạo `frontend/tests/add-flashcard.test.mjs` kiểm định logic form validation và cấu trúc payload thẻ mới.
- **Quy chuẩn tài liệu**:
  - `guide/add-vocabulary-to-sheet-guide.md`: Hướng dẫn & báo cáo sau thực thi theo quy định `AGENTS.md`.

### 2.2. Out-of-Scope:
- Không thay đổi bảng cơ sở dữ liệu (`Flashcard` model đã có đầy đủ các cột cần thiết).
- Không ảnh hưởng đến thuật toán SRS hiện tại.

---

## 3. Các bước triển khai

- **Bước 1 (Backend Schemas & API)**:
  - Cập nhật `WorkbookReference` trong `backend/app/schemas/workbook.py`.
  - Cập nhật `create_flashcard` trong `backend/app/api/flashcards.py` với hàm `ensure_sheet_mutable`.
- **Bước 2 (Backend Tests)**:
  - Chạy `backend\.venv\Scripts\pytest.exe backend/tests/test_flashcard_api.py` và thêm test case chủ sở hữu thêm từ.
- **Bước 3 (Frontend Service API)**:
  - Cập nhật kiểu dữ liệu `SheetDetail` và chữ ký hàm `createFlashcardInSheet` trong `frontend/services/api.ts`.
- **Bước 4 (Frontend Modal Component)**:
  - Tạo `frontend/components/sheets/add-flashcard-modal.tsx`.
- **Bước 5 (Frontend Integration)**:
  - Tích hợp Modal vào `table-view-page.tsx`.
  - Tích hợp Modal vào `sheet-detail.tsx`.
- **Bước 6 (Frontend Tests & Verification)**:
  - Chạy `node --test frontend/tests/*.test.mjs`.
  - Chạy `powershell -Command "cd frontend; npx tsc --noEmit"`.
- **Bước 7 (Guide & Git Commit)**:
  - Viết tài liệu `guide/add-vocabulary-to-sheet-guide.md`.
  - Commit toàn bộ thay đổi với thông điệp chuẩn mực.

---

## 4. Tiêu chí hoàn thành (Definition of Done)
1. Backend cho phép Admin và Owner của Workbook thêm từ vựng vào sheet thông qua `POST /api/v1/sheets/{sheet_id}/cards`.
2. Khách vãng lai và người không phải chủ sở hữu không thể can thiệp thêm từ vào sheet của người khác (bảo vệ IDOR).
3. Người dùng có thể nhấn `+ Add Word` trên giao diện Table View và Sheet Detail để mở Form thêm từ.
4. Form hỗ trợ nhập Phrase, Meaning, English Example, Vietnamese Example, có phím tắt, báo lỗi trùng từ, và có tùy chọn thêm tiếp nhiều từ.
5. Danh sách từ vựng và số lượng thẻ được cập nhật realtime sau khi thêm thành công.
6. Toàn bộ backend pytest và frontend unit tests + typecheck đều đạt 100%.

---

## 5. Kế hoạch kiểm thử (Verification Plan)
- **Backend Tests**:
  - `backend\.venv\Scripts\pytest.exe backend/tests/test_flashcard_api.py`
- **Frontend Tests**:
  - `node --test frontend/tests/*.test.mjs`
- **Typecheck**:
  - `powershell -Command "cd frontend; npx tsc --noEmit"`

---

## 6. Rủi ro & Edge Cases
- **Trùng lặp từ vựng**: Backend đã có `FlashcardDuplicateError` (HTTP 409). Frontend cần bắt mã 409 này và hiển thị thông báo rõ ràng: "This word already exists in this sheet."
- **Khoảng trắng thừa**: Cần trim chuỗi ở cả client và server để tránh lưu từ chỉ toàn phím cách.
- **Quyền hạn Owner vs Guest**: Đảm bảo guest hoặc tài khoản xem workbook công khai của người khác không thấy nút thêm từ hoặc bị backend từ chối nếu cố tình gọi API.
