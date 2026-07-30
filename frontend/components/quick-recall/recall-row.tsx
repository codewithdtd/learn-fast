"use client";

import { getRecallSides, type RecallDirection } from "@/lib/quick-recall";
import type { FlashcardListItem } from "@/services/api";

type RecallRowProps = {
  card: FlashcardListItem;
  direction: RecallDirection;
  isRevealed: boolean;
  onRevealChange: (cardId: number, shouldReveal: boolean) => void;
};

export function RecallRow({
  card,
  direction,
  isRevealed,
  onRevealChange,
}: RecallRowProps) {
  const sides = getRecallSides(card, direction);
  const answerId = `recall-answer-${card.id}`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Card {card.position} · {sides.questionLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{sides.question}</p>
        </div>
        <button
          type="button"
          aria-controls={answerId}
          aria-expanded={isRevealed}
          onClick={() => onRevealChange(card.id, !isRevealed)}
          className="rounded-lg border border-sky-300 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50"
        >
          {isRevealed ? "Hide" : "Show"}
        </button>
      </div>
      <div
        id={answerId}
        className={`mt-4 rounded-lg p-4 ${
          isRevealed ? "bg-sky-50 text-slate-900" : "bg-slate-100 text-slate-600"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {sides.answerLabel}
        </p>
        {isRevealed ? (
          <p className="mt-1 whitespace-pre-wrap font-medium">{sides.answer}</p>
        ) : (
          <p className="mt-1 italic">Tự nhớ đáp án rồi bấm Show.</p>
        )}
      </div>
    </article>
  );
}
