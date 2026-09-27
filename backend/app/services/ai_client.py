import json
import logging
import re
from typing import Any, Optional

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.ai import AIGeneratedCardItem, AIGeneratedSheetResponse

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert English communication tutor specializing in conversational fluency, spoken sentence chunks, and workplace collocations.
Generate practical, natural English expressions with accurate Vietnamese translations.
Focus on:
1. Spoken sentence chunks, common workplace/daily conversational collocations, and natural phrase patterns.
2. Avoid academic, textbook jargon or obscure idioms. Focus on what native speakers say daily.
3. Every card must have:
   - phrase: Spoken chunk, phrasal verb, or conversational expression (e.g. "touch base", "on the same page", "drop by").
   - meaning: Concise, natural Vietnamese translation (under 10 words).
   - example_en: A realistic modern conversational sentence using the chunk. IMPORTANT: Do NOT include speaker labels like "A:" or "B:". Write only the clean sentence.
   - example_vi: Natural Vietnamese translation of the example sentence.
4. Output MUST be strictly valid JSON matching this schema:
{
  "sheet_name": "Suggested Sheet Name (Short & Catchy)",
  "cards": [
    {
      "phrase": "...",
      "meaning": "...",
      "example_en": "...",
      "example_vi": "..."
    }
  ]
}
Do not include markdown commentary outside the JSON."""


def _clean_model_response(raw_text: str) -> str:
    """Loại bỏ thẻ suy nghĩ (<think>...</think>) và các khối markdown code fence."""
    text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()
    start_brace = text.find("{")
    end_brace = text.rfind("}")
    if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
        return text[start_brace : end_brace + 1].strip()
    return text


def _clean_card_item(card: dict[str, Any]) -> AIGeneratedCardItem:
    """Làm sạch dữ liệu thẻ từ AI: loại bỏ tiền tố người nói A: B: nếu có."""
    phrase = str(card.get("phrase", "")).strip()
    meaning = str(card.get("meaning", "")).strip()
    example_en = str(card.get("example_en", "")).strip()
    example_vi = str(card.get("example_vi", "")).strip()

    example_en = re.sub(r"^(?:[A-Z]|Person\s*\d+)\s*:\s*", "", example_en, flags=re.IGNORECASE)
    example_vi = re.sub(r"^(?:[A-Z]|Người\s*\d+)\s*:\s*", "", example_vi, flags=re.IGNORECASE)

    return AIGeneratedCardItem(
        phrase=phrase,
        meaning=meaning,
        example_en=example_en,
        example_vi=example_vi,
    )


def call_9router_chat(
    messages: list[dict[str, str]],
    temperature: float = 0.7,
    timeout: Optional[float] = None,
) -> str:
    """Thực hiện HTTP POST gọi endpoint OpenAI-compatible của 9Router local."""
    url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }

    req_timeout = timeout or settings.ai_request_timeout

    try:
        with httpx.Client(timeout=req_timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/event-stream" in content_type:
                full_content: list[str] = []
                for line in resp.text.splitlines():
                    line = line.strip()
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            chunk = json.loads(line[6:])
                            delta_content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if delta_content:
                                full_content.append(delta_content)
                        except json.JSONDecodeError:
                            continue
                return "".join(full_content)
            else:
                data = resp.json()
                return data["choices"][0]["message"]["content"]
    except httpx.ConnectError as err:
        logger.error(f"Cannot connect to 9router at {url}: {err}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không thể kết nối đến Local AI (9Router). Vui lòng đảm bảo 9router đang hoạt động trên port 20128.",
        )
    except httpx.TimeoutException as err:
        logger.error(f"9router request timeout after {req_timeout}s: {err}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Local AI phản hồi quá thời gian quy định ({req_timeout}s). Vui lòng thử lại với số lượng thẻ ít hơn.",
        )
    except httpx.HTTPStatusError as err:
        logger.error(f"9router returned HTTP {err.response.status_code}: {err.response.text}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Lỗi từ Local AI gateway: {err.response.text[:200]}",
        )
    except Exception as err:
        logger.error(f"Unexpected error when calling 9router: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi không xác định khi giao tiếp với AI: {str(err)}",
        )


def generate_single_batch(
    topic: Optional[str],
    count: int,
    level: str,
    existing_phrases: Optional[list[str]] = None,
) -> tuple[str, list[AIGeneratedCardItem]]:
    """Tạo một batch thẻ từ vựng đơn lẻ với số lượng yêu cầu (tối đa 20 thẻ mỗi lượt)."""
    topic_text = topic.strip() if topic and topic.strip() else "Everyday Conversational & Workplace Chunks"
    user_prompt = f"Topic: {topic_text}\nNumber of cards to generate: {count}\nTarget Level: {level}\n"

    if existing_phrases:
        # Giới hạn danh sách loại trừ tối đa 60 từ để tránh làm quá dài context window
        exclusion_sample = existing_phrases[-60:]
        exclusion_list = ", ".join(f'"{p}"' for p in exclusion_sample)
        user_prompt += (
            f"\nIMPORTANT - Exclusion List: Do NOT generate any of the following expressions or duplicates:\n"
            f"[{exclusion_list}]\n"
        )

    user_prompt += "\nRespond strictly in JSON format as specified."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    raw_content = call_9router_chat(messages=messages)
    clean_json_str = _clean_model_response(raw_content)

    try:
        parsed_data = json.loads(clean_json_str)
    except json.JSONDecodeError as err:
        logger.error(f"Failed to parse JSON from AI response: {err}. Raw text:\n{clean_json_str}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI trả về dữ liệu không đúng chuẩn định dạng JSON. Vui lòng thử sinh lại.",
        )

    sheet_name = str(parsed_data.get("sheet_name", "")).strip()
    if not sheet_name:
        sheet_name = f"{topic_text[:25]} Chunks"

    raw_cards = parsed_data.get("cards", [])
    if not isinstance(raw_cards, list) or len(raw_cards) == 0:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI không tạo ra danh sách thẻ nào. Vui lòng thử lại.",
        )

    cards = [_clean_card_item(c) for c in raw_cards if isinstance(c, dict) and c.get("phrase")]
    return sheet_name, cards


def generate_ai_cards(
    topic: Optional[str] = None,
    total_count: int = 10,
    level: str = "Intermediate B1-B2",
    existing_phrases: Optional[list[str]] = None,
) -> AIGeneratedSheetResponse:
    """Sinh danh sách Flashcards tự động từ AI.
    
    Hỗ trợ sinh 10, 20 hoặc chia làm 2 batch tự động (ví dụ 40 thẻ) để bảo đảm chất lượng,
    tránh timeout và loại trừ trùng lặp giữa các lượt sinh.
    """
    excluded = list(existing_phrases or [])

    if total_count <= 20:
        sheet_name, cards = generate_single_batch(
            topic=topic,
            count=total_count,
            level=level,
            existing_phrases=excluded,
        )
        return AIGeneratedSheetResponse(
            sheet_name=sheet_name,
            cards=cards,
            total_generated=len(cards),
        )

    # Nếu số lượng lớn hơn 20 (ví dụ 40 thẻ): Chia làm 2 batch liên tiếp
    batch_1_count = 20
    batch_2_count = total_count - batch_1_count

    # Lượt 1
    sheet_name, batch_1_cards = generate_single_batch(
        topic=topic,
        count=batch_1_count,
        level=level,
        existing_phrases=excluded,
    )

    # Bổ sung các từ vừa sinh ở lượt 1 vào danh sách loại trừ cho lượt 2
    for card in batch_1_cards:
        if card.phrase not in excluded:
            excluded.append(card.phrase)

    # Lượt 2
    _, batch_2_cards = generate_single_batch(
        topic=topic,
        count=batch_2_count,
        level=level,
        existing_phrases=excluded,
    )

    all_cards = batch_1_cards + batch_2_cards
    return AIGeneratedSheetResponse(
        sheet_name=sheet_name,
        cards=all_cards,
        total_generated=len(all_cards),
    )

