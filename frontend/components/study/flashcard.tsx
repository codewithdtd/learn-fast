import type { StudyAnswerDirection, StudySessionCard } from "@/services/api";

type FlashcardProps = {
  sessionCard: StudySessionCard;
  direction: StudyAnswerDirection;
  isFlipped: boolean;
  isDisabled: boolean;
  onFlip: () => void;
};

export function Flashcard({
  sessionCard,
  direction,
  isFlipped,
  isDisabled,
  onFlip,
}: FlashcardProps) {
  const { flashcard } = sessionCard;
  const question = direction === "en_to_vi" ? flashcard.phrase : flashcard.meaning;
  const answer = direction === "en_to_vi" ? flashcard.meaning : flashcard.phrase;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-medium uppercase tracking-wide text-sky-700">
        {direction === "en_to_vi" ? "English → Vietnamese" : "Vietnamese → English"}
      </p>
      <p className="mt-6 text-sm font-medium text-slate-500">Question</p>
      <p className="mt-2 text-2xl font-semibold leading-relaxed text-slate-950 sm:text-3xl">
        {question}
      </p>

      {isFlipped ? (
        <div className="mt-8 border-t border-slate-200 pt-6" aria-live="polite">
          <p className="text-sm font-medium text-slate-500">Answer</p>
          <p className="mt-2 text-xl font-semibold leading-relaxed text-slate-900 sm:text-2xl">
            {answer}
          </p>
          {(flashcard.example_en || flashcard.example_vi) && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {flashcard.example_en && <p><span className="font-semibold">Example EN:</span> {flashcard.example_en}</p>}
              {flashcard.example_vi && <p className="mt-2"><span className="font-semibold">Example VI:</span> {flashcard.example_vi}</p>}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-slate-600">Think of the answer before flipping the card.</p>
      )}

      <button
        type="button"
        onClick={onFlip}
        disabled={isDisabled}
        aria-pressed={isFlipped}
        className="mt-8 w-full rounded-lg border border-sky-700 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 sm:w-auto"
      >
        {isFlipped ? "Hide answer" : "Show answer"} <span className="text-slate-500">(Space)</span>
      </button>
    </section>
  );
}
