import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { Icon } from "@/components/layout/app-shell";
import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import type { StudyAnswerDirection, StudyAnswerResult, StudySessionCard } from "@/services/api";

type FlashcardProps = {
  sessionCard: StudySessionCard;
  direction: StudyAnswerDirection;
  isFlipped: boolean;
  isDisabled: boolean;
  canSwipe: boolean;
  answerResult: StudyAnswerResult | null;
  onFlip: () => void;
  onSwipe: (result: StudyAnswerResult) => void;
};

const SWIPE_THRESHOLD = 72;
const SWIPE_INTENT_THRESHOLD = 12;
const SWIPE_DIRECTION_RATIO = 1.25;

export function Flashcard({ sessionCard, direction, isFlipped, isDisabled, canSwipe, answerResult, onFlip, onSwipe }: FlashcardProps) {
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; movedHorizontally: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipePreview, setSwipePreview] = useState<StudyAnswerResult | null>(null);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
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

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!canSwipe || (event.pointerType !== "touch" && event.pointerType !== "pen") || !event.isPrimary) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
    suppressClick.current = false;
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, movedHorizontally: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    if (Math.abs(deltaX) > SWIPE_INTENT_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) active.movedHorizontally = true;
    if (!active.movedHorizontally || !isFlipped) return;
    setIsSwipeDragging(true);
    setSwipeOffset(Math.max(-120, Math.min(120, deltaX)));
    setSwipePreview(deltaX < 0 ? "again" : "remembered");
  }

  function resetGesture() {
    gesture.current = null;
    setIsSwipeDragging(false);
    setSwipeOffset(0);
    setSwipePreview(null);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    // Chỉ chấm sau khi mở đáp án và cử chỉ đủ rõ theo chiều ngang để tránh nhầm thao tác cuộn trang.
    const isSwipe = active.movedHorizontally && Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * SWIPE_DIRECTION_RATIO;
    suppressClick.current = active.movedHorizontally;
    resetGesture();
    // Giữ cùng kết quả SRS với hai nút hiện tại: kéo trái là quên, kéo phải là nhớ.
    if (isSwipe && canSwipe && isFlipped && !isDisabled) onSwipe(deltaX < 0 ? "again" : "remembered");
  }

  function handlePointerCancel() {
    suppressClick.current = true;
    resetGesture();
  }

  return (
    <article
      className={`study-flashcard${isFlipped ? " is-flipped" : ""}${isDisabled ? " is-disabled" : ""}${isSwipeDragging ? " is-swipe-dragging" : ""}`}
      style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={isFlipped ? "Hide answer. Swipe left if forgotten or right if remembered." : "Show answer"}
      aria-pressed={isFlipped}
      aria-disabled={isDisabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(event) => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
        if (!isDisabled) onFlip();
      }}
      onKeyDown={handleKeyDown}
    >
      {swipePreview && <span className={`study-swipe-preview ${swipePreview}`} aria-hidden="true">{swipePreview === "again" ? "Forgot" : "Remembered"}</span>}
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
