"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDate, formatLabel } from "@/lib/format";
import {
  ApiRequestError,
  completeStudySession,
  getSheet,
  getStudySession,
  rateStudySession,
  type SheetDetail,
  type StudySession,
  type SrsRating,
} from "@/services/api";

type StudySessionResultProps = {
  sessionId: string;
};

export function StudySessionResult({ sessionId }: StudySessionResultProps) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [scheduledSheet, setScheduledSheet] = useState<SheetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setSession(await getStudySession(sessionId));
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this session result.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!session?.sheet_rating) return;

    let isCurrent = true;
    void getSheet(String(session.sheet_id))
      .then((sheet) => {
        if (isCurrent) setScheduledSheet(sheet);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        setRatingError(
          caughtError instanceof Error
            ? `The rating was saved, but its updated schedule could not be loaded: ${caughtError.message}`
            : "The rating was saved, but its updated schedule could not be loaded.",
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [session?.id, session?.sheet_id, session?.sheet_rating]);

  useEffect(() => {
    let isCurrent = true;

    void getStudySession(sessionId)
      .then((loadedSession) => {
        if (isCurrent) setSession(loadedSession);
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
            : "Could not load this session result.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionId]);

  const remainingCards = useMemo(
    () => session?.session_cards.filter((card) => !card.remembered).length ?? 0,
    [session],
  );
  const weakCards = useMemo(
    () => session?.session_cards.filter((card) => card.flashcard.is_weak) ?? [],
    [session],
  );

  async function finishSession() {
    if (isCompleting) return;

    setIsCompleting(true);
    setError(null);
    try {
      setSession(await completeStudySession(sessionId));
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Could not complete this session.";
      try {
        setSession(await getStudySession(sessionId));
        setError(`${message} Session progress was reloaded before retrying completion.`);
      } catch {
        setError(`${message} Refresh this page before trying again.`);
      }
    } finally {
      setIsCompleting(false);
    }
  }

  async function rateCompletedSession(rating: SrsRating) {
    if (isRating) return;

    setIsRating(true);
    setRatingError(null);
    try {
      const result = await rateStudySession(sessionId, rating);
      setSession(result.session);
      setScheduledSheet(result.sheet);
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : "Could not save this review rating.";
      try {
        const reloadedSession = await getStudySession(sessionId);
        setSession(reloadedSession);
        if (reloadedSession.sheet_rating) {
          setScheduledSheet(await getSheet(String(reloadedSession.sheet_id)));
          setRatingError(`${message} The saved session state was reloaded.`);
        } else {
          setRatingError(`${message} You can try rating the session again.`);
        }
      } catch {
        setRatingError(`${message} Refresh this page before trying again.`);
      }
    } finally {
      setIsRating(false);
    }
  }

  if (isLoading) return <PageMessage>Loading session result…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;

  if (session.status === "abandoned") {
    return <AbandonedSession sheetId={session.sheet_id} />;
  }
  if (session.status === "active" && remainingCards > 0) {
    return <IncompleteSession sessionId={session.id} remainingCards={remainingCards} />;
  }
  if (session.status === "active") {
    return <FinishSessionPanel isCompleting={isCompleting} error={error} onFinish={finishSession} />;
  }

  return (
    <CompletedResult
      session={session}
      weakCards={weakCards}
      scheduledSheet={scheduledSheet}
      isRating={isRating}
      ratingError={ratingError}
      onRate={rateCompletedSession}
    />
  );
}

function CompletedResult({
  session,
  weakCards,
  scheduledSheet,
  isRating,
  ratingError,
  onRate,
}: {
  session: StudySession;
  weakCards: StudySession["session_cards"];
  scheduledSheet: SheetDetail | null;
  isRating: boolean;
  ratingError: string | null;
  onRate: (rating: SrsRating) => Promise<void>;
}) {
  const supportsSrsRating = session.session_type === "new_learning" || session.session_type === "srs_review";

  return (
    <section>
      <Link href={`/sheets/${session.sheet_id}`} className="text-sm font-medium text-sky-700 hover:underline">
        ← Back to sheet
      </Link>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-800">Mastery session complete</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{session.mastery_score}% mastery</h1>
        <p className="mt-2">Completed {formatDate(session.completed_at)}.</p>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total cards" value={String(session.total_cards)} />
        <Stat label="Total attempts" value={String(session.total_attempts)} />
        <Stat label="First-try correct" value={String(session.first_try_correct)} />
        <Stat label="Again" value={String(session.again_count)} />
        <Stat label="Mastery score" value={`${session.mastery_score}%`} />
      </dl>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold">Weak cards</h2>
        {weakCards.length === 0 ? (
          <p className="mt-2 text-slate-600">No enrolled cards are currently marked Weak.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {weakCards.map((card) => (
              <li key={card.id} className="py-3">
                <p className="font-semibold text-slate-900">{card.flashcard.phrase}</p>
                <p className="mt-1 text-sm text-slate-600">{card.flashcard.meaning}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SrsRatingPanel
        session={session}
        scheduledSheet={scheduledSheet}
        isRating={isRating}
        error={ratingError}
        supportsSrsRating={supportsSrsRating}
        onRate={onRate}
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/sheets/${session.sheet_id}`} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
          Back to sheet
        </Link>
        <Link href={`/sheets/${session.sheet_id}/table`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
          Open Table View
        </Link>
        <Link href={`/sheets/${session.sheet_id}/study`} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
          Start another study
        </Link>
      </div>
    </section>
  );
}

function SrsRatingPanel({
  session,
  scheduledSheet,
  isRating,
  error,
  supportsSrsRating,
  onRate,
}: {
  session: StudySession;
  scheduledSheet: SheetDetail | null;
  isRating: boolean;
  error: string | null;
  supportsSrsRating: boolean;
  onRate: (rating: SrsRating) => Promise<void>;
}) {
  if (!supportsSrsRating) {
    return (
      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-xl font-semibold">Review schedule</h2>
        <p className="mt-2 text-slate-600">This practice session does not change the sheet review schedule.</p>
      </section>
    );
  }

  if (session.sheet_rating) {
    return (
      <section aria-live="polite" className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
        <h2 className="text-xl font-semibold">Review schedule saved</h2>
        <p className="mt-2">You rated this session <span className="font-semibold">{formatLabel(session.sheet_rating)}</span>.</p>
        {scheduledSheet ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Next review" value={formatDate(scheduledSheet.next_review_at)} />
            <Stat label="SRS level" value={`Level ${scheduledSheet.srs_level}`} />
            <Stat label="Interval" value={`${scheduledSheet.interval_days} day${scheduledSheet.interval_days === 1 ? "" : "s"}`} />
            <Stat label="Schedule status" value={formatLabel(scheduledSheet.status)} />
          </dl>
        ) : (
          <p className="mt-4 text-sm">Loading the schedule saved by the serverâ€¦</p>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-rose-800">{error}</p>}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
      <h2 className="text-xl font-semibold">How well did you remember this sheet?</h2>
      <p className="mt-2 text-sm">Choose one rating to save the next review date. The server calculates the schedule.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RatingButton rating="forgot" label="Forgot" description="Review in 1 day" isRating={isRating} onRate={onRate} />
        <RatingButton rating="hard" label="Hard" description="Keep the current interval" isRating={isRating} onRate={onRate} />
        <RatingButton rating="good" label="Good" description="Advance one SRS level" isRating={isRating} onRate={onRate} />
        <RatingButton rating="easy" label="Easy" description="Advance two SRS levels" isRating={isRating} onRate={onRate} />
      </div>
    </section>
  );
}

function RatingButton({
  rating,
  label,
  description,
  isRating,
  onRate,
}: {
  rating: SrsRating;
  label: string;
  description: string;
  isRating: boolean;
  onRate: (rating: SrsRating) => Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={isRating}
      onClick={() => void onRate(rating)}
      className="rounded-lg border border-sky-300 bg-white p-3 text-left hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="block font-semibold">{isRating ? "Savingâ€¦" : label}</span>
      <span className="mt-1 block text-sm text-slate-600">{description}</span>
    </button>
  );
}

function FinishSessionPanel({
  isCompleting,
  error,
  onFinish,
}: {
  isCompleting: boolean;
  error: string | null;
  onFinish: () => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
      <h1 className="text-xl font-semibold">All cards are remembered</h1>
      <p className="mt-2">Finish this session to calculate and save its Mastery score.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
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

function IncompleteSession({ sessionId, remainingCards }: { sessionId: number; remainingCards: number }) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h1 className="text-xl font-semibold">This session is not finished yet</h1>
      <p className="mt-2">{remainingCards} card{remainingCards === 1 ? "" : "s"} still need to be remembered.</p>
      <Link href={`/study-sessions/${sessionId}`} className="mt-4 inline-block font-semibold text-amber-900 hover:underline">
        Continue studying
      </Link>
    </section>
  );
}

function AbandonedSession({ sheetId }: { sheetId: number }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-semibold">This session was abandoned</h1>
      <p className="mt-2 text-slate-600">It is read-only and has no completion result.</p>
      <Link href={`/sheets/${sheetId}`} className="mt-4 inline-block font-semibold text-sky-700 hover:underline">
        Back to sheet
      </Link>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
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
