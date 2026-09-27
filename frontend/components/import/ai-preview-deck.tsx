"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import {
  saveAISheet,
  type AIGeneratedCardItem,
  type AISaveSheetResponse,
} from "@/services/api";

type AIPreviewDeckProps = {
  initialSheetName: string;
  initialCards: AIGeneratedCardItem[];
  mode: "new_sheet" | "append";
  workbookId?: number;
  newWorkbookName?: string;
  targetSheetId?: number;
  onBackToConfig: () => void;
};

export function AIPreviewDeck({
  initialSheetName,
  initialCards,
  mode,
  workbookId,
  newWorkbookName,
  targetSheetId,
  onBackToConfig,
}: AIPreviewDeckProps) {
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [cards, setCards] = useState<AIGeneratedCardItem[]>(initialCards);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<AISaveSheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleCardChange(index: number, field: keyof AIGeneratedCardItem, value: string) {
    setCards((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function handleRemoveCard(index: number) {
    setCards((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddEmptyCard() {
    setCards((prev) => [
      ...prev,
      { phrase: "", meaning: "", example_en: "", example_vi: "" },
    ]);
  }

  async function handleSave() {
    if (!sheetName.trim()) {
      setError("Vui lòng đặt tên cho Study Sheet.");
      return;
    }
    const validCards = cards.filter((c) => c.phrase.trim() && c.meaning.trim());
    if (validCards.length === 0) {
      setError("Cần ít nhất một thẻ hợp lệ (có cụm từ và giải nghĩa) để lưu.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await saveAISheet({
        mode,
        workbook_id: workbookId,
        new_workbook_name: newWorkbookName,
        target_sheet_id: targetSheetId,
        sheet_name: sheetName.trim(),
        cards: validCards,
      });
      setSaveResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định khi lưu Study Sheet.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (saveResult) {
    return (
      <div className="ai-save-success-card">
        <div className="ai-success-icon-wrap">
          <Icon name="check" size={36} />
        </div>
        <div className="ai-success-details">
          <span className="ai-badge-pill">✨ AI Flashcards Saved</span>
          <h2>{saveResult.is_appended ? "Đã nối tiếp thẻ thành công!" : "Đã tạo Study Sheet thành công!"}</h2>
          <p>
            Study Sheet <strong>{saveResult.sheet_name}</strong> trong Workbook{" "}
            <strong>{saveResult.workbook_name}</strong> hiện có <strong>{saveResult.total_cards} thẻ</strong>{" "}
            (+{saveResult.cards_added} thẻ AI vừa thêm).
          </p>

          <div className="ai-success-actions">
            <Link href={`/sheets/${saveResult.sheet_id}/study`} className="ai-btn-primary">
              <Icon name="study" size={20} />
              <span>Bắt đầu học ngay (SRS)</span>
            </Link>
            <Link href={`/sheets/${saveResult.sheet_id}/table`} className="ai-btn-secondary">
              <Icon name="books" size={20} />
              <span>Xem bảng từ vựng</span>
            </Link>
            <button type="button" onClick={onBackToConfig} className="ai-btn-ghost">
              <Icon name="refresh" size={18} />
              <span>Tạo thêm bài học khác</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-preview-deck-wrapper">
      <header className="ai-preview-header">
        <div className="ai-preview-title-box">
          <span className="ai-badge-pill">✨ Xem trước Flashcards AI ({cards.length} thẻ)</span>
          <div className="ai-sheet-name-input-group">
            <label htmlFor="ai-sheet-name-input">Tên Study Sheet:</label>
            <input
              id="ai-sheet-name-input"
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="Ví dụ: Daily Workplace Chunks..."
              className="ai-sheet-name-field"
            />
          </div>
          <p className="ai-destination-hint">
            Đích đến:{" "}
            <strong>
              {mode === "append"
                ? "Nối tiếp vào Sheet có sẵn"
                : workbookId
                ? "Thêm Sheet mới vào Workbook đã chọn"
                : `Tạo Workbook mới: "${newWorkbookName || "AI Vocabulary Collection"}"`}
            </strong>
          </p>
        </div>

        <div className="ai-preview-top-actions">
          <button
            type="button"
            onClick={onBackToConfig}
            className="ai-btn-ghost"
            disabled={isSaving}
          >
            ← Quay lại cấu hình
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="ai-btn-primary"
            disabled={isSaving || cards.length === 0}
          >
            <Icon name="check" size={18} />
            <span>{isSaving ? "Đang lưu vào CSDL..." : `Lưu ${cards.length} thẻ vào thư viện`}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="ai-alert-error" role="alert">
          <Icon name="weak" size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="ai-cards-grid">
        {cards.map((card, idx) => (
          <article key={idx} className="ai-card-item">
            <div className="ai-card-header">
              <span className="ai-card-index">#{idx + 1}</span>
              <button
                type="button"
                onClick={() => handleRemoveCard(idx)}
                className="ai-card-remove-btn"
                title="Xóa thẻ này"
                aria-label={`Xóa thẻ số ${idx + 1}`}
              >
                ✕
              </button>
            </div>

            <div className="ai-card-fields">
              <div className="ai-field-group">
                <label>Cụm từ / Chunk (EN):</label>
                <input
                  type="text"
                  value={card.phrase}
                  onChange={(e) => handleCardChange(idx, "phrase", e.target.value)}
                  className="ai-input-phrase"
                  placeholder="e.g. touch base"
                />
              </div>

              <div className="ai-field-group">
                <label>Giải nghĩa (VI):</label>
                <input
                  type="text"
                  value={card.meaning}
                  onChange={(e) => handleCardChange(idx, "meaning", e.target.value)}
                  className="ai-input-meaning"
                  placeholder="e.g. liên lạc nhanh"
                />
              </div>

              <div className="ai-field-group">
                <label>Câu ví dụ (EN):</label>
                <input
                  type="text"
                  value={card.example_en}
                  onChange={(e) => handleCardChange(idx, "example_en", e.target.value)}
                  className="ai-input-example"
                  placeholder="e.g. Let's touch base tomorrow morning."
                />
              </div>

              <div className="ai-field-group">
                <label>Dịch ví dụ (VI):</label>
                <input
                  type="text"
                  value={card.example_vi}
                  onChange={(e) => handleCardChange(idx, "example_vi", e.target.value)}
                  className="ai-input-example"
                  placeholder="e.g. Hãy liên lạc nhanh vào sáng mai."
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="ai-preview-bottom-actions">
        <button
          type="button"
          onClick={handleAddEmptyCard}
          className="ai-btn-add-card"
        >
          ➕ Thêm thẻ thủ công
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="ai-btn-primary ai-btn-save-bottom"
          disabled={isSaving || cards.length === 0}
        >
          <Icon name="check" size={20} />
          <span>{isSaving ? "Đang lưu vào CSDL..." : `Lưu tất cả ${cards.length} thẻ`}</span>
        </button>
      </div>
    </div>
  );
}
