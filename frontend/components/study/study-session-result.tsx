"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate, formatLabel } from "@/lib/format";
import { ApiRequestError, getSheet, getStudySession, rateStudySession, type SheetDetail, type StudySession, type SrsRating } from "@/services/api";

type StudySessionResultProps = { sessionId: string };

export function StudySessionResult({ sessionId }: StudySessionResultProps) {
  const [session, setSession] = useState<StudySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRating, setIsRating] = useState(false);
  const [scheduledSheet, setScheduledSheet] = useState<SheetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadSession = useCallback(async () => {
    setIsLoading(true); setError(null); setNotFound(false);
    try { setSession(await getStudySession(sessionId)); }
    catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not load this session result.");
    }
    finally { setIsLoading(false); }
  }, [sessionId]);

  useEffect(() => {
    if (!session?.sheet_rating) return;
    let isCurrent = true;
    void getSheet(String(session.sheet_id)).then((sheet) => { if (isCurrent) setScheduledSheet(sheet); }).catch((caughtError: unknown) => {
      if (!isCurrent) return;
      setRatingError(caughtError instanceof Error ? `The rating was saved, but its updated schedule could not be loaded: ${caughtError.message}` : "The rating was saved, but its updated schedule could not be loaded.");
    });
    return () => { isCurrent = false; };
  }, [session?.id, session?.sheet_id, session?.sheet_rating]);

  useEffect(() => {
    let isCurrent = true;
    void getStudySession(sessionId).then((loadedSession) => { if (isCurrent) setSession(loadedSession); }).catch((caughtError: unknown) => {
      if (!isCurrent) return;
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) { setNotFound(true); return; }
      setError(caughtError instanceof Error ? caughtError.message : "Could not load this session result.");
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [sessionId]);

  const remainingCards = useMemo(() => session?.active_round?.round_cards.filter((card) => card.result === null).length ?? 0, [session]);
  const weakCards = useMemo(() => session?.session_cards.filter((card) => card.flashcard.is_weak) ?? [], [session]);

  async function rateCompletedSession(rating: SrsRating) {
    if (isRating) return;
    setIsRating(true); setRatingError(null);
    try { const result = await rateStudySession(sessionId, rating); setSession(result.session); setScheduledSheet(result.sheet); }
    catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Could not save this review rating.";
      try {
        const reloadedSession = await getStudySession(sessionId); setSession(reloadedSession);
        if (reloadedSession.sheet_rating) { setScheduledSheet(await getSheet(String(reloadedSession.sheet_id))); setRatingError(`${message} The saved session state was reloaded.`); }
        else setRatingError(`${message} You can try rating the session again.`);
      } catch { setRatingError(`${message} Refresh this page before trying again.`); }
    }
    finally { setIsRating(false); }
  }

  if (isLoading) return <ResultState>Loading session result…</ResultState>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;
  if (session.status === "abandoned") return <AbandonedSession sheetId={session.sheet_id} />;
  if (session.status === "active") return <IncompleteSession sessionId={session.id} remainingCards={remainingCards} />;

  return <CompletedResult session={session} weakCards={weakCards} scheduledSheet={scheduledSheet} isRating={isRating} ratingError={ratingError} onRate={rateCompletedSession} />;
}

function CompletedResult({ session, weakCards, scheduledSheet, isRating, ratingError, onRate }: { session: StudySession; weakCards: StudySession["session_cards"]; scheduledSheet: SheetDetail | null; isRating: boolean; ratingError: string | null; onRate: (rating: SrsRating) => Promise<void> }) {
  const supportsSrsRating = session.session_type === "new_learning" || session.session_type === "srs_review";
  const masteryScore = session.mastery_score ?? 0;
  const completedRounds = session.round_summaries;
  const firstRoundRecall = completedRounds[0]?.recall_percentage ?? 0;
  const finalRoundRecall = completedRounds.at(-1)?.recall_percentage ?? 0;
  return <section className="study-result-content">
    <header className="study-result-header"><Link href={`/sheets/${session.sheet_id}`} className="study-result-back"><Icon name="back" size={18} /> Back to sheet</Link><div className="study-result-title-row"><div><p className="study-result-kicker">{formatSessionType(session.session_type)} · Session #{session.id}</p><h1>Session complete</h1><p>Completed {formatDate(session.completed_at)}.</p></div><span className="study-result-success-icon"><Icon name="check" size={32} /></span></div></header>
    <div className="study-result-layout">
      <div className="study-result-main">
        <section className="study-result-score-card"><p className="eyebrow">Average mastery</p><strong>{masteryScore}%</strong><div className="study-result-score-track"><span style={{ width: `${Math.max(0, Math.min(masteryScore, 100))}%` }} /></div><p>Average recall across every completed round.</p></section>
        <section className="study-result-panel"><div className="study-result-section-heading"><div><p className="eyebrow">Session snapshot</p><h2>What you practiced</h2></div></div><dl className="study-result-stats"><Stat label="Rounds" value={String(completedRounds.length)} tone="lavender" /><Stat label="First-round recall" value={`${firstRoundRecall}%`} tone="gold" /><Stat label="Final-round recall" value={`${finalRoundRecall}%`} tone="mint" /><Stat label="Confirmed answers" value={String(session.total_attempts)} tone="neutral" /><Stat label="Again" value={String(session.again_count)} tone="rose" /></dl></section>
        <WeakCardPanel weakCards={weakCards} sheetId={session.sheet_id} />
      </div>
      <aside className="study-result-side"><SrsRatingPanel session={session} scheduledSheet={scheduledSheet} isRating={isRating} error={ratingError} supportsSrsRating={supportsSrsRating} onRate={onRate} /><div className="study-result-actions"><Link href={`/sheets/${session.sheet_id}`} className="study-result-primary-action"><Icon name="back" size={18} /> Back to sheet</Link><Link href={`/sheets/${session.sheet_id}/table`} className="study-result-secondary-action"><Icon name="books" size={18} /> Open Table View</Link><Link href={`/sheets/${session.sheet_id}/study`} className="study-result-secondary-action"><Icon name="refresh" size={18} /> Start another study</Link></div></aside>
    </div>
  </section>;
}

