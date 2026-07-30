"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FlashcardFlagButtons } from "@/components/sheets/flashcard-flag-buttons";
import {
  ApiRequestError,
  getSheet,
  getSheetCards,
  updateFlashcardBookmark,
  updateFlashcardWeak,
  type FlashcardListItem,
  type SheetDetail,
} from "@/services/api";

type SheetTableViewProps = {
  sheetId: string;
};

type CardFilter = "all" | "weak" | "bookmarked";

export function SheetTableView({ sheetId }: SheetTableViewProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [areExamplesVisible, setAreExamplesVisible] = useState(true);

  async function loadTable() {
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
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Không thể tải bảng flashcard.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // Both resources resolve after mount. The guard prevents a request for a
    // previous route from overwriting the UI after the user navigates away.
    void Promise.all([getSheet(sheetId), getSheetCards(sheetId)])
      .then(([loadedSheet, loadedCards]) => {
        if (!isCurrent) return;
        setSheet(loadedSheet);
        setCards(loadedCards);
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
            : "Không thể tải bảng flashcard.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sheetId]);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");

    return cards.filter((card) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "weak" && card.is_weak) ||
        (filter === "bookmarked" && card.is_bookmarked);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        card.phrase.toLocaleLowerCase("vi").includes(normalizedQuery) ||
        card.meaning.toLocaleLowerCase("vi").includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [cards, filter, query]);

  async function persistFlag(
    cardId: number,
    flag: "is_weak" | "is_bookmarked",
    nextValue: boolean,
  ) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard) return;

    // Update only the changed flag locally for instant feedback. If persistence
    // fails, restore only that card so other in-flight row updates survive and
    // the UI never claims that this Weak/Bookmark change was saved when it was not.
    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, [flag]: nextValue } : card,
      ),
    );
    setError(null);

    try {
      const updatedCard =
        flag === "is_weak"
          ? await updateFlashcardWeak(String(cardId), nextValue)
          : await updateFlashcardBookmark(String(cardId), nextValue);
      setCards((currentCards) =>
        currentCards.map((card) => (card.id === cardId ? updatedCard : card)),
      );
    } catch (caughtError) {
      setCards((currentCards) =>
        currentCards.map((card) => (card.id === cardId ? previousCard : card)),
      );
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Không thể lưu trạng thái flashcard.",
      );
      throw caughtError;
    }
  }

  if (isLoading) return <PageMessage>Đang tải bảng flashcard…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !sheet) return <RetryError message={error} onRetry={loadTable} />;
  if (!sheet) return null;

  return (
    <section>
      <Link
        href={`/sheets/${sheet.id}`}
        className="text-sm font-medium text-sky-700 hover:underline"
      >
        ← {sheet.name}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{sheet.workbook.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Table View</h1>
          <p className="mt-2 text-slate-600">
            {filteredCards.length} / {cards.length} cards
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAreExamplesVisible((currentValue) => !currentValue)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          {areExamplesVisible ? "Hide examples" : "Show examples"}
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex-1">
          <span className="sr-only">Search phrase or meaning</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search phrase or meaning"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filter flashcards">
          {(["all", "weak", "bookmarked"] as const).map((filterOption) => (
            <button
              key={filterOption}
              type="button"
              aria-pressed={filter === filterOption}
              onClick={() => setFilter(filterOption)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                filter === filterOption
                  ? "bg-sky-700 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {filterOption === "all"
                ? "All"
                : filterOption === "weak"
                  ? "Weak"
                  : "Bookmarked"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {error}
        </p>
      )}

      {cards.length === 0 ? (
        <PageMessage>Sheet này chưa có flashcard.</PageMessage>
      ) : filteredCards.length === 0 ? (
        <PageMessage>Không có flashcard khớp với tìm kiếm hoặc filter hiện tại.</PageMessage>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[900px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Phrase</th>
                <th className="px-4 py-3 font-semibold">Meaning</th>
                {areExamplesVisible && (
                  <>
                    <th className="px-4 py-3 font-semibold">Example EN</th>
                    <th className="px-4 py-3 font-semibold">Example VI</th>
                  </>
                )}
                <th className="px-4 py-3 font-semibold">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCards.map((card) => (
                <tr key={card.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{card.phrase}</td>
                  <td className="px-4 py-3 text-slate-700">{card.meaning}</td>
                  {areExamplesVisible && (
                    <>
                      <td className="px-4 py-3 text-slate-600">{card.example_en ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{card.example_vi ?? "—"}</td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <FlashcardFlagButtons
                      isWeak={card.is_weak}
                      isBookmarked={card.is_bookmarked}
                      onWeakChange={(nextValue) =>
                        persistFlag(card.id, "is_weak", nextValue)
                      }
                      onBookmarkChange={(nextValue) =>
                        persistFlag(card.id, "is_bookmarked", nextValue)
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
