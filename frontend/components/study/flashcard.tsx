import { Icon } from "@/components/layout/app-shell";
import type { StudyAnswerDirection, StudySessionCard } from "@/services/api";

type FlashcardProps = {
  sessionCard: StudySessionCard;
  direction: StudyAnswerDirection;
  isFlipped: boolean;
  isDisabled: boolean;
  onFlip: () => void;
};

export function Flashcard({ sessionCard, direction, isFlipped, isDisabled, onFlip }: FlashcardProps) {
  const { flashcard } = sessionCard;
  const isEnglishPrompt = direction === "en_to_vi";
  const question = isEnglishPrompt ? flashcard.phrase : flashcard.meaning;
  const answer = isEnglishPrompt ? flashcard.meaning : flashcard.phrase;
  const promptLabel = isEnglishPrompt ? "English phrase" : "Vietnamese meaning";
  const directionLabel = isEnglishPrompt ? "English → Vietnamese" : "Vietnamese → English";

  return (
    <article className={`study-flashcard${isFlipped ? " is-flipped" : ""}`}>
      <div className="study-flashcard-topline"><span>{directionLabel}</span><span>Current card</span></div>
      <div className="study-flashcard-body">
        {!isFlipped ? (
          <div className="study-flashcard-front">
            <p className="study-flashcard-label">{promptLabel}</p>
            <p className="study-flashcard-question">{question}</p>
            <p className="study-flashcard-hint"><Icon name="eye" size={18} /> Think of the answer before revealing.</p>
          </div>
        ) : (
          <div className="study-flashcard-back" aria-live="polite">
            <p className="study-flashcard-label">Answer</p>
            <p className="study-flashcard-answer-value">{answer}</p>
            {(flashcard.example_en || flashcard.example_vi) && <div className="study-example">{flashcard.example_en && <p><strong>Example EN</strong>{flashcard.example_en}</p>}{flashcard.example_vi && <p><strong>Example VI</strong>{flashcard.example_vi}</p>}</div>}
          </div>
        )}
      </div>
      <button type="button" className="study-reveal-button" onClick={onFlip} disabled={isDisabled} aria-pressed={isFlipped}><Icon name={isFlipped ? "eye" : "play"} size={19} />{isFlipped ? "Hide answer" : "Show answer"}<span className="study-key-hint">Space</span></button>
    </article>
  );
}
