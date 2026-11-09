import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Icon } from "@/components/layout/app-shell";
import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import { computeSwipeDrag } from "@/lib/flashcard-gesture";
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

export function Flashcard({
  sessionCard,
  direction,
  isFlipped,
  isDisabled,
  canSwipe,
  answerResult,
  onFlip,
  onSwipe,
}: FlashcardProps) {
  // Quản lý trạng thái cử chỉ kéo chạm (touch / pointer gesture)
  const gestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    hasCaptured: boolean;
  } | null>(null);

  const suppressClick = useRef(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeRotation, setSwipeRotation] = useState(0);
  const [swipePreview, setSwipePreview] = useState<{
    type: StudyAnswerResult;
    opacity: number;
    scale: number;
  } | null>(null);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [flyOutDirection, setFlyOutDirection] = useState<"left" | "right" | null>(null);

  const cardId = sessionCard.id;
  // Khi chuyển sang thẻ mới (hoặc reset vòng học), làm mới toàn bộ vị trí transform và hiệu ứng bay
  useEffect(() => {
    setSwipeOffset(0);
    setSwipeRotation(0);
    setSwipePreview(null);
    setIsSwipeDragging(false);
    setFlyOutDirection(null);
  }, [cardId]);

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
    // Không nhận cử chỉ khi tương tác đang bị khóa
    if (!canSwipe || isDisabled) return;

    // Không kích hoạt kéo khi người dùng bấm vào các nút tương tác bên trong (nút phát âm, link...)
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, textarea, select, [contenteditable='true']")) {
      return;
    }

    // Với chuột chỉ nhận chuột trái (button 0), với touch và pen luôn nhận
    if (event.pointerType === "mouse" && event.button !== 0) return;

    suppressClick.current = false;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      hasCaptured: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    const { isIntent, offset, rotation, previewProgress, resultType } = computeSwipeDrag(deltaX, deltaY);

    if (!gesture.hasCaptured) {
      if (isIntent) {
        gesture.hasCaptured = true;
        suppressClick.current = true;
        setIsSwipeDragging(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Bỏ qua nếu trình duyệt không hỗ trợ capture
        }
      } else {
        // Chưa rõ ý định hoặc đang cuộn trang dọc, nhường cho trình duyệt cuộn mượt mà
        return;
      }
    }

    // Cập nhật vị trí thẻ theo thời gian thực (bám sát ngón tay 1:1 và xoay góc nhẹ tự nhiên)
    setSwipeOffset(offset);
    setSwipeRotation(rotation);

    if (previewProgress > 0.05) {
      setSwipePreview({
        type: resultType,
        opacity: previewProgress,
        scale: 0.85 + 0.15 * previewProgress,
      });
    } else {
      setSwipePreview(null);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const wasDragging = gesture.hasCaptured;

    if (gesture.hasCaptured) {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Bỏ qua lỗi release capture
      }
    }

    gestureRef.current = null;
    setIsSwipeDragging(false);

    if (wasDragging) {
      suppressClick.current = true;
      const { isCommitted, resultType, offset } = computeSwipeDrag(deltaX, deltaY);

      // Cho phép quẹt ghi nhận đáp án ở cả mặt trước lẫn mặt sau khi vượt ngưỡng cam kết
      if (isCommitted && canSwipe && !isDisabled) {
        const flyDir = offset < 0 ? "left" : "right";
        setFlyOutDirection(flyDir);
        setSwipePreview(null);
        onSwipe(resultType);
        return;
      }
    }

    // Nếu nhả tay khi chưa đủ ngưỡng, kích hoạt đàn hồi (spring back) mềm mại về vị trí ban đầu
    setSwipeOffset(0);
    setSwipeRotation(0);
    setSwipePreview(null);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (gesture && gesture.pointerId === event.pointerId) {
      if (gesture.hasCaptured) {
        try {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Bỏ qua
        }
      }
    }
    gestureRef.current = null;
    suppressClick.current = true;
    setIsSwipeDragging(false);
    setSwipeOffset(0);
    setSwipeRotation(0);
    setSwipePreview(null);
  }

  // Tạo transform động: kết hợp độ dời kéo ngang và góc xoay vật lý
  const dynamicTransform = flyOutDirection
    ? undefined // Để CSS xử lý class .is-fly-out-left / .is-fly-out-right
    : swipeOffset !== 0 || swipeRotation !== 0
      ? `translate3d(${swipeOffset}px, 0, 0) rotate(${swipeRotation}deg)`
      : undefined;

  const glowClass = swipePreview
    ? swipePreview.type === "again"
      ? " swipe-glow-again"
      : " swipe-glow-remembered"
    : "";

  const flyClass = flyOutDirection === "left"
    ? " is-fly-out-left"
    : flyOutDirection === "right"
      ? " is-fly-out-right"
      : "";

  return (
    <article
      className={`study-flashcard${isFlipped ? " is-flipped" : ""}${isDisabled ? " is-disabled" : ""}${isSwipeDragging ? " is-swipe-dragging" : ""}${glowClass}${flyClass}`}
      style={{ transform: dynamicTransform }}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={
        isFlipped
          ? "Hide answer. Swipe left for Again or right for Remembered."
          : "Show answer. Swipe left for Again or right for Remembered."
      }
      aria-pressed={isFlipped}
      aria-disabled={isDisabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={(event) => {
        // Ngăn chặn sự kiện click khi vừa hoàn tất cử chỉ quẹt kéo
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest("button, a, input, textarea, select, [contenteditable='true']")) {
          return;
        }
        if (!isDisabled) onFlip();
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Con dấu hiển thị trạng thái quẹt nổi trực quan */}
      {swipePreview && (
        <span
          className={`study-swipe-preview ${swipePreview.type}`}
          style={{
            opacity: swipePreview.opacity,
            transform: `rotate(${swipePreview.type === "again" ? -10 : 10}deg) scale(${swipePreview.scale})`,
          }}
          aria-hidden="true"
        >
          {swipePreview.type === "again" ? "Forgot" : "Remembered"}
        </span>
      )}

      <div className="study-flashcard-inner">
        {/* Mặt trước của thẻ (Câu hỏi) - Hỗ trợ quẹt và chạm lật */}
        <div className="study-flashcard-face study-flashcard-front" aria-hidden={isFlipped}>
          <div className="study-flashcard-topline">
            <span>{directionLabel}</span>
            <AnswerStatus result={answerResult} />
          </div>
          <div className="study-flashcard-body">
            <div className="study-flashcard-face-content">
              <p className="study-flashcard-label">{promptLabel}</p>
              <div className="study-flashcard-text-row">
                <p className="study-flashcard-question">{question}</p>
                {isEnglishPrompt && (
                  <AudioPronounceButton text={question} size="lg" title="Listen to question" />
                )}
              </div>
              <p className="study-flashcard-hint">
                <Icon name="eye" size={18} /> Click the card to reveal the answer.
              </p>
            </div>
          </div>
        </div>

        {/* Mặt sau của thẻ (Đáp án) - Hỗ trợ quẹt và chạm lật */}
        <div className="study-flashcard-face study-flashcard-back" aria-hidden={!isFlipped}>
          <div className="study-flashcard-topline">
            <span>{directionLabel}</span>
            <AnswerStatus result={answerResult} />
          </div>
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
                      <p>
                        <strong>Example EN</strong>
                        {flashcard.example_en}
                      </p>
                      <AudioPronounceButton text={flashcard.example_en} size="sm" title="Listen to example" />
                    </div>
                  )}
                  {flashcard.example_vi && (
                    <p>
                      <strong>Example VI</strong>
                      {flashcard.example_vi}
                    </p>
                  )}
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
  return (
    <strong className={`study-flashcard-answer-status ${result}`}>
      {result === "again" ? "Marked Again" : "Remembered"}
    </strong>
  );
}
