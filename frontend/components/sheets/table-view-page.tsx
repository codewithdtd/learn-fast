"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FlashcardFlagButtons } from "@/components/sheets/flashcard-flag-buttons";
import { ApiRequestError, getSheet, getSheetCards, updateFlashcardBookmark, updateFlashcardWeak, type FlashcardListItem, type SheetDetail } from "@/services/api";
import { Icon } from "@/components/layout/app-shell";

type ResponsiveSheetTableViewProps = {
  sheetId: string;
};

type CardFilter = "all" | "weak" | "bookmarked";
type FlagName = "is_weak" | "is_bookmarked";

export function ResponsiveSheetTableView({ sheetId }: ResponsiveSheetTableViewProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedSheetId, setResolvedSheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [areExamplesVisible, setAreExamplesVisible] = useState(true);
  const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());

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
      handleLoadError(caughtError);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLoadError(caughtError: unknown) {
    if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
      setNotFound(true);
      return;
    }
    setError(caughtError instanceof Error ? caughtError.message : "Could not load this vocabulary table.");
  }

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([getSheet(sheetId), getSheetCards(sheetId)])
      .then(([loadedSheet, loadedCards]) => {
        if (!isCurrent) return;
        setSheet(loadedSheet);
        setCards(loadedCards);
        setResolvedSheetId(sheetId);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        setSheet(null);
        setCards([]);
        setResolvedSheetId(sheetId);
        handleLoadError(caughtError);
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

  const filterCounts = useMemo(
    () => ({
      all: cards.length,
      weak: cards.filter((card) => card.is_weak).length,
      bookmarked: cards.filter((card) => card.is_bookmarked).length,
    }),
    [cards],
  );

  async function persistFlag(cardId: number, flag: FlagName, nextValue: boolean) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard) return;

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
          : "Could not save this flashcard flag.",
      );
      throw caughtError;
    }
  }

  function toggleExamplesVisibility() {
    setAreExamplesVisible((currentValue) => {
      const nextValue = !currentValue;
      if (!nextValue) setExpandedExamples(new Set());
      return nextValue;
    });
  }

  function toggleCardExamples(cardId: number) {
    setExpandedExamples((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(cardId)) nextIds.delete(cardId);
      else nextIds.add(cardId);
      return nextIds;
    });
  }

  if (isLoading || resolvedSheetId !== sheetId) return <TableViewLoading />;
  if (notFound) return <TableViewNotFound />;
  if (error && !sheet) return <TableViewError message={error} onRetry={loadTable} />;
  if (!sheet) return null;

  return (
    <section className="table-view-content">
      <TableViewHeader sheet={sheet} cardCount={filteredCards.length} totalCards={cards.length} />

      <section className="table-view-toolbar" aria-label="Vocabulary controls">
        <label className="table-view-search">
          <Icon name="search" size={23} />
          <span className="sr-only">Search phrase or meaning</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search phrases..."
            aria-label="Search phrase or meaning"
          />
        </label>

        <div className="table-view-filter-row">
          <div className="table-view-filters" role="group" aria-label="Filter flashcards">
            {(["all", "weak", "bookmarked"] as const).map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                aria-pressed={filter === filterOption}
                className={`table-view-filter ${filter === filterOption ? "active" : ""}`}
                onClick={() => setFilter(filterOption)}
              >
                {filterOption === "all" && "All phrases"}
                {filterOption === "weak" && <><Icon name="flame" size={17} /> Weak</>}
                {filterOption === "bookmarked" && <><Icon name="bookmark" size={17} /> Bookmarked</>}
                <span className="table-view-filter-count">{filterCounts[filterOption]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`table-view-examples-toggle ${areExamplesVisible ? "active" : ""}`}
            aria-pressed={areExamplesVisible}
            onClick={toggleExamplesVisibility}
          >
            <span>Examples</span>
            <span className="table-view-switch" aria-hidden="true"><span /></span>
          </button>
        </div>
      </section>

      {error && <p role="alert" className="table-view-inline-error">{error}</p>}

      {cards.length === 0 ? (
        <TableViewMessage title="No flashcards yet" message="This sheet does not contain any flashcards to display." />
      ) : filteredCards.length === 0 ? (
        <TableViewMessage title="No matching flashcards" message="Try a different search term or filter." />
      ) : (
        <div className="vocabulary-table" role="table" aria-label={`${sheet.name} vocabulary`}>
          <div className="vocabulary-table-head" role="row">
            <div role="columnheader">Phrase</div>
            <div role="columnheader">Meaning</div>
            <div role="columnheader">Examples</div>
            <div role="columnheader">Actions</div>
          </div>
          <div className="vocabulary-table-body">
            {filteredCards.map((card) => (
              <VocabularyRow
                key={card.id}
                card={card}
                areExamplesVisible={areExamplesVisible}
                isExampleExpanded={expandedExamples.has(card.id)}
                onToggleExamples={() => toggleCardExamples(card.id)}
                onWeakChange={(nextValue) => persistFlag(card.id, "is_weak", nextValue)}
                onBookmarkChange={(nextValue) => persistFlag(card.id, "is_bookmarked", nextValue)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TableViewHeader({ sheet, cardCount, totalCards }: { sheet: SheetDetail; cardCount: number; totalCards: number }) {
  return (
    <header className="table-view-header">
      <nav className="table-view-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/sheets/${sheet.id}`}><Icon name="back" size={18} /> <span>{sheet.name}</span></Link>
        <span aria-hidden="true">/</span>
        <span>Table View</span>
      </nav>
      <div className="table-view-heading">
        <div>
          <p className="eyebrow">{sheet.workbook.name}</p>
          <h1>{sheet.name}</h1>
          <p className="table-view-subtitle">Vocabulary table <span aria-hidden="true">·</span> {cardCount} of {totalCards} cards</p>
        </div>
        <Link href={`/sheets/${sheet.id}/study`} className="button primary table-view-study-link">
          <Icon name="play" size={18} /> Study flashcards
        </Link>
      </div>
    </header>
  );
}

type VocabularyRowProps = {
  card: FlashcardListItem;
  areExamplesVisible: boolean;
  isExampleExpanded: boolean;
  onToggleExamples: () => void;
  onWeakChange: (nextValue: boolean) => Promise<void>;
  onBookmarkChange: (nextValue: boolean) => Promise<void>;
};

function VocabularyRow({ card, areExamplesVisible, isExampleExpanded, onToggleExamples, onWeakChange, onBookmarkChange }: VocabularyRowProps) {
  const hasExamples = Boolean(card.example_en || card.example_vi);

  return (
    <div className="vocabulary-table-row" role="row">
      <div className="vocabulary-cell phrase-cell" role="cell">
        <span className="vocabulary-position">#{card.position}</span>
        <strong>{card.phrase}</strong>
      </div>
      <div className="vocabulary-cell meaning-cell" role="cell">{card.meaning}</div>
      <div className="vocabulary-cell examples-cell" role="cell">
        {!areExamplesVisible ? (
          <span className="examples-muted">Examples hidden</span>
        ) : !hasExamples ? (
          <span className="examples-muted">No examples</span>
        ) : isExampleExpanded ? (
          <div className="example-content">
            {card.example_en && <p><span>EN</span>{card.example_en}</p>}
            {card.example_vi && <p><span>VI</span>{card.example_vi}</p>}
            <button type="button" className="example-toggle-link" onClick={onToggleExamples}>Hide examples <Icon name="chevronDown" size={16} /></button>
          </div>
        ) : (
          <button type="button" className="example-toggle-link" onClick={onToggleExamples}>
            <Icon name="eye" size={18} /> Show examples
          </button>
        )}
      </div>
      <div className="vocabulary-cell actions-cell" role="cell">
        <FlashcardFlagButtons
          isWeak={card.is_weak}
          isBookmarked={card.is_bookmarked}
          onWeakChange={onWeakChange}
          onBookmarkChange={onBookmarkChange}
        />
      </div>
    </div>
  );
}

function TableViewLoading() {
  return (
    <section className="table-view-state table-view-loading" aria-label="Loading vocabulary table">
      <span className="table-view-skeleton-header" />
      <span />
      <span />
      <span />
    </section>
  );
}

function TableViewMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className="table-view-state">
      <span className="table-view-state-icon"><Icon name="books" size={27} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function TableViewNotFound() {
  return (
    <section className="table-view-state">
      <span className="table-view-state-icon"><Icon name="books" size={27} /></span>
      <h1>Sheet not found</h1>
      <p>This sheet may have been removed or the link is no longer valid.</p>
      <Link href="/workbooks" className="button primary">Back to workbooks</Link>
    </section>
  );
}

function TableViewError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="table-view-state table-view-error">
      <span className="table-view-state-icon"><Icon name="review" size={27} /></span>
      <h1>Could not load this table</h1>
      <p>{message}</p>
      <button type="button" className="button secondary" onClick={() => void onRetry()}>Try again</button>
    </section>
  );
}
