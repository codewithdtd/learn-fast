"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/layout/app-shell";
import { Flashcard } from "@/components/study/flashcard";
import { StudyProgress } from "@/components/study/study-progress";
import { advanceMasteryQueue, buildMasteryQueue, countRememberedCards, getCardStudyDirection, getRetryGap } from "@/lib/study-session";
import { answerStudySessionCard, ApiRequestError, completeStudySession, getStudySession, type StudyAnswerResult, type StudySession } from "@/services/api";

type FlashcardStudyViewProps = { sessionId: string };

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
    setQueueCardIds(buildMasteryQueue(loadedSession.session_cards, loadedSession.id));
    setIsFlipped(false);
  }, []);

  const loadSession = useCallback(async () => {
    setIsLoading(true); setError(null); setNotFound(false);
    try { applyLoadedSession(await getStudySession(sessionId)); }
    catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not load this study session.");
    }
    finally { setIsLoading(false); }
  }, [applyLoadedSession, sessionId]);

  useEffect(() => {
    let isCurrent = true;
    void getStudySession(sessionId).then((loadedSession) => {
      if (isCurrent) applyLoadedSession(loadedSession);
    }).catch((caughtError: unknown) => {
      if (!isCurrent) return;
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) { setNotFound(true); return; }
      setError(caughtError instanceof Error ? caughtError.message : "Could not load this study session.");
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [applyLoadedSession, sessionId]);

  const currentCardId = queueCardIds[0] ?? null;
  const currentCardIndex = useMemo(() => session?.session_cards.findIndex((card) => card.id === currentCardId) ?? -1, [currentCardId, session]);
  const currentCard = currentCardIndex >= 0 && session ? session.session_cards[currentCardIndex] : null;
  const currentDirection = currentCard && session ? getCardStudyDirection(session.direction, currentCard, currentCardIndex) : null;
  const rememberedCards = countRememberedCards(session?.session_cards ?? []);
  const remainingCards = (session?.session_cards.length ?? 0) - rememberedCards;
  const isInteractionLocked = isAnswerSubmitting || isCompleting;
  const canAnswer = Boolean(session?.status === "active" && currentCard && currentDirection && isFlipped && !isInteractionLocked);

  const finishSession = useCallback(async () => {
    if (isCompleting) return;
    setIsCompleting(true); setError(null);
    try {
      const completedSession = await completeStudySession(sessionId);
      setSession(completedSession);
      router.replace(`/study-sessions/${completedSession.id}/result`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Could not save the session result.";
      try {
        const refreshedSession = await getStudySession(sessionId);
        applyLoadedSession(refreshedSession);
        if (refreshedSession.status === "completed") { router.replace(`/study-sessions/${refreshedSession.id}/result`); return; }
        setError(`${message} Session progress was reloaded before retrying completion.`);
      } catch { setError(`${message} Refresh this page before trying again.`); }
    } finally { setIsCompleting(false); }
  }, [applyLoadedSession, isCompleting, router, sessionId]);

  const submitAnswer = useCallback(async (result: StudyAnswerResult) => {
    if (!session || !currentCard || !currentDirection || !isFlipped || isInteractionLocked) return;
    setIsAnswerSubmitting(true); setError(null);
    try {
      const response = await answerStudySessionCard(sessionId, currentCard.flashcard_id, { direction: currentDirection, result });
      const updatedCards = session.session_cards.map((card) => card.flashcard_id === response.card_id ? { ...card, direction: response.direction, attempt_count: response.attempt_count, again_count: response.again_count, remembered: response.remembered, first_try_correct: response.first_try_correct } : card);
      setSession({ ...session, total_attempts: response.total_attempts, again_count: response.session_again_count, first_try_correct: response.session_first_try_correct, session_cards: updatedCards });
      const retryGap = result === "again" ? getRetryGap(session.id, currentCard.id, response.again_count) : undefined;
      const nextQueue = advanceMasteryQueue(queueCardIds, result, retryGap);
      setQueueCardIds(nextQueue); setIsFlipped(false);
      if (result === "remembered" && nextQueue.length === 0) await finishSession();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Could not save this answer.";
      try { applyLoadedSession(await getStudySession(sessionId)); setError(`${message} Session progress was reloaded before another answer.`); }
      catch { setError(`${message} Refresh this page before trying again.`); }
    } finally { setIsAnswerSubmitting(false); }
  }, [applyLoadedSession, currentCard, currentDirection, finishSession, isFlipped, isInteractionLocked, queueCardIds, session, sessionId]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable); }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target) || session?.status !== "active" || isInteractionLocked) return;
      if (event.code === "Space") { event.preventDefault(); setIsFlipped((flipped) => !flipped); }
      else if (event.key === "1" && canAnswer) { event.preventDefault(); void submitAnswer("again"); }
      else if (event.key === "2" && canAnswer) { event.preventDefault(); void submitAnswer("remembered"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAnswer, isInteractionLocked, session?.status, submitAnswer]);

  if (isLoading) return <SessionState>Loading study session…</SessionState>;
  if (notFound) return <NotFound />;
  if (error && !session) return <RetryError message={error} onRetry={loadSession} />;
  if (!session) return null;
  if (session.status === "completed") return <CompletedSession sessionId={session.id} />;
  if (session.status !== "active") return <InactiveSession status={session.status} sheetId={session.sheet_id} />;

  return <section className="study-session-content">
    <header className="study-session-header"><Link href={`/sheets/${session.sheet_id}`} className="study-session-back"><Icon name="back" size={18} /> Back to sheet</Link><div className="study-session-context"><div><p className="study-session-kicker">{formatSessionType(session.session_type)} · {formatDirection(session.direction)}</p><h1>Flashcard Study</h1><p>Recall the answer first, then reveal it and self-assess.</p></div><span className="study-session-id">Session #{session.id}</span></div></header>
    <StudyProgress totalCards={session.total_cards} rememberedCards={rememberedCards} remainingCards={remainingCards} queueLength={queueCardIds.length} totalAttempts={session.total_attempts} />
    {error && <p role="alert" className="study-session-inline-error">{error}</p>}
    {isCompleting ? <SessionState>Saving session result…</SessionState> : currentCard && currentDirection ? <div className="study-session-practice"><div className="study-session-practice-meta"><span>{queueCardIds.length} card{queueCardIds.length === 1 ? "" : "s"} remaining</span><span className="study-keyboard-hint">Flip, then press 1 for Again or 2 for Remembered.</span></div><Flashcard sessionCard={currentCard} direction={currentDirection} isFlipped={isFlipped} isDisabled={isInteractionLocked} onFlip={() => setIsFlipped((flipped) => !flipped)} /><div className="study-answer-actions"><button type="button" className="study-answer-button again" disabled={!canAnswer} onClick={() => void submitAnswer("again")}><Icon name="refresh" size={21} /> Again <span>(1)</span></button><button type="button" className="study-answer-button remembered" disabled={!canAnswer} onClick={() => void submitAnswer("remembered")}><Icon name="check" size={21} /> Remembered <span>(2)</span></button></div>{!isFlipped && <p className="study-answer-reminder">Reveal the answer before recording your answer.</p>}</div> : <FinishSessionPanel isCompleting={isCompleting} onFinish={finishSession} />}
  </section>;
}

