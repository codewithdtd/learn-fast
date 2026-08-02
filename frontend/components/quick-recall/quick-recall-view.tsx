"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { RecallRow } from "@/components/quick-recall/recall-row";
import { QuickRecallSummary } from "@/components/quick-recall/quick-recall-summary";
import { QuickRecallToolbar } from "@/components/quick-recall/quick-recall-toolbar";
import { filterRecallCards, orderCardsByIds, shuffleCardIds, type RecallDirection, type RecallFilter } from "@/lib/quick-recall";
import { ApiRequestError, completeQuickRecall, getSheet, getSheetCards, type FlashcardListItem, type QuickRecallCompletion, type QuickRecallResult, type SheetDetail } from "@/services/api";

type QuickRecallViewProps = { sheetId: string };

export function QuickRecallView({ sheetId }: QuickRecallViewProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[]>([]);
  const [orderedCardIds, setOrderedCardIds] = useState<number[]>([]);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<RecallDirection>("en_to_vi");
  const [filter, setFilter] = useState<RecallFilter>("all");
  const [resultsByCardId, setResultsByCardId] = useState<Map<number, QuickRecallResult>>(new Map());
  const [completion, setCompletion] = useState<QuickRecallCompletion | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishAttempted, setFinishAttempted] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function loadQuickRecall() {
    setIsLoading(true); setError(null); setNotFound(false);
    try {
      const [loadedSheet, loadedCards] = await Promise.all([getSheet(sheetId), getSheetCards(sheetId)]);
      setSheet(loadedSheet); setCards(loadedCards); setOrderedCardIds(loadedCards.map((card) => card.id));
      setRevealedCardIds(new Set()); setDirection("en_to_vi"); setFilter("all"); setResultsByCardId(new Map());
      setCompletion(null); setIsFinishing(false); setFinishAttempted(false); setFinishError(null);
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not load Quick Recall.");
    } finally { setIsLoading(false); }
  }

  useEffect(() => {
    let isCurrent = true;
    void Promise.all([getSheet(sheetId), getSheetCards(sheetId)]).then(([loadedSheet, loadedCards]) => {
      if (!isCurrent) return;
      setSheet(loadedSheet); setCards(loadedCards); setOrderedCardIds(loadedCards.map((card) => card.id));
      setRevealedCardIds(new Set()); setDirection("en_to_vi"); setFilter("all"); setResultsByCardId(new Map());
      setCompletion(null); setIsFinishing(false); setFinishAttempted(false); setFinishError(null);
    }).catch((caughtError: unknown) => {
      if (!isCurrent) return;
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) { setNotFound(true); return; }
      setError(caughtError instanceof Error ? caughtError.message : "Could not load Quick Recall.");
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [sheetId]);

  const orderedCards = useMemo(() => orderCardsByIds(cards, orderedCardIds), [cards, orderedCardIds]);
  const visibleCards = useMemo(() => filterRecallCards(orderedCards, filter), [filter, orderedCards]);
  const rememberedCount = useMemo(() => Array.from(resultsByCardId.values()).filter((result) => result === "remembered").length, [resultsByCardId]);
  const needReviewCount = useMemo(() => Array.from(resultsByCardId.values()).filter((result) => result === "need_review").length, [resultsByCardId]);

  function changeDirection(nextDirection: RecallDirection) { if (nextDirection !== direction) { setDirection(nextDirection); setRevealedCardIds(new Set()); } }
  function changeReveal(cardId: number, shouldReveal: boolean) { setRevealedCardIds((currentIds) => { const nextIds = new Set(currentIds); if (shouldReveal) nextIds.add(cardId); else nextIds.delete(cardId); return nextIds; }); }
  function revealVisibleCards() { setRevealedCardIds((currentIds) => { const nextIds = new Set(currentIds); visibleCards.forEach((card) => nextIds.add(card.id)); return nextIds; }); }
  function hideVisibleCards() { setRevealedCardIds((currentIds) => { const nextIds = new Set(currentIds); visibleCards.forEach((card) => nextIds.delete(card.id)); return nextIds; }); }
  function changeResult(cardId: number, result: QuickRecallResult) { setResultsByCardId((currentResults) => { const nextResults = new Map(currentResults); nextResults.set(cardId, result); return nextResults; }); }

  async function finishQuickRecall() {
    if (resultsByCardId.size !== cards.length || cards.length === 0 || finishAttempted) return;
    setFinishAttempted(true); setIsFinishing(true); setFinishError(null);
    try { setCompletion(await completeQuickRecall(sheetId, cards.map((card) => ({ flashcard_id: card.id, result: resultsByCardId.get(card.id)! })))); }
    catch (caughtError) { setFinishError(caughtError instanceof Error ? `${caughtError.message} Refresh or check Table View before submitting again.` : "Could not confirm completion. Refresh or check Table View before submitting again."); }
    finally { setIsFinishing(false); }
  }

  if (isLoading) return <PageMessage>Loading Quick Recall…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !sheet) return <RetryError message={error} onRetry={loadQuickRecall} />;
  if (!sheet) return null;

  return <section className="quick-recall-content">
    <header className="quick-recall-header">
      <nav className="quick-recall-breadcrumb" aria-label="Breadcrumb"><Link href="/workbooks">Workbooks</Link><span>›</span><Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link><span>›</span><span aria-current="page">Quick Recall</span></nav>
      <div className="quick-recall-title-row"><div><Link href={`/sheets/${sheet.id}`} className="quick-recall-back"><Icon name="back" size={18} /> Back to sheet</Link><h1>Quick Recall</h1><p>Recall the answer first, then reveal it and self-assess.</p></div><Link href={`/sheets/${sheet.id}/table`} className="quick-recall-table-link">Table View <Icon name="arrow" size={18} /></Link></div>
    </header>

    <QuickRecallToolbar direction={direction} filter={filter} visibleCardCount={visibleCards.length} totalCardCount={cards.length} evaluatedCardCount={resultsByCardId.size} canShuffle={cards.length > 1} hasVisibleCards={visibleCards.length > 0} onDirectionChange={changeDirection} onFilterChange={setFilter} onRevealAll={revealVisibleCards} onHideAll={hideVisibleCards} onShuffle={() => setOrderedCardIds((currentIds) => shuffleCardIds(currentIds))} />

    {cards.length === 0 ? <PageMessage>This sheet has no flashcards for Quick Recall yet.</PageMessage> : visibleCards.length === 0 ? <section className="quick-recall-empty"><h2>No matching cards</h2><p>There are no cards in the selected filter.</p><button type="button" onClick={() => setFilter("all")}>Show all cards</button></section> : <div className="quick-recall-card-list">{visibleCards.map((card) => <RecallRow key={card.id} card={card} direction={direction} isRevealed={revealedCardIds.has(card.id)} selectedResult={resultsByCardId.get(card.id)} isResultSelectionDisabled={!revealedCardIds.has(card.id) || finishAttempted} onRevealChange={changeReveal} onResultChange={changeResult} />)}</div>}

    {cards.length > 0 && <QuickRecallSummary totalCards={cards.length} rememberedCount={rememberedCount} needReviewCount={needReviewCount} completion={completion} isFinishing={isFinishing} isFinishLocked={finishAttempted} finishError={finishError} onFinish={() => void finishQuickRecall()} sheetId={sheet.id} />}
  </section>;
}

function PageMessage({ children }: { children: React.ReactNode }) { return <section className="quick-recall-state">{children}</section>; }
function NotFound() { return <section className="quick-recall-state"><h1>Sheet not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="quick-recall-state quick-recall-state-error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
