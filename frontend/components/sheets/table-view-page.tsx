"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Search,
  Flame,
  Bookmark,
  Play,
  ArrowLeft,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Check,
  X,
  ChevronDown,
  BookOpen,
  Volume2,
} from "lucide-react";

import { FlashcardFlagButtons } from "@/components/sheets/flashcard-flag-buttons";
import {
  ApiRequestError,
  deleteFlashcard,
  getSheet,
  getSheetCards,
  updateFlashcardBookmark,
  updateFlashcardContent,
  updateFlashcardWeak,
  type FlashcardListItem,
  type SheetDetail,
} from "@/services/api";
import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import { useAuth } from "@/context/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ResponsiveSheetTableViewProps = {
  sheetId: string;
};

type CardFilter = "all" | "weak" | "bookmarked";
type FlagName = "is_weak" | "is_bookmarked";
type TableColumn = "phrase" | "meaning" | "examples" | "actions";
type VisibleColumns = Record<TableColumn, boolean>;

const tableColumns: { key: TableColumn; label: string }[] = [
  { key: "phrase", label: "Phrase" },
  { key: "meaning", label: "Meaning" },
  { key: "examples", label: "Examples" },
  { key: "actions", label: "Actions" },
];

function getTableGridStyle(visible: VisibleColumns): CSSProperties {
  const desktopWidths: Record<TableColumn, string> = {
    phrase: visible.phrase ? "minmax(180px, 1.15fr)" : "48px",
    meaning: visible.meaning ? "minmax(220px, 1.55fr)" : "48px",
    examples: visible.examples ? "minmax(220px, 1.35fr)" : "48px",
    actions: visible.actions ? "148px" : "48px",
  };
  const compactWidths: Record<TableColumn, string> = {
    phrase: visible.phrase ? "minmax(140px, 1fr)" : "44px",
    meaning: visible.meaning ? "minmax(180px, 1.2fr)" : "44px",
    examples: visible.examples ? "minmax(200px, 1.1fr)" : "44px",
    actions: visible.actions ? "112px" : "44px",
  };
  const allKeys = tableColumns.map(({ key }) => key);
  const mobileRows = [
    ...(visible.phrase ? ["phrase phrase"] : []),
    ...(visible.actions ? ["actions actions"] : []),
    ...(visible.meaning ? ["meaning meaning"] : []),
    ...(visible.examples ? ["examples examples"] : []),
  ].filter((row): row is string => row !== null).map((row) => `"${row}"`).join(" ");

  return {
    "--vocabulary-columns": allKeys.map((key) => desktopWidths[key]).join(" "),
    "--vocabulary-columns-compact": allKeys.map((key) => compactWidths[key]).join(" "),
    "--vocabulary-row-areas": `"${allKeys.join(" ")}"`,
    "--vocabulary-row-areas-mobile": mobileRows,
  } as CSSProperties;
}

/**
 * Human-crafted Table View Page
 * High-contrast typography, crisp borders, immediate audio pronunciation,
 * and responsive card ergonomics on mobile.
 */
