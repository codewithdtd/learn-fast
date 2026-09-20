import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { Icon } from "@/components/layout/app-shell";
import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import type { StudyAnswerDirection, StudyAnswerResult, StudySessionCard } from "@/services/api";

type FlashcardProps = {
  sessionCard: StudySessionCard;
  direction: StudyAnswerDirection;
  isFlipped: boolean;
  isDisabled: boolean;
  answerResult: StudyAnswerResult | null;
  onFlip: () => void;
};

export function Flashcard({ sessionCard, direction, isFlipped, isDisabled, answerResult, onFlip }: FlashcardProps) {
  const { flashcard } = sessionCard;
  const isEnglishPrompt = direction === "en_to_vi";
  const question = isEnglishPrompt ? flashcard.phrase : flashcard.meaning;
  const answer = isEnglishPrompt ? flashcard.meaning : flashcard.phrase;
  const promptLabel = isEnglishPrompt ? "English phrase" : "Vietnamese meaning";
  const directionLabel = isEnglishPrompt ? "English to Vietnamese" : "Vietnamese to English";

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (isDisabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onFlip();
  }

  return (
    <article
      className={`study-flashcard${isFlipped ? " is-flipped" : ""}${isDisabled ? " is-disabled" : ""}`}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={isFlipped ? "Hide answer" : "Show answer"}
      aria-pressed={isFlipped}
      aria-disabled={isDisabled}
      onClick={() => { if (!isDisabled) onFlip(); }}
      onKeyDown={handleKeyDown}
    >
      <div className="study-flashcard-inner">
        <div className="study-flashcard-face study-flashcard-front" aria-hidden={isFlipped}>
          <div className="study-flashcard-topline"><span>{directionLabel}</span><AnswerStatus result={answerResult} /></div>
          <div className="study-flashcard-body">
            <div className="study-flashcard-face-content">
              <p className="study-flashcard-label">{promptLabel}</p>
              <div className="study-flashcard-text-row">
                <p className="study-flashcard-question">{question}</p>
                {isEnglishPrompt && (
                  <AudioPronounceButton text={question} size="lg" title="Listen to question" />
                )}
              </div>
              <p className="study-flashcard-hint"><Icon name="eye" size={18} /> Click the card to reveal the answer.</p>
            </div>
          </div>
        </div>

        <div className="study-flashcard-face study-flashcard-back" aria-hidden={!isFlipped}>
          <div className="study-flashcard-topline"><span>{directionLabel}</span><AnswerStatus result={answerResult} /></div>
          <div className="study-flashcard-body">
            <div className="study-flashcard-face-content">
              <p className="study-flashcard-label">Answer</p>
              <div className="study-flashcard-text-row">
                <p className="study-flashcard-answer-value">{answer}</p>
                {!isEnglishPrompt && (
                  <AudioPronounceButton text={answer} size="lg" title="Listen to answer" />
                )}
              </div>
              {(flashcard.example_en || flashcard.example_vi) && (
                <div className="study-example">
                  {flashcard.example_en && (
                    <div className="study-example-row">
                      <p><strong>Example EN</strong>{flashcard.example_en}</p>
                      <AudioPronounceButton text={flashcard.example_en} size="sm" title="Listen to example" />
                    </div>
                  )}
                  {flashcard.example_vi && <p><strong>Example VI</strong>{flashcard.example_vi}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AnswerStatus({ result }: { result: StudyAnswerResult | null }) {
  if (!result) return <strong className="study-flashcard-answer-status unanswered">Not answered</strong>;
  return <strong className={`study-flashcard-answer-status ${result}`}>{result === "again" ? "Marked Again" : "Remembered"}</strong>;
}