function WeakCardPanel({ weakCards, sheetId }: { weakCards: StudySession["session_cards"]; sheetId: number }) { return <section className="study-result-panel weak-card-panel"><div className="study-result-section-heading"><div><p className="eyebrow">Needs focus</p><h2>Weak cards</h2></div><Link href={`/sheets/${sheetId}/table`}>Open Table View <Icon name="arrow" size={16} /></Link></div>{weakCards.length === 0 ? <p className="study-result-muted">No enrolled cards are currently marked Weak.</p> : <ul>{weakCards.map((card) => <li key={card.id}><span className="weak-card-letter">{card.flashcard.phrase.slice(0, 1).toUpperCase()}</span><span><strong>{card.flashcard.phrase}</strong><small>{card.flashcard.meaning}</small></span></li>)}</ul>}</section>; }

function SrsRatingPanel({ session, scheduledSheet, isRating, error, supportsSrsRating, onRate }: { session: StudySession; scheduledSheet: SheetDetail | null; isRating: boolean; error: string | null; supportsSrsRating: boolean; onRate: (rating: SrsRating) => Promise<void> }) {
  if (!supportsSrsRating) return <section className="study-result-panel study-srs-panel"><p className="eyebrow">Review schedule</p><h2>Practice session</h2><p className="study-result-muted">This practice session does not change the sheet review schedule.</p></section>;
  if (session.sheet_rating) return <section aria-live="polite" className="study-result-panel study-srs-panel saved"><p className="eyebrow">Review schedule saved</p><h2>{formatLabel(session.sheet_rating)} rating saved</h2><p className="study-result-muted">The server updated the next review schedule for this sheet.</p>{scheduledSheet ? <dl className="study-schedule-stats"><Stat label="Next review" value={formatDate(scheduledSheet.next_review_at)} tone="neutral" /><Stat label="SRS level" value={`Level ${scheduledSheet.srs_level}`} tone="neutral" /><Stat label="Interval" value={`${scheduledSheet.interval_days} day${scheduledSheet.interval_days === 1 ? "" : "s"}`} tone="neutral" /></dl> : <p className="study-result-muted">Loading the saved schedule…</p>}{error && <p role="alert" className="study-result-inline-error">{error}</p>}</section>;
  return <section className="study-result-panel study-srs-panel"><p className="eyebrow">Spaced repetition</p><h2>How well did you remember?</h2><p className="study-result-muted">Choose a rating to save the next review date. The server calculates the schedule.</p>{error && <p role="alert" className="study-result-inline-error">{error}</p>}<div className="study-rating-grid"><RatingButton rating="forgot" label="Forgot" description="Review in 1 day" isRating={isRating} onRate={onRate} /><RatingButton rating="hard" label="Hard" description="Keep current interval" isRating={isRating} onRate={onRate} /><RatingButton rating="good" label="Good" description="Advance one SRS level" isRating={isRating} onRate={onRate} /><RatingButton rating="easy" label="Easy" description="Advance two SRS levels" isRating={isRating} onRate={onRate} /></div></section>;
}

function RatingButton({ rating, label, description, isRating, onRate }: { rating: SrsRating; label: string; description: string; isRating: boolean; onRate: (rating: SrsRating) => Promise<void> }) { return <button type="button" disabled={isRating} onClick={() => void onRate(rating)} className={`study-rating-button ${rating}`}><strong>{isRating ? "Saving…" : label}</strong><small>{description}</small></button>; }
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`study-result-stat ${tone}`}><dt>{label}</dt><dd>{value}</dd></div>; }
function IncompleteSession({ sessionId, remainingCards }: { sessionId: number; remainingCards: number }) { return <section className="study-result-state warning"><p className="eyebrow">Session in progress</p><h1>This session is not finished yet</h1><p>{remainingCards} card{remainingCards === 1 ? "" : "s"} still need to be remembered.</p><Link href={`/study-sessions/${sessionId}`}><Icon name="play" size={18} /> Continue studying</Link></section>; }
function AbandonedSession({ sheetId }: { sheetId: number }) { return <section className="study-result-state"><p className="eyebrow">Read-only session</p><h1>This session was abandoned</h1><p>It has no completion result.</p><Link href={`/sheets/${sheetId}`}>Back to sheet</Link></section>; }
function ResultState({ children }: { children: React.ReactNode }) { return <section className="study-result-state">{children}</section>; }
function NotFound() { return <section className="study-result-state"><h1>Study session not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="study-result-state error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
function formatSessionType(sessionType: StudySession["session_type"]) { if (sessionType === "weak_cards") return "Weak cards"; if (sessionType === "srs_review") return "Scheduled review"; return "All cards"; }