export function ResponsiveSheetTableView({ sheetId }: ResponsiveSheetTableViewProps) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.is_superuser === true;
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedSheetId, setResolvedSheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardFilter>("all");
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    phrase: true,
    meaning: true,
    examples: true,
    actions: true,
  });
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
    setError(
      caughtError instanceof Error
        ? caughtError.message
        : "Could not load this vocabulary table.",
    );
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

  const exampleCardIds = useMemo(
    () => cards.filter((card) => card.example_en || card.example_vi).map((card) => card.id),
    [cards],
  );
  const areAllExamplesExpanded =
    exampleCardIds.length > 0 &&
    exampleCardIds.every((cardId) => expandedExamples.has(cardId));
  const visibleColumnCount = tableColumns.filter(({ key }) => visibleColumns[key]).length;
  const tableGridStyle = getTableGridStyle(visibleColumns);

  async function persistFlag(cardId: number, flag: FlagName, nextValue: boolean) {
    const previousCard = cards.find((card) => card.id === cardId);
    if (!previousCard) return;

    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId ? { ...card, [flag]: nextValue } : card,
      ),
    );
    setError(null);

    // Guest and member previews may test the controls locally, but shared admin card flags must remain untouched.
    if (!isAdmin) return;

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

  async function persistCardContent(
    cardId: number,
    phrase: string,
    meaning: string,
  ): Promise<boolean> {
    if (!isAdmin) return false;
    setError(null);
    try {
      const updatedCard = await updateFlashcardContent(String(cardId), { phrase, meaning });
      setCards((currentCards) =>
        currentCards.map((card) => (card.id === cardId ? updatedCard : card)),
      );
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save this flashcard.");
      return false;
    }
  }

  async function removeFlashcard(cardId: number): Promise<boolean> {
    setError(null);
    try {
      await deleteFlashcard(String(cardId));
      setCards((currentCards) => currentCards.filter((card) => card.id !== cardId));
      setExpandedExamples((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(cardId);
        return nextIds;
      });
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete this flashcard.");
      return false;
    }
  }

  function toggleCardExamples(cardId: number) {
    setExpandedExamples((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(cardId)) nextIds.delete(cardId);
      else nextIds.add(cardId);
      return nextIds;
    });
  }

  function toggleAllExamples(show: boolean) {
    setExpandedExamples(show ? new Set(exampleCardIds) : new Set());
  }

  function toggleColumn(column: TableColumn) {
    setVisibleColumns((current) => {
      const currentCount = tableColumns.filter(({ key }) => current[key]).length;
      if (current[column] && currentCount === 1) return current;
      return { ...current, [column]: !current[column] };
    });
  }

  if (isLoading || resolvedSheetId !== sheetId) return <TableViewLoading />;
  if (notFound) return <TableViewNotFound />;
  if (error && !sheet) return <TableViewError message={error} onRetry={loadTable} />;
  if (!sheet) return null;

  return (
    <section className="table-view-content max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* 1. Header with Breadcrumb and Study Button */}
      <TableViewHeader
        sheet={sheet}
        cardCount={filteredCards.length}
        totalCards={cards.length}
      />

      {/* 2. Controls Toolbar: Search & Filter Pills */}
      <section className="table-view-toolbar my-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Vocabulary controls">
        <label className="relative flex flex-1 items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search phrase or meaning..."
            className="w-full rounded-xl border border-outline/50 bg-surface pl-10 pr-9 py-2 text-xs sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Search phrase or meaning"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter flashcards">
          <button
            type="button"
            aria-pressed={filter === "all"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "all"
                ? "bg-primary text-white shadow-xs"
                : "border border-outline/50 bg-surface text-muted hover:bg-surface-low"
            }`}
            onClick={() => setFilter("all")}
          >
            All phrases
            <span className="rounded-full bg-surface-low/30 px-1.5 py-0.2 text-[10px] font-bold">
              {filterCounts.all}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={filter === "weak"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "weak"
                ? "bg-error text-white shadow-xs"
                : "border border-outline/50 bg-surface text-muted hover:bg-surface-low"
            }`}
            onClick={() => setFilter("weak")}
          >
            <Flame className="h-3.5 w-3.5" />
            Weak
            <span className="rounded-full bg-surface-low/30 px-1.5 py-0.2 text-[10px] font-bold">
              {filterCounts.weak}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={filter === "bookmarked"}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === "bookmarked"
                ? "bg-amber-600 text-white shadow-xs"
                : "border border-outline/50 bg-surface text-muted hover:bg-surface-low"
            }`}
            onClick={() => setFilter("bookmarked")}
          >
            <Bookmark className="h-3.5 w-3.5" />
            Bookmarked
            <span className="rounded-full bg-surface-low/30 px-1.5 py-0.2 text-[10px] font-bold">
              {filterCounts.bookmarked}
            </span>
          </button>
        </div>
      </section>

      {!isAdmin && (
        <p className="mb-3 text-[11px] text-muted" role="note">
          Preview mode: Weak and Bookmarked changes stay in this session.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-4 text-xs font-semibold text-error">
          {error}
        </p>
      )}

      {/* 3. Column Display Toggles for Mobile / Compact */}
      {cards.length > 0 && (
        <details className="mobile-table-display mb-4 rounded-xl border border-outline/40 bg-surface shadow-xs">
          <summary className="flex cursor-pointer items-center justify-between p-3 text-xs font-semibold text-foreground">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>Column Display Options</span>
            </span>
            <span className="text-[11px] text-muted">
              {visibleColumnCount} of {tableColumns.length} visible
            </span>
          </summary>
          <div className="border-t border-outline/30 p-3 pt-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {tableColumns.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-xs text-foreground">{label}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-outline/50 px-2 py-0.5 text-xs font-medium text-muted hover:border-primary"
                    aria-pressed={visibleColumns[key]}
                    disabled={visibleColumns[key] && visibleColumnCount === 1}
                    onClick={() => toggleColumn(key)}
                  >
                    {visibleColumns[key] ? (
                      <>
                        <Eye className="h-3 w-3 text-primary" /> Shown
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" /> Hidden
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {visibleColumns.examples && exampleCardIds.length > 0 && (
              <div className="mt-2 pt-2 border-t border-outline/20 flex justify-end">
                <button
                  type="button"
                  onClick={() => toggleAllExamples(!areAllExamplesExpanded)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {areAllExamplesExpanded ? "Hide all examples" : "Expand all examples"}
                </button>
              </div>
            )}
          </div>
        </details>
      )}

      {/* 4. Table / Cards Grid */}
      {cards.length === 0 ? (
        <TableViewMessage
          title="No flashcards yet"
          message="This sheet does not contain any flashcards to display."
        />
      ) : filteredCards.length === 0 ? (
        <TableViewMessage
          title="No matching flashcards"
          message="Try a different search term or filter."
        />
      ) : (
        <div className="vocabulary-table" role="table" aria-label={`${sheet.name} vocabulary`}>
          {/* Desktop Table Header */}
          <div className="vocabulary-table-head" role="row" style={tableGridStyle}>
            {tableColumns.map(({ key, label }) => (
              <div
                key={key}
                role="columnheader"
                className={`vocabulary-column-heading${
                  key === "examples"
                    ? " examples-column-heading"
                    : key === "actions"
                      ? " actions-column-heading"
                      : ""
                }`}
                data-visible={visibleColumns[key]}
                style={{ gridArea: key }}
              >
                <span className="vocabulary-column-label">{label}</span>
                <div className="vocabulary-column-controls">
                  {key === "examples" && visibleColumns.examples && (
                    <button
                      type="button"
                      className="vocabulary-example-toggle text-[10px] font-bold text-primary hover:underline"
                      onClick={() => toggleAllExamples(!areAllExamplesExpanded)}
                      disabled={exampleCardIds.length === 0}
                      aria-controls="vocabulary-table-rows"
                    >
                      {areAllExamplesExpanded ? "Hide all" : "Show all"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="vocabulary-column-visibility"
                    onClick={() => toggleColumn(key)}
                    disabled={visibleColumns[key] && visibleColumnCount === 1}
                    aria-label={`${visibleColumns[key] ? "Hide" : "Show"} ${label} column`}
                    title={`${visibleColumns[key] ? "Hide" : "Show"} ${label} column`}
                  >
                    {visibleColumns[key] ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Table Body */}
          <div className="vocabulary-table-body" id="vocabulary-table-rows">
            {filteredCards.map((card) => (
              <VocabularyRow
                key={card.id}
                card={card}
                visibleColumns={visibleColumns}
                gridStyle={tableGridStyle}
                isExampleExpanded={expandedExamples.has(card.id)}
                canEdit={isAdmin}
                onToggleExamples={() => toggleCardExamples(card.id)}
                onContentSave={(phrase, meaning) => persistCardContent(card.id, phrase, meaning)}
                onDelete={() => removeFlashcard(card.id)}
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

function TableViewHeader({
  sheet,
  cardCount,
  totalCards,
}: {
  sheet: SheetDetail;
  cardCount: number;
  totalCards: number;
}) {
  return (
    <header className="mb-4">
      {/* Breadcrumb Navigation */}
      <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted" aria-label="Breadcrumb">
        <Link
          href={`/sheets/${sheet.id}`}
          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>{sheet.name}</span>
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-foreground">Table View</span>
      </nav>

      {/* Heading Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {sheet.workbook.name}
          </p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {sheet.name}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            Vocabulary table · <strong className="text-foreground">{cardCount}</strong> of{" "}
            {totalCards} cards
          </p>
        </div>

        {/* Study Flashcards Button - ALWAYS visible on Desktop & Mobile */}
        <div className="flex items-center">
          <Link
            href={`/sheets/${sheet.id}/study`}
            className={buttonVariants({
              variant: "default",
              size: "sm",
              className: "w-full sm:w-auto shadow-xs",
            })}
          >
            <Play className="h-3.5 w-3.5 fill-current mr-1.5" /> Study Deck
          </Link>
        </div>
      </div>
    </header>
  );
}

type VocabularyRowProps = {
  card: FlashcardListItem;
  visibleColumns: VisibleColumns;
  gridStyle: CSSProperties;
  isExampleExpanded: boolean;
  canEdit: boolean;
  onToggleExamples: () => void;
  onContentSave: (phrase: string, meaning: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onWeakChange: (nextValue: boolean) => Promise<void>;
  onBookmarkChange: (nextValue: boolean) => Promise<void>;
};

function VocabularyRow({
  card,
  visibleColumns,
  gridStyle,
  isExampleExpanded,
  canEdit,
  onToggleExamples,
  onContentSave,
  onDelete,
  onWeakChange,
  onBookmarkChange,
}: VocabularyRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState(card.phrase);
  const [meaningDraft, setMeaningDraft] = useState(card.meaning);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const hasExamples = Boolean(card.example_en || card.example_vi);
  const formId = `flashcard-edit-${card.id}`;

  function startEditing() {
    setPhraseDraft(card.phrase);
    setMeaningDraft(card.meaning);
    setEditError(null);
    setIsEditing(true);
  }

  async function saveContent() {
    const phrase = phraseDraft.trim();
    const meaning = meaningDraft.trim();
    if (!phrase || !meaning) {
      setEditError("Phrase and meaning are required.");
      return;
    }
    setIsSaving(true);
    setEditError(null);
    try {
      if (await onContentSave(phrase, meaning)) setIsEditing(false);
      else setEditError("The changes could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="vocabulary-table-row" role="row" style={gridStyle}>
      {/* Phrase Column */}
      <div
        className="vocabulary-cell phrase-cell"
        role="cell"
        data-column-hidden={!visibleColumns.phrase}
        aria-hidden={!visibleColumns.phrase}
        style={{ gridArea: "phrase" }}
      >
        {visibleColumns.phrase && (
          <>
            <span className="vocabulary-mobile-field-label">
              Phrase <span>#{card.position}</span>
            </span>
            <span className="vocabulary-position">#{card.position}</span>
            {isEditing ? (
              <input
                form={formId}
                className="vocabulary-edit-phrase"
                aria-label={`Phrase for card ${card.position}`}
                maxLength={200}
                value={phraseDraft}
                disabled={isSaving}
                onChange={(event) => setPhraseDraft(event.target.value)}
              />
            ) : (
              <div className="vocabulary-phrase-content flex items-center gap-2">
                <strong className="text-sm font-bold text-foreground">{card.phrase}</strong>
                <AudioPronounceButton text={card.phrase} size="sm" title="Listen to phrase" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Meaning Column */}
      <div
        className="vocabulary-cell meaning-cell"
        role="cell"
        data-column-hidden={!visibleColumns.meaning}
        aria-hidden={!visibleColumns.meaning}
        style={{ gridArea: "meaning" }}
      >
        {visibleColumns.meaning && (
          <>
            <span className="vocabulary-mobile-field-label">Meaning</span>
            {isEditing ? (
              <textarea
                form={formId}
                className="vocabulary-edit-meaning"
                aria-label={`Meaning for ${card.phrase}`}
                maxLength={600}
                rows={3}
                value={meaningDraft}
                disabled={isSaving}
                onChange={(event) => setMeaningDraft(event.target.value)}
              />
            ) : (
              <span className="text-xs sm:text-sm text-foreground leading-relaxed">
                {card.meaning}
              </span>
            )}
          </>
        )}
      </div>

      {/* Examples Column */}
      <div
        className="vocabulary-cell examples-cell"
        role="cell"
        data-column-hidden={!visibleColumns.examples}
        aria-hidden={!visibleColumns.examples}
        style={{ gridArea: "examples" }}
      >
        {visibleColumns.examples && (
          <>
            <span className="vocabulary-mobile-field-label">Examples</span>
            {!hasExamples ? (
              <span className="examples-muted text-xs text-muted">No examples</span>
            ) : isExampleExpanded ? (
              <div className="example-content space-y-1.5 text-xs">
                {card.example_en && (
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-[10px] uppercase text-muted">EN</span>
                    <span className="vocabulary-example-text-wrap flex items-center gap-1.5 text-foreground">
                      <span>{card.example_en}</span>
                      <AudioPronounceButton text={card.example_en} size="sm" title="Listen to example" />
                    </span>
                  </div>
                )}
                {card.example_vi && (
                  <div className="flex items-start gap-1.5 text-muted">
                    <span className="font-bold text-[10px] uppercase">VI</span>
                    <span>{card.example_vi}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="example-toggle-link text-[11px] font-semibold text-primary hover:underline mt-1 inline-flex items-center gap-1"
                  onClick={onToggleExamples}
                >
                  Hide examples <ChevronDown className="h-3 w-3 rotate-180" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="example-toggle-link text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                onClick={onToggleExamples}
              >
                <Eye className="h-3.5 w-3.5" /> Show examples
              </button>
            )}
          </>
        )}
      </div>

      {/* Actions Column */}
      <div
        className="vocabulary-cell actions-cell"
        role="cell"
        data-column-hidden={!visibleColumns.actions}
        aria-hidden={!visibleColumns.actions}
        style={{ gridArea: "actions" }}
      >
        {visibleColumns.actions && (
          <>
            {isEditing ? (
              <>
                <form
                  id={formId}
                  className="sr-only"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveContent();
                  }}
                />
                <div className="vocabulary-edit-actions flex items-center gap-1">
                  <button
                    type="button"
                    className="vocabulary-edit-button p-1 text-muted hover:text-foreground"
                    aria-label="Cancel editing"
                    title="Cancel editing"
                    disabled={isSaving}
                    onClick={() => {
                      setIsEditing(false);
                      setEditError(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="submit"
                    form={formId}
                    className="vocabulary-edit-button save p-1 text-primary hover:text-primary/80"
                    aria-label={isSaving ? "Saving changes" : "Save changes"}
                    aria-busy={isSaving}
                    title={isSaving ? "Saving…" : "Save changes"}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <span className="vocabulary-save-spinner" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {editError && (
                  <p className="vocabulary-edit-error text-xs text-error" role="alert">
                    {editError}
                  </p>
                )}
              </>
            ) : isConfirmingDelete ? (
              <div
                className="flashcard-delete-confirm flex items-center gap-2 text-xs"
                role="group"
                aria-label={`Confirm deletion of ${card.phrase}`}
              >
                <span>Delete?</span>
                <button
                  type="button"
                  className="flashcard-delete-cancel text-muted hover:underline"
                  disabled={isDeleting}
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flashcard-delete-confirm-button font-bold text-error hover:underline"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    if (await onDelete()) setIsConfirmingDelete(false);
                    setIsDeleting(false);
                  }}
                >
                  {isDeleting ? "…" : "Confirm"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {canEdit && (
                  <button
                    type="button"
                    className="vocabulary-edit-button p-1 text-muted hover:text-foreground"
                    aria-label={`Edit ${card.phrase}`}
                    title="Edit phrase and meaning"
                    onClick={startEditing}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    className="vocabulary-edit-button vocabulary-delete-trigger p-1 text-muted hover:text-error"
                    aria-label={`Delete ${card.phrase}`}
                    title="Delete flashcard"
                    onClick={() => setIsConfirmingDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <FlashcardFlagButtons
                  isWeak={card.is_weak}
                  isBookmarked={card.is_bookmarked}
                  onWeakChange={onWeakChange}
                  onBookmarkChange={onBookmarkChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TableViewLoading() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 text-center text-sm text-muted" aria-label="Loading vocabulary table">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
      <p>Loading vocabulary table…</p>
    </section>
  );
}

function TableViewMessage({ title, message }: { title: string; message: string }) {
  return (
    <section className="max-w-md mx-auto my-12 rounded-2xl border border-outline/40 bg-surface p-8 text-center shadow-xs">
      <BookOpen className="mx-auto h-8 w-8 text-muted mb-2" />
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted">{message}</p>
    </section>
  );
}

function TableViewNotFound() {
  return (
    <section className="max-w-md mx-auto my-12 rounded-2xl border border-outline/40 bg-surface p-8 text-center shadow-xs">
      <BookOpen className="mx-auto h-8 w-8 text-muted mb-2" />
      <h1 className="text-lg font-bold text-foreground">Sheet not found</h1>
      <p className="mt-1 text-xs text-muted">
        This sheet may have been removed or the link is no longer valid.
      </p>
      <div className="mt-4">
        <Link href="/workbooks" className={buttonVariants({ variant: "default", size: "sm" })}>
          Back to Workbooks
        </Link>
      </div>
    </section>
  );
}

function TableViewError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <section role="alert" className="max-w-md mx-auto my-12 rounded-2xl border border-error/30 bg-surface p-8 text-center shadow-xs">
      <h1 className="text-base font-bold text-error">Could not load this table</h1>
      <p className="mt-1 text-xs text-muted">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={() => void onRetry()}>
          Try again
        </Button>
      </div>
    </section>
  );
}
