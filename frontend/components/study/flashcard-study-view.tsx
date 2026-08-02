"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Flashcard } from "@/components/study/flashcard";
import { StudyProgress } from "@/components/study/study-progress";
import {
  countRememberedCards,
  getCardStudyDirection,
  getFirstUnrememberedCardId,
  getNextUnrememberedCardId,
} from "@/lib/study-session";
import {
  answerStudySessionCard,
  ApiRequestError,
  getStudySession,
  type StudyAnswerResult,
  type StudySession,
} from "@/services/api";

type FlashcardStudyViewProps = {
  sessionId: string;
};

export function FlashcardStudyView({ sessionId }: FlashcardStudyViewProps) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentCardId, setCurrentCardId] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnswerSubmitting, setIsAnswerSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const applyLoadedSession = useCallback((loadedSession: StudySession) => {
    setSession(loadedSession);
    setCurrentCardId((previousCardId) => {
      const currentCardStillNeedsStudy = loadedSession.session_cards.some(
        (card) => card.id === previousCardId && !card.remembered,
      );
      return currentCardStillNeedsStudy
        ? previousCardId
        : getFirstUnrememberedCardId(loadedSession.session_cards);
    });
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
  const canAnswer = Boolean(
    session?.status === "active" && currentCard && currentDirection && isFlipped && !isAnswerSubmitting,
  );

  const submitAnswer = useCallback(async (result: StudyAnswerResult) => {
    if (!session || !currentCard || !currentDirection || !isFlipped || isAnswerSubmitting) {
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

      if (result === "remembered") {
        setCurrentCardId(getNextUnrememberedCardId(updatedCards, currentCard.id));
      }
      // Day 10 deliberately keeps an Again card in place. Day 11 will replace
      // this with the Mastery queue that re-inserts it after other cards.
      setIsFlipped(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Could not save this answer.";

      try {
        // A network timeout can happen after the server commits. Reload first
        // instead of blindly re-posting and potentially counting an attempt twice.
        applyLoadedSession(await getStudySession(sessionId));
        setError(`${message} Session progress was reloaded before another answer.`);
      } catch {
        setError(`${message} Refresh this page before trying again.`);
      }
    } finally {
      setIsAnswerSubmitting(false);
    }
  }, [applyLoadedSession, currentCard, currentDirection, isAnswerSubmitting, isFlipped, session, sessionId]);

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
        || isAnswerSubmitting
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
  }, [canAnswer, isAnswerSubmitting, session?.status, submitAnswer]);

  if (isLoading) return <PageMessage>Loading study session…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;

  const isActive = session.status === "active";

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
          totalAttempts={session.total_attempts}
        />
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </p>
      )}

      {!isActive ? (
        <InactiveSession status={session.status} sheetId={session.sheet_id} />
      ) : currentCard && currentDirection ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>Current card {currentCardIndex + 1} of {session.total_cards}</span>
            <span>Flip, then choose Again (1) or Remembered (2).</span>
          </div>
          <Flashcard
            sessionCard={currentCard}
            direction={currentDirection}
            isFlipped={isFlipped}
            isDisabled={isAnswerSubmitting}
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
        <AllCardsRemembered sheetId={session.sheet_id} />
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

function InactiveSession({ status, sheetId }: { status: StudySession["status"]; sheetId: number }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-semibold">This session is {status}</h2>
      <p className="mt-2 text-slate-600">It is read-only and cannot accept more answers.</p>
      <Link href={`/sheets/${sheetId}`} className="mt-4 inline-block text-sm font-semibold text-sky-700 hover:underline">
        Back to sheet
      </Link>
    </section>
  );
}

function AllCardsRemembered({ sheetId }: { sheetId: number }) {
  return (
    <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <h2 className="text-xl font-semibold">All cards are marked Remembered</h2>
      <p className="mt-2">Session completion and the Mastery result screen will be added in Day 11.</p>
      <Link href={`/sheets/${sheetId}`} className="mt-4 inline-block text-sm font-semibold text-emerald-900 hover:underline">
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
