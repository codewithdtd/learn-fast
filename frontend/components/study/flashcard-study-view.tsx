"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/layout/app-shell";
import { Flashcard } from "@/components/study/flashcard";
import { StudyProgress } from "@/components/study/study-progress";
import { countRoundAnswers, getCardStudyDirection, getInitialRoundCardIndex } from "@/lib/study-session";
import {
  answerStudySessionRoundCard,
  ApiRequestError,
  completeStudySession,
  createStudySessionRound,
  getStudySession,
  type StudyAnswerResult,
  type StudyRoundScope,
  type StudySession,
} from "@/services/api";

type FlashcardStudyViewProps = { sessionId: string };

export function FlashcardStudyView({ sessionId }: FlashcardStudyViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<StudySession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnswerSubmitting, setIsAnswerSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const applyLoadedSession = useCallback((loadedSession: StudySession) => {
    setSession(loadedSession);
    setCurrentIndex(getInitialRoundCardIndex(loadedSession.active_round?.round_cards ?? []));
    setIsFlipped(false);
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true); setError(null); setNotFound(false);
    try { applyLoadedSession(await getStudySession(sessionId)); }
    catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not load this study session.");
    } finally { setIsLoading(false); }
  }, [applyLoadedSession, sessionId]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const activeRound = session?.active_round ?? null;
  const latestRound = session?.round_summaries.at(-1) ?? null;
  const roundCards = activeRound?.round_cards ?? [];
  const currentRoundCard = roundCards[currentIndex] ?? null;
  const currentCard = currentRoundCard?.session_card ?? null;
  const currentDirection = currentCard && session ? getCardStudyDirection(session.direction, currentCard, currentIndex) : null;
  const roundCounts = useMemo(() => countRoundAnswers(roundCards), [roundCards]);
  const isInteractionLocked = isAnswerSubmitting || isFinishing || isStartingRound;
  const canAnswer = Boolean(activeRound && currentCard && currentDirection && !isInteractionLocked);

  const navigate = useCallback((nextIndex: number) => {
    if (isInteractionLocked || nextIndex < 0 || nextIndex >= roundCards.length) return;
    setCurrentIndex(nextIndex); setIsFlipped(false);
  }, [isInteractionLocked, roundCards.length]);

  const refreshAfterFailure = useCallback(async (message: string) => {
    try { applyLoadedSession(await getStudySession(sessionId)); setError(`${message} Progress was reloaded.`); }
    catch { setError(`${message} Refresh this page before trying again.`); }
  }, [applyLoadedSession, sessionId]);

  const finishLegacyPerfectSession = useCallback(async () => {
    if (isFinishing) return;
    setIsFinishing(true); setError(null);
    try {
      const completedSession = await completeStudySession(sessionId);
      setSession(completedSession);
      router.replace(`/study-sessions/${completedSession.id}/result`);
    } catch (caughtError) {
      await refreshAfterFailure(caughtError instanceof Error ? caughtError.message : "Could not finish this session.");
    } finally { setIsFinishing(false); }
  }, [isFinishing, refreshAfterFailure, router, sessionId]);

  useEffect(() => {
    // Sessions already left at a perfect round before this change are completed
    // automatically too. New sessions complete in the final answer request.
    if (session?.status === "active" && !activeRound && latestRound?.recall_percentage === 100 && !isFinishing) {
      void finishLegacyPerfectSession();
    }
  }, [activeRound, finishLegacyPerfectSession, isFinishing, latestRound?.id, latestRound?.recall_percentage, session?.status]);

  const submitAnswer = useCallback(async (result: StudyAnswerResult) => {
    if (!session || !activeRound || !currentRoundCard || !currentCard || !currentDirection || isInteractionLocked) return;
    setIsAnswerSubmitting(true); setError(null);
    try {
      const updatedSession = await answerStudySessionRoundCard(
        sessionId, activeRound.id, currentCard.flashcard_id, { direction: currentDirection, result },
      );
      setSession(updatedSession);
      // Results are markers, not a retry queue. Both buttons move to the next
      // physical card exactly once, never search backward and never wrap.
      if (updatedSession.status === "completed") {
        router.replace(`/study-sessions/${updatedSession.id}/result`);
      } else if (updatedSession.active_round && currentIndex < updatedSession.active_round.round_cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
      setIsFlipped(false);
    } catch (caughtError) {
      await refreshAfterFailure(caughtError instanceof Error ? caughtError.message : "Could not save this answer.");
    } finally { setIsAnswerSubmitting(false); }
  }, [activeRound, currentCard, currentDirection, currentIndex, currentRoundCard, isInteractionLocked, refreshAfterFailure, router, session, sessionId]);

  const startRound = useCallback(async (scope: StudyRoundScope) => {
    if (isStartingRound) return;
    setIsStartingRound(true); setError(null);
    try { applyLoadedSession(await createStudySessionRound(sessionId, scope)); }
    catch (caughtError) { await refreshAfterFailure(caughtError instanceof Error ? caughtError.message : "Could not start another round."); }
    finally { setIsStartingRound(false); }
  }, [applyLoadedSession, isStartingRound, refreshAfterFailure, sessionId]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target) || !canAnswer) return;
      if (event.key === "1") { event.preventDefault(); void submitAnswer("again"); }
      if (event.key === "2") { event.preventDefault(); void submitAnswer("remembered"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAnswer, submitAnswer]);

  if (isLoading) return <SessionState>Loading study session...</SessionState>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;
  if (session.status === "completed") return <CompletedSession sessionId={session.id} />;
  if (session.status !== "active") return <InactiveSession status={session.status} sheetId={session.sheet_id} />;

  return <section className="study-session-content">
    <header className="study-session-header"><Link href={`/sheets/${session.sheet_id}`} className="study-session-back"><Icon name="back" size={18} /> Back to sheet</Link><div className="study-session-context"><div><p className="study-session-kicker">{formatSessionType(session.session_type)} · {formatDirection(session.direction)}</p><h1>Flashcard Study</h1><p>Recall the answer, reveal it, then record what you remember.</p></div><span className="study-session-id">Session #{session.id}</span></div></header>
    {error && <p role="alert" className="study-session-inline-error">{error}</p>}
    {activeRound ? <>
      <StudyProgress roundNumber={activeRound.round_number} totalCards={activeRound.total_cards} answeredCards={roundCounts.answered} rememberedCards={roundCounts.remembered} againCards={roundCounts.again} />
      {currentCard && currentDirection ? <div className="study-session-practice">
        <div className="study-session-practice-meta"><span>Card {currentIndex + 1} of {roundCards.length}</span><span className="study-keyboard-hint">Use 1 for Again or 2 for Remembered.</span></div>
        <Flashcard sessionCard={currentCard} direction={currentDirection} isFlipped={isFlipped} isDisabled={isInteractionLocked} answerResult={currentRoundCard.result} onFlip={() => setIsFlipped((flipped) => !flipped)} />
        <div className="study-card-navigation" aria-label="Card navigation"><button type="button" className="study-card-navigation-button" disabled={currentIndex === 0 || isInteractionLocked} onClick={() => navigate(currentIndex - 1)}><Icon name="back" size={18} /> Previous</button><span>{currentIndex + 1} / {roundCards.length}</span><button type="button" className="study-card-navigation-button" disabled={currentIndex === roundCards.length - 1 || isInteractionLocked} onClick={() => navigate(currentIndex + 1)}>Next <Icon name="arrow" size={18} /></button></div>
        <div className="study-answer-actions"><button type="button" aria-pressed={currentRoundCard.result === "again"} className={`study-answer-button again${currentRoundCard.result === "again" ? " is-selected" : ""}`} disabled={!canAnswer} onClick={() => void submitAnswer("again")}><Icon name="refresh" size={21} /> Again <span>(1)</span></button><button type="button" aria-pressed={currentRoundCard.result === "remembered"} className={`study-answer-button remembered${currentRoundCard.result === "remembered" ? " is-selected" : ""}`} disabled={!canAnswer} onClick={() => void submitAnswer("remembered")}><Icon name="check" size={21} /> Remembered <span>(2)</span></button></div>
      </div> : <SessionState>This round has no cards.</SessionState>}
    </> : latestRound ? latestRound.recall_percentage === 100 ? <SessionState>Completing session…</SessionState> : <RoundSummary round={latestRound} isBusy={isInteractionLocked} onStartRound={startRound} /> : <SessionState>There is no active study round.</SessionState>}
  </section>;
}