function formatDirection(direction: StudySession["direction"]) { if (direction === "en_to_vi") return "English → Vietnamese"; if (direction === "vi_to_en") return "Vietnamese → English"; return "Mixed direction"; }
function formatSessionType(sessionType: StudySession["session_type"]) { if (sessionType === "weak_cards") return "Weak cards"; if (sessionType === "srs_review") return "Scheduled review"; return "All cards"; }
function FinishSessionPanel({ isCompleting, onFinish }: { isCompleting: boolean; onFinish: () => Promise<void> }) { return <section className="study-session-finish"><p className="eyebrow">Queue complete</p><h2>All cards are marked Remembered</h2><p>Finish to save the result for this study session.</p><button type="button" disabled={isCompleting} onClick={() => void onFinish()}>Finish session <Icon name="arrow" size={19} /></button></section>; }
function CompletedSession({ sessionId }: { sessionId: number }) { return <section className="study-session-state success"><Icon name="check" size={34} /><h1>This session is complete</h1><Link href={`/study-sessions/${sessionId}/result`}>View session result <Icon name="arrow" size={18} /></Link></section>; }
function InactiveSession({ status, sheetId }: { status: StudySession["status"]; sheetId: number }) { return <section className="study-session-state"><h1>This session is {status}</h1><p>It is read-only and cannot accept more answers.</p><Link href={`/sheets/${sheetId}`}>Back to sheet</Link></section>; }
function SessionState({ children }: { children: React.ReactNode }) { return <section className="study-session-state">{children}</section>; }
function NotFound() { return <section className="study-session-state"><h1>Study session not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="study-session-state error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
