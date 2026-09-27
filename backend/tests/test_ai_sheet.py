import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import SheetStatus
from app.models.flashcard import Flashcard
from app.models.study_sheet import StudySheet
from app.models.workbook import Workbook
from app.services.ai_client import (
    _clean_card_item,
    _clean_model_response,
    generate_ai_cards,
)


def test_clean_model_response():
    """Kiểm tra khả năng bóc tách JSON khi AI trả về thẻ think và markdown fence."""
    raw = """<think>Let me think about English collocations...</think>
```json
{
  "sheet_name": "Office Slang",
  "cards": [
    {
      "phrase": "touch base",
      "meaning": "liên lạc nhanh",
      "example_en": "Let's touch base tomorrow morning.",
      "example_vi": "Hãy liên lạc nhanh vào sáng mai."
    }
  ]
}
```
Here are the generated flashcards!"""
    cleaned = _clean_model_response(raw)
    parsed = json.loads(cleaned)
    assert parsed["sheet_name"] == "Office Slang"
    assert len(parsed["cards"]) == 1


def test_clean_card_item_strips_speaker_prefix():
    """Kiểm tra loại bỏ tiền tố người nói A: B: nếu AI lỡ sinh ra."""
    card_dict = {
        "phrase": "on the fly",
        "meaning": "làm ngay lập tức",
        "example_en": "A: We can adjust the plan on the fly.",
        "example_vi": "Người 1: Chúng ta có thể điều chỉnh kế hoạch ngay lập tức.",
    }
    cleaned = _clean_card_item(card_dict)
    assert cleaned.example_en == "We can adjust the plan on the fly."
    assert cleaned.example_vi == "Chúng ta có thể điều chỉnh kế hoạch ngay lập tức."


def test_ai_generate_multi_batch():
    """Kiểm tra chế độ sinh 40 thẻ sẽ tự động chia làm 2 batch ngầm và loại trừ từ cũ."""
    batch_call_count = 0

    def mock_call_chat(messages, **kwargs):
        nonlocal batch_call_count
        batch_call_count += 1
        return json.dumps({
            "sheet_name": "Conversational Chunks",
            "cards": [
                {
                    "phrase": f"chunk_{batch_call_count}_{i}",
                    "meaning": f"nghĩa_{i}",
                    "example_en": f"Example sentence {i}.",
                    "example_vi": f"Ví dụ câu {i}.",
                }
                for i in range(20)
            ],
        })

    with patch("app.services.ai_client.call_9router_chat", side_effect=mock_call_chat):
        resp = generate_ai_cards(topic="Daily Commute", total_count=40)
        assert resp.total_generated == 40
        assert len(resp.cards) == 40
        assert batch_call_count == 2



def test_generate_endpoint_requires_admin(api_client: TestClient):
    """Yêu cầu quyền admin khi gọi endpoint sinh thẻ AI."""
    resp = api_client.post("/api/v1/ai/generate", json={"topic": "Office", "count": 10})
    assert resp.status_code == 401