function RoundSummary({ round, isBusy, onStartRound }: { round: StudySession["round_summaries"][number]; isBusy: boolean; onStartRound: (scope: StudyRoundScope) => Promise<void> }) {
  return <section className="study-round-summary"><p className="eyebrow">Round {round.round_number} complete</p><h2>{round.recall_percentage}% remembered</h2><dl><div><dt>Remembered</dt><dd>{round.remembered_count}</dd></div><div><dt>Again</dt><dd>{round.again_count}</dd></div><div><dt>Cards</dt><dd>{round.total_cards}</dd></div></dl><p>Choose a focused retry, or repeat the full set before finishing.</p><div className="study-round-summary-actions"><button type="button" disabled={isBusy} onClick={() => void onStartRound("forgotten")}>Study only forgotten cards <Icon name="arrow" size={18} /></button><button type="button" className="secondary" disabled={isBusy} onClick={() => void onStartRound("all")}>Study all cards again <Icon name="refresh" size={18} /></button></div></section>;
}

function formatDirection(direction: StudySession["direction"]) { if (direction === "en_to_vi") return "English to Vietnamese"; if (direction === "vi_to_en") return "Vietnamese to English"; return "Mixed direction"; }
function formatSessionType(sessionType: StudySession["session_type"]) { if (sessionType === "weak_cards") return "Weak cards"; if (sessionType === "srs_review") return "Scheduled review"; return "All cards"; }
function CompletedSession({ sessionId }: { sessionId: number }) { return <section className="study-session-state success"><Icon name="check" size={34} /><h1>This session is complete</h1><Link href={`/study-sessions/${sessionId}/result`}>View session result <Icon name="arrow" size={18} /></Link></section>; }
function InactiveSession({ status, sheetId }: { status: StudySession["status"]; sheetId: number }) { return <section className="study-session-state"><h1>This session is {status}</h1><p>It is read-only and cannot accept more answers.</p><Link href={`/sheets/${sheetId}`}>Back to sheet</Link></section>; }
function SessionState({ children }: { children: ReactNode }) { return <section className="study-session-state">{children}</section>; }
function NotFound() { return <section className="study-session-state"><h1>Study session not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="study-session-state error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
