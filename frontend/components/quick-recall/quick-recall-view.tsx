"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  filterRecallCards,
  orderCardsByIds,
  shuffleCardIds,
  type RecallDirection,
  type RecallFilter,
} from "@/lib/quick-recall";
import { RecallRow } from "@/components/quick-recall/recall-row";
import { QuickRecallToolbar } from "@/components/quick-recall/quick-recall-toolbar";
import {
  ApiRequestError,
  getSheet,
  getSheetCards,
  type FlashcardListItem,
  type SheetDetail,
} from "@/services/api";

type QuickRecallViewProps = {
  sheetId: string;
};

export function QuickRecallView({ sheetId }: QuickRecallViewProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[]>([]);
  const [orderedCardIds, setOrderedCardIds] = useState<number[]>([]);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<RecallDirection>("en_to_vi");
  const [filter, setFilter] = useState<RecallFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function loadQuickRecall() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [loadedSheet, loadedCards] = await Promise.all([
        getSheet(sheetId),
        getSheetCards(sheetId),
      ]);
      setSheet(loadedSheet);
      setCards(loadedCards);
      setOrderedCardIds(loadedCards.map((card) => card.id));
      setRevealedCardIds(new Set());
      setDirection("en_to_vi");
      setFilter("all");
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Không thể tải Quick Recall.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // A route can change before either request completes. Ignore that old
    // response so the visible sheet, ordering, and reveal state stay aligned.
    void Promise.all([getSheet(sheetId), getSheetCards(sheetId)])
      .then(([loadedSheet, loadedCards]) => {
        if (!isCurrent) return;
        setSheet(loadedSheet);
        setCards(loadedCards);
        setOrderedCardIds(loadedCards.map((card) => card.id));
        setRevealedCardIds(new Set());
        setDirection("en_to_vi");
        setFilter("all");
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
            : "Không thể tải Quick Recall.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sheetId]);

  const orderedCards = useMemo(
    () => orderCardsByIds(cards, orderedCardIds),
    [cards, orderedCardIds],
  );
  const visibleCards = useMemo(
    () => filterRecallCards(orderedCards, filter),
    [filter, orderedCards],
  );

  function changeDirection(nextDirection: RecallDirection) {
    if (nextDirection === direction) return;

    // A revealed answer in one direction becomes the question in the other,
    // so every answer must be hidden before the user starts recalling again.
    setDirection(nextDirection);
    setRevealedCardIds(new Set());
  }

  function changeReveal(cardId: number, shouldReveal: boolean) {
    setRevealedCardIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (shouldReveal) nextIds.add(cardId);
      else nextIds.delete(cardId);
      return nextIds;
    });
  }

  function revealVisibleCards() {
    setRevealedCardIds((currentIds) => {
      const nextIds = new Set(currentIds);
      visibleCards.forEach((card) => nextIds.add(card.id));
      return nextIds;
    });
  }

  function hideVisibleCards() {
    setRevealedCardIds((currentIds) => {
      const nextIds = new Set(currentIds);
      visibleCards.forEach((card) => nextIds.delete(card.id));
      return nextIds;
    });
  }

  function shuffleCards() {
    setOrderedCardIds((currentIds) => shuffleCardIds(currentIds));
  }

  if (isLoading) return <PageMessage>Đang tải Quick Recall…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !sheet) return <RetryError message={error} onRetry={loadQuickRecall} />;
  if (!sheet) return null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/sheets/${sheet.id}`}
          className="text-sm font-medium text-sky-700 hover:underline"
        >
          ← {sheet.name}
        </Link>
        <Link
          href={`/sheets/${sheet.id}/table`}
          className="text-sm font-medium text-sky-700 hover:underline"
        >
          Open Table View
        </Link>
      </div>
      <div className="mt-4">
        <p className="text-sm text-slate-500">{sheet.workbook.name}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Quick Recall</h1>
        <p className="mt-2 text-slate-600">
          Nhìn câu hỏi, tự nhớ đáp án, rồi bấm Show để kiểm tra.
        </p>
      </div>

      <QuickRecallToolbar
        direction={direction}
        filter={filter}
        visibleCardCount={visibleCards.length}
        totalCardCount={cards.length}
        canShuffle={cards.length > 1}
        hasVisibleCards={visibleCards.length > 0}
        onDirectionChange={changeDirection}
        onFilterChange={setFilter}
        onRevealAll={revealVisibleCards}
        onHideAll={hideVisibleCards}
        onShuffle={shuffleCards}
      />

      {cards.length === 0 ? (
        <PageMessage>Sheet này chưa có flashcard để luyện Quick Recall.</PageMessage>
      ) : visibleCards.length === 0 ? (
        <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">Không có card phù hợp</h2>
          <p className="mt-2 text-slate-600">
            Sheet này chưa có card thuộc filter {filter === "weak" ? "Weak" : "Bookmarked"}.
          </p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Show all cards
          </button>
        </section>
      ) : (
        <div className="mt-6 grid gap-4">
          {visibleCards.map((card) => (
            <RecallRow
              key={card.id}
              card={card}
              direction={direction}
              isRevealed={revealedCardIds.has(card.id)}
              onRevealChange={changeReveal}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PageMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-slate-600">{children}</p>;
}

function NotFound() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Sheet not found</h1>
      <Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">
        Quay lại workbooks
      </Link>
    </section>
  );
}

function RetryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p>{message}</p>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold"
      >
        Thử lại
      </button>
    </section>
  );
}