def test_generate_endpoint_success(api_client: TestClient, admin_headers: dict[str, str]):
    """Gọi endpoint sinh thẻ thành công với token admin."""
    mock_llm_json = json.dumps({
        "sheet_name": "Meeting Expressions",
        "cards": [
            {
                "phrase": "get the ball rolling",
                "meaning": "bắt đầu tiến hành",
                "example_en": "Let's get the ball rolling on this project.",
                "example_vi": "Hãy bắt đầu tiến hành dự án này.",
            }
        ],
    })

    with patch("app.services.ai_client.call_9router_chat", return_value=mock_llm_json):
        resp = api_client.post(
            "/api/v1/ai/generate",
            headers=admin_headers,
            json={"topic": "Meetings", "count": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_name"] == "Meeting Expressions"
        assert len(data["cards"]) == 1
        assert data["cards"][0]["phrase"] == "get the ball rolling"


def test_save_new_workbook_and_sheet(
    api_client: TestClient,
    admin_headers: dict[str, str],
    db_session: Session,
):
    """Lưu sheet mới vào một Workbook mới tạo."""
    payload = {
        "mode": "new_sheet",
        "new_workbook_name": "Daily Spoken Chunks",
        "sheet_name": "Part 1 - Greetings",
        "cards": [
            {
                "phrase": "how's it going",
                "meaning": "dạo này thế nào",
                "example_en": "Hey Mark, how's it going?",
                "example_vi": "Chào Mark, dạo này thế nào?",
            },
            {
                "phrase": "long time no see",
                "meaning": "lâu rồi không gặp",
                "example_en": "Long time no see, what have you been up to?",
                "example_vi": "Lâu rồi không gặp, dạo này bạn làm gì?",
            },
        ],
    }

    resp = api_client.post("/api/v1/ai/save", headers=admin_headers, json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["workbook_name"] == "Daily Spoken Chunks"
    assert data["sheet_name"] == "Part 1 - Greetings"
    assert data["cards_added"] == 2
    assert data["total_cards"] == 2
    assert data["is_appended"] is False

    # Kiểm tra trong DB
    sheet = db_session.get(StudySheet, data["sheet_id"])
    assert sheet is not None
    assert sheet.is_ai_generated is True
    assert sheet.card_count == 2
    assert len(sheet.flashcards) == 2
    assert sheet.flashcards[0].position == 1
    assert sheet.flashcards[1].position == 2


def test_save_append_to_existing_sheet(
    api_client: TestClient,
    admin_headers: dict[str, str],
    db_session: Session,
):
    """Nối tiếp (append) thẻ vào một Sheet có sẵn."""
    # Tạo trước 1 workbook và 1 sheet có 2 cards
    wb = Workbook(
        user_id=1,
        name="Existing Collection",
        original_filename="manual.xlsx",
        sheet_count=1,
        total_cards=2,
    )
    db_session.add(wb)
    db_session.flush()

    sheet = StudySheet(
        workbook_id=wb.id,
        name="Sheet Alpha",
        position=1,
        card_count=2,
        status=SheetStatus.NOT_STARTED,
        is_ai_generated=False,
    )
    db_session.add(sheet)
    db_session.flush()

    card1 = Flashcard(sheet_id=sheet.id, position=1, phrase="alpha", meaning="a", example_en="ex a", example_vi="vd a")
    card2 = Flashcard(sheet_id=sheet.id, position=2, phrase="beta", meaning="b", example_en="ex b", example_vi="vd b")
    db_session.add_all([card1, card2])
    db_session.commit()

    # Append 2 thẻ AI mới
    append_payload = {
        "mode": "append",
        "target_sheet_id": sheet.id,
        "sheet_name": sheet.name,
        "cards": [
            {
                "phrase": "gamma",
                "meaning": "c",
                "example_en": "ex c",
                "example_vi": "vd c",
            },
            {
                "phrase": "delta",
                "meaning": "d",
                "example_en": "ex d",
                "example_vi": "vd d",
            },
        ],
    }

    resp = api_client.post("/api/v1/ai/save", headers=admin_headers, json=append_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["sheet_id"] == sheet.id
    assert data["cards_added"] == 2
    assert data["total_cards"] == 4
    assert data["is_appended"] is True

    # Kiểm tra DB: sheet được đánh dấu is_ai_generated = True và position nối tiếp 3, 4
    db_session.expire_all()
    updated_sheet = db_session.get(StudySheet, sheet.id)
    assert updated_sheet.is_ai_generated is True
    assert updated_sheet.card_count == 4
    assert len(updated_sheet.flashcards) == 4
    assert [c.position for c in updated_sheet.flashcards] == [1, 2, 3, 4]
    assert updated_sheet.flashcards[2].phrase == "gamma"
    assert updated_sheet.flashcards[3].phrase == "delta"



def test_extract_chunks_from_text_success():
    """Kiểm tra hàm extract_chunks_from_text bóc tách thành công các collocations."""
    from app.services.ai_client import extract_chunks_from_text

    mock_response = json.dumps({
        "sheet_name": "Tech Startup News Chunks",
        "cards": [
            {
                "phrase": "call it a day",
                "meaning": "dừng lại, kết thúc hoạt động",
                "example_en": "The startup decided to call it a day after failing to raise funds.",
                "example_vi": "Startup quyết định dừng lại sau khi thất bại trong việc gọi vốn.",
            },
            {
                "phrase": "see eye to eye on",
                "meaning": "đồng quan điểm, nhất trí",
                "example_en": "The founders could not see eye to eye on the company valuation.",
                "example_vi": "Các nhà sáng lập không thể đồng quan điểm về định giá công ty.",
            },
        ],
    })

    with patch("app.services.ai_client.call_9router_chat", return_value=mock_response):
        sheet_name, cards = extract_chunks_from_text(
            text="The startup decided to call it a day after failing to raise funds. The founders could not see eye to eye on the company valuation."
        )
        assert sheet_name == "Tech Startup News Chunks"
        assert len(cards) == 2
        assert cards[0].phrase == "call it a day"
        assert cards[1].phrase == "see eye to eye on"


def test_mine_chunks_endpoint_requires_admin(api_client: TestClient):
    """Yêu cầu token admin khi gọi endpoint bóc tách câu văn /mine."""
    resp = api_client.post("/api/v1/ai/mine", json={"text": "A quick test sentence."})
    assert resp.status_code == 401


def test_mine_chunks_endpoint_success(api_client: TestClient, admin_headers: dict[str, str]):
    """Gọi endpoint /mine thành công với quyền admin và nhận về danh sách thẻ."""
    mock_response = json.dumps({
        "sheet_name": "Market Analysis Chunks",
        "cards": [
            {
                "phrase": "in the long run",
                "meaning": "về lâu về dài",
                "example_en": "These investments will definitely pay off in the long run.",
                "example_vi": "Các khoản đầu tư này chắc chắn sẽ sinh lời về lâu về dài.",
            }
        ],
    })

    with patch("app.services.ai_client.call_9router_chat", return_value=mock_response):
        resp = api_client.post(
            "/api/v1/ai/mine",
            headers=admin_headers,
            json={"text": "These investments will definitely pay off in the long run."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sheet_name"] == "Market Analysis Chunks"
        assert data["total_generated"] == 1
        assert data["cards"][0]["phrase"] == "in the long run"

