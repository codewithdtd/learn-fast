import { Icon } from "@/components/layout/app-shell";
import type { StudyAnswerDirection, StudySessionCard } from "@/services/api";

type FlashcardProps = { sessionCard: StudySessionCard; direction: StudyAnswerDirection; isFlipped: boolean; isDisabled: boolean; onFlip: () => void };

export function Flashcard({ sessionCard, direction, isFlipped, isDisabled, onFlip }: FlashcardProps) {
  const { flashcard } = sessionCard;
  const question = direction === "en_to_vi" ? flashcard.phrase : flashcard.meaning;
  const answer = direction === "en_to_vi" ? flashcard.meaning : flashcard.phrase;
  const directionLabel = direction === "en_to_vi" ? "English → Vietnamese" : "Vietnamese → English";

  return <article className={`study-flashcard${isFlipped ? " is-flipped" : ""}`}>
    <div className="study-flashcard-topline"><span>{directionLabel}</span><span>Current card</span></div>
    <div className="study-flashcard-body">
      <p className="study-flashcard-label">Question</p>
      <p className="study-flashcard-question">{question}</p>
      {isFlipped ? <div className="study-flashcard-answer" aria-live="polite"><p className="study-flashcard-label">Answer</p><p className="study-flashcard-answer-value">{answer}</p>{(flashcard.example_en || flashcard.example_vi) && <div className="study-example">{flashcard.example_en && <p><strong>Example EN</strong>{flashcard.example_en}</p>}{flashcard.example_vi && <p><strong>Example VI</strong>{flashcard.example_vi}</p>}</div>}</div> : <p className="study-flashcard-hint">Think of the answer before revealing the card.</p>}
    </div>
    <button type="button" className="study-reveal-button" onClick={onFlip} disabled={isDisabled} aria-pressed={isFlipped}>{isFlipped ? <Icon name="eye" size={19} /> : <Icon name="play" size={19} />}{isFlipped ? "Hide answer" : "Show answer"}<span className="study-key-hint">Space</span></button>
  </article>;
}
