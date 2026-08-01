"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Flashcard } from "@/components/study/flashcard";
import { StudyProgress } from "@/components/study/study-progress";
import {
  advanceMasteryQueue,
  buildMasteryQueue,
  countRememberedCards,
  getCardStudyDirection,
  getRetryGap,
} from "@/lib/study-session";
import {
  answerStudySessionCard,
  ApiRequestError,
  completeStudySession,
  getStudySession,
  type StudyAnswerResult,
  type StudySession,
} from "@/services/api";

type FlashcardStudyViewProps = {
  sessionId: string;
};

export function FlashcardStudyView({ sessionId }: FlashcardStudyViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<StudySession | null>(null);
  const [queueCardIds, setQueueCardIds] = useState<number[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnswerSubmitting, setIsAnswerSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const applyLoadedSession = useCallback((loadedSession: StudySession) => {
    setSession(loadedSession);
    // Queue placement is browser state. Rebuilding from persisted unremembered
    // cards after refresh keeps learning progress, even though it cannot retain
    // the exact retry placement that was visible before the refresh.
    setQueueCardIds(buildMasteryQueue(loadedSession.session_cards, loadedSession.id));
    setIsFlipped(false);
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      applyLoadedSession(await getStudySession(sessionId));
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this study session.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [applyLoadedSession, sessionId]);

  useEffect(() => {
    let isCurrent = true;

    void getStudySession(sessionId)
      .then((loadedSession) => {
        if (isCurrent) applyLoadedSession(loadedSession);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this study session.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [applyLoadedSession, sessionId]);

  const currentCardId = queueCardIds[0] ?? null;
  const currentCardIndex = useMemo(
    () => session?.session_cards.findIndex((card) => card.id === currentCardId) ?? -1,
    [currentCardId, session],
  );
  const currentCard = currentCardIndex >= 0 && session
    ? session.session_cards[currentCardIndex]
    : null;
  const currentDirection = currentCard && session
    ? getCardStudyDirection(session.direction, currentCard, currentCardIndex)
    : null;
  const rememberedCards = countRememberedCards(session?.session_cards ?? []);
  const remainingCards = (session?.session_cards.length ?? 0) - rememberedCards;
  const isInteractionLocked = isAnswerSubmitting || isCompleting;
  const canAnswer = Boolean(
    session?.status === "active" && currentCard && currentDirection && isFlipped && !isInteractionLocked,
  );

  const finishSession = useCallback(async () => {
    if (isCompleting) return;

    setIsCompleting(true);
    setError(null);
    try {
      const completedSession = await completeStudySession(sessionId);
      setSession(completedSession);
      router.replace(`/study-sessions/${completedSession.id}/result`);
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Could not save the session result.";

      try {
        const refreshedSession = await getStudySession(sessionId);
        applyLoadedSession(refreshedSession);
        if (refreshedSession.status === "completed") {
          router.replace(`/study-sessions/${refreshedSession.id}/result`);
          return;
        }
        setError(`${message} Session progress was reloaded before retrying completion.`);
      } catch {
        setError(`${message} Refresh this page before trying again.`);
      }
    } finally {
      setIsCompleting(false);
    }
  }, [applyLoadedSession, isCompleting, router, sessionId]);

  const submitAnswer = useCallback(async (result: StudyAnswerResult) => {
    if (!session || !currentCard || !currentDirection || !isFlipped || isInteractionLocked) {
      return;
    }

    setIsAnswerSubmitting(true);
    setError(null);
    try {
      const response = await answerStudySessionCard(sessionId, currentCard.flashcard_id, {
        direction: currentDirection,
        result,
      });
      const updatedCards = session.session_cards.map((card) => (
        card.flashcard_id === response.card_id
          ? {
              ...card,
              direction: response.direction,
              attempt_count: response.attempt_count,
              again_count: response.again_count,
              remembered: response.remembered,
              first_try_correct: response.first_try_correct,
            }
          : card
      ));
      setSession({
        ...session,
        total_attempts: response.total_attempts,
        again_count: response.session_again_count,
        first_try_correct: response.session_first_try_correct,
        session_cards: updatedCards,
      });

      const retryGap = result === "again"
        ? getRetryGap(session.id, currentCard.id, response.again_count)
        : undefined;
      const nextQueue = advanceMasteryQueue(queueCardIds, result, retryGap);
      setQueueCardIds(nextQueue);
      setIsFlipped(false);

      if (result === "remembered" && nextQueue.length === 0) {
        await finishSession();
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Could not save this answer.";

      try {
        // A timeout can happen after the server commits. Rebuild the queue from
        // GET state instead of retrying the answer and double-counting attempts.
        applyLoadedSession(await getStudySession(sessionId));
        setError(`${message} Session progress was reloaded before another answer.`);
      } catch {
        setError(`${message} Refresh this page before trying again.`);
      }
    } finally {
      setIsAnswerSubmitting(false);
    }
  }, [applyLoadedSession, currentCard, currentDirection, finishSession, isFlipped, isInteractionLocked, queueCardIds, session, sessionId]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || isTypingTarget(event.target)
        || session?.status !== "active"
        || isInteractionLocked
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setIsFlipped((flipped) => !flipped);
      } else if (event.key === "1" && canAnswer) {
        event.preventDefault();
        void submitAnswer("again");
      } else if (event.key === "2" && canAnswer) {
        event.preventDefault();
        void submitAnswer("remembered");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAnswer, isInteractionLocked, session?.status, submitAnswer]);

  if (isLoading) return <PageMessage>Loading study session…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;

  if (session.status === "completed") {
    return <CompletedSession sessionId={session.id} />;
  }
  if (session.status !== "active") {
    return <InactiveSession status={session.status} sheetId={session.sheet_id} />;
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/sheets/${session.sheet_id}`} className="text-sm font-medium text-sky-700 hover:underline">
          ← Back to sheet
        </Link>
        <p className="text-sm text-slate-500">Session #{session.id}</p>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">
          {formatSessionType(session.session_type)} · {formatDirection(session.direction)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Flashcard Study</h1>
        <p className="mt-2 text-slate-600">Recall the answer first, then flip the card to check yourself.</p>
      </div>

      <div className="mt-8">
        <StudyProgress
          totalCards={session.total_cards}
          rememberedCards={rememberedCards}
          remainingCards={remainingCards}
          queueLength={queueCardIds.length}
          totalAttempts={session.total_attempts}
        />
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </p>
      )}

      {isCompleting ? (
        <PageMessage>Saving session result…</PageMessage>
      ) : currentCard && currentDirection ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>Queue: {queueCardIds.length} card{queueCardIds.length === 1 ? "" : "s"} left</span>
            <span>Flip, then choose Again (1) or Remembered (2).</span>
          </div>
          <Flashcard
            sessionCard={currentCard}
            direction={currentDirection}
            isFlipped={isFlipped}
            isDisabled={isInteractionLocked}
            onFlip={() => setIsFlipped((flipped) => !flipped)}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canAnswer}
              onClick={() => void submitAnswer("again")}
              className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Again <span className="text-amber-800">(1)</span>
            </button>
            <button
              type="button"
              disabled={!canAnswer}
              onClick={() => void submitAnswer("remembered")}
              className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remembered <span className="text-emerald-100">(2)</span>
            </button>
          </div>
          {!isFlipped && <p className="mt-3 text-sm text-slate-600">Flip the card before recording your answer.</p>}
        </div>
      ) : (
        <FinishSessionPanel isCompleting={isCompleting} onFinish={finishSession} />
      )}
    </section>
  );
}

function formatDirection(direction: StudySession["direction"]) {
  if (direction === "en_to_vi") return "English → Vietnamese";
  if (direction === "vi_to_en") return "Vietnamese → English";
  return "Mixed direction";
}

function formatSessionType(sessionType: StudySession["session_type"]) {
  return sessionType === "weak_cards" ? "Weak cards" : "All cards";
}

function FinishSessionPanel({ isCompleting, onFinish }: { isCompleting: boolean; onFinish: () => Promise<void> }) {
  return (
    <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <h2 className="text-xl font-semibold">All cards are marked Remembered</h2>
      <p className="mt-2">Finish to save the Mastery result for this session.</p>
      <button
        type="button"
        disabled={isCompleting}
        onClick={() => void onFinish()}
        className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCompleting ? "Saving result…" : "Finish session"}
      </button>
    </section>
  );
}

function CompletedSession({ sessionId }: { sessionId: number }) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <h1 className="text-xl font-semibold">This session is complete</h1>
      <Link href={`/study-sessions/${sessionId}/result`} className="mt-4 inline-block font-semibold text-emerald-900 hover:underline">
        View session result
      </Link>
    </section>
  );
}

function InactiveSession({ status, sheetId }: { status: StudySession["status"]; sheetId: number }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-semibold">This session is {status}</h1>
      <p className="mt-2 text-slate-600">It is read-only and cannot accept more answers.</p>
      <Link href={`/sheets/${sheetId}`} className="mt-4 inline-block text-sm font-semibold text-sky-700 hover:underline">
        Back to sheet
      </Link>
    </section>
  );
}

function PageMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-slate-600">{children}</p>;
}

function NotFound() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Study session not found</h1>
      <Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">Back to workbooks</Link>
    </section>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p>{message}</p>
      <button type="button" onClick={() => void onRetry()} className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold">
        Try again
      </button>
    </section>
  );
}
