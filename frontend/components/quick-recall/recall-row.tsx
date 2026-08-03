"use client";

import { Icon } from "@/components/layout/app-shell";
import { getRecallSides, type RecallDirection } from "@/lib/quick-recall";
import type { FlashcardListItem, QuickRecallResult } from "@/services/api";

type RecallRowProps = {
  card: FlashcardListItem;
  direction: RecallDirection;
  isRevealed: boolean;
  selectedResult: QuickRecallResult | undefined;
  isResultSelectionDisabled: boolean;
  onRevealChange: (cardId: number, shouldReveal: boolean) => void;
  onResultChange: (cardId: number, result: QuickRecallResult) => void;
};

export function RecallRow({ card, direction, isRevealed, selectedResult, isResultSelectionDisabled, onRevealChange, onResultChange }: RecallRowProps) {
  const sides = getRecallSides(card, direction);
  const answerId = `recall-answer-${card.id}`;

  return (
    <article className={`recall-card${isRevealed ? " is-revealed" : ""}`}>
      <div className="recall-card-heading">
        <div>
          <p className="recall-card-meta">Card {card.position} · {sides.questionLabel}</p>
          <h2>{sides.question}</h2>
        </div>
        {card.is_bookmarked && <span className="recall-bookmark" aria-label="Bookmarked"><Icon name="bookmark" size={20} /></span>}
      </div>

      <div id={answerId} className="recall-answer">
        {isRevealed ? (
          <>
            <p className="recall-answer-label">{sides.answerLabel}</p>
            <p className="recall-answer-value">{sides.answer}</p>
            {(card.example_en || card.example_vi) && (
              <div className="recall-example">
                <span>Example</span>
                {card.example_en && <p>{card.example_en}</p>}
                {card.example_vi && <p>{card.example_vi}</p>}
              </div>
            )}
            <div className="recall-result-actions">
              <ResultButton result="remembered" label="Remembered" selectedResult={selectedResult} disabled={isResultSelectionDisabled} onClick={() => onResultChange(card.id, "remembered")} />
              <ResultButton result="need_review" label="Need review" selectedResult={selectedResult} disabled={isResultSelectionDisabled} onClick={() => onResultChange(card.id, "need_review")} />
            </div>
          </>
        ) : (
          <button type="button" aria-controls={answerId} aria-expanded={false} className="recall-reveal-button" onClick={() => onRevealChange(card.id, true)}>
            <Icon name="play" size={21} /> Show answer
          </button>
        )}
      </div>

      {isRevealed && <button type="button" className="recall-hide-button" aria-controls={answerId} aria-expanded onClick={() => onRevealChange(card.id, false)}>Hide answer</button>}
    </article>
  );
}

function ResultButton({ result, label, selectedResult, disabled, onClick }: { result: QuickRecallResult; label: string; selectedResult: QuickRecallResult | undefined; disabled: boolean; onClick: () => void }) {
  const selected = selectedResult === result;
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={`recall-result-button ${result}${selected ? " is-selected" : ""}`}><Icon name={result === "remembered" ? "check" : "refresh"} size={20} />{label}</button>;
}
