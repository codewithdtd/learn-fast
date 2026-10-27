"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { FlashcardFlagButtons } from "@/components/sheets/flashcard-flag-buttons";
import { ApiRequestError, deleteFlashcard, getSheet, getSheetCards, updateFlashcardBookmark, updateFlashcardContent, updateFlashcardWeak, type FlashcardListItem, type SheetDetail } from "@/services/api";
import { Icon } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth-context";

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
    phrase: visible.phrase ? "minmax(180px, 1.05fr)" : "48px",
    meaning: visible.meaning ? "minmax(240px, 1.65fr)" : "48px",
    examples: visible.examples ? "minmax(240px, 1.35fr)" : "48px",
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
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({ phrase: true, meaning: true, examples: true, actions: true });
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
  const exampleCardIds = useMemo(() => cards.filter((card) => card.example_en || card.example_vi).map((card) => card.id), [cards]);
  const areAllExamplesExpanded = exampleCardIds.length > 0 && exampleCardIds.every((cardId) => expandedExamples.has(cardId));
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

  async function persistCardContent(cardId: number, phrase: string, meaning: string): Promise<boolean> {
    if (!isAdmin) return false;
    setError(null);
    try {
      const updatedCard = await updateFlashcardContent(String(cardId), { phrase, meaning });
      setCards((currentCards) => currentCards.map((card) => card.id === cardId ? updatedCard : card));
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
    // Bulk expand only cards that have example text; empty cards should not count as expanded.
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
        </div>
      </section>

      {!isAdmin && <p className="table-view-inline-note" role="note">Preview mode: Weak and Bookmarked changes stay in this page and reset when you leave.</p>}

      {error && <p role="alert" className="table-view-inline-error">{error}</p>}

      {cards.length > 0 && <details className="mobile-table-display">
        <summary><span><Icon name="eye" size={18} /> Display options</span><strong>{visibleColumnCount} of {tableColumns.length} columns</strong></summary>
        <div className="mobile-table-display-panel">
          <p className="mobile-table-display-label">Columns</p>
          {tableColumns.map(({ key, label }) => <div className="mobile-table-display-row" key={key}>
            <div><strong>{label}</strong><small>{visibleColumns[key] ? "Shown in each card" : "Hidden from cards"}</small></div>
            <button type="button" className="mobile-table-column-toggle" aria-pressed={visibleColumns[key]} aria-label={`${visibleColumns[key] ? "Hide" : "Show"} ${label} column`} disabled={visibleColumns[key] && visibleColumnCount === 1} onClick={() => toggleColumn(key)}>
              <span>{visibleColumns[key] ? "On" : "Off"}</span><span className="mobile-table-switch" aria-hidden="true"><span /></span>
            </button>
            {key === "examples" && visibleColumns.examples && <button type="button" className="mobile-table-example-toggle" onClick={() => toggleAllExamples(!areAllExamplesExpanded)} disabled={exampleCardIds.length === 0}>
              {areAllExamplesExpanded ? "Hide all" : "Show all"}
            </button>}
          </div>)}
        </div>
      </details>}

      {cards.length === 0 ? (
        <TableViewMessage title="No flashcards yet" message="This sheet does not contain any flashcards to display." />
      ) : filteredCards.length === 0 ? (
        <TableViewMessage title="No matching flashcards" message="Try a different search term or filter." />
      ) : (
        <div className="vocabulary-table" role="table" aria-label={`${sheet.name} vocabulary`}>
          <div className="vocabulary-table-head" role="row" style={tableGridStyle}>
            {tableColumns.map(({ key, label }) => <div key={key} role="columnheader" className={`vocabulary-column-heading${key === "examples" ? " examples-column-heading" : key === "actions" ? " actions-column-heading" : ""}`} data-visible={visibleColumns[key]} style={{ gridArea: key }}>
              <span className="vocabulary-column-label">{label}</span>
              <div className="vocabulary-column-controls">
                {key === "examples" && visibleColumns.examples && <button type="button" className="vocabulary-example-toggle" onClick={() => toggleAllExamples(!areAllExamplesExpanded)} disabled={exampleCardIds.length === 0} aria-controls="vocabulary-table-rows" aria-label={areAllExamplesExpanded ? "Hide all examples" : "Show all examples"}>
                  {areAllExamplesExpanded ? "Hide all" : "Show all"}
                </button>}
                <button type="button" className="vocabulary-column-visibility" onClick={() => toggleColumn(key)} disabled={visibleColumns[key] && visibleColumnCount === 1} aria-label={`${visibleColumns[key] ? "Hide" : "Show"} ${label} column`} title={`${visibleColumns[key] ? "Hide" : "Show"} ${label} column`}>
                  <Icon name={visibleColumns[key] ? "eye" : "eyeOff"} size={17} />
                </button>
              </div>
            </div>)}
          </div>
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

function VocabularyRow({ card, visibleColumns, gridStyle, isExampleExpanded, canEdit, onToggleExamples, onContentSave, onDelete, onWeakChange, onBookmarkChange }: VocabularyRowProps) {
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
      <div className="vocabulary-cell phrase-cell" role="cell" data-column-hidden={!visibleColumns.phrase} aria-hidden={!visibleColumns.phrase} style={{ gridArea: "phrase" }}>
        {visibleColumns.phrase && <><span className="vocabulary-mobile-field-label">Phrase <span>#{card.position}</span></span><span className="vocabulary-position">#{card.position}</span>
          {isEditing ? <input form={formId} className="vocabulary-edit-phrase" aria-label={`Phrase for card ${card.position}`} maxLength={200} value={phraseDraft} disabled={isSaving} onChange={(event) => setPhraseDraft(event.target.value)} /> : <strong>{card.phrase}</strong>}</>}
      </div>
      <div className="vocabulary-cell meaning-cell" role="cell" data-column-hidden={!visibleColumns.meaning} aria-hidden={!visibleColumns.meaning} style={{ gridArea: "meaning" }}>{visibleColumns.meaning && <><span className="vocabulary-mobile-field-label">Meaning</span>{isEditing ? <textarea form={formId} className="vocabulary-edit-meaning" aria-label={`Meaning for ${card.phrase}`} maxLength={600} rows={3} value={meaningDraft} disabled={isSaving} onChange={(event) => setMeaningDraft(event.target.value)} /> : card.meaning}</>}</div>
      <div className="vocabulary-cell examples-cell" role="cell" data-column-hidden={!visibleColumns.examples} aria-hidden={!visibleColumns.examples} style={{ gridArea: "examples" }}>
        {visibleColumns.examples && <><span className="vocabulary-mobile-field-label">Examples</span>{!hasExamples ? (
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
        )}</>}
      </div>
      <div className="vocabulary-cell actions-cell" role="cell" data-column-hidden={!visibleColumns.actions} aria-hidden={!visibleColumns.actions} style={{ gridArea: "actions" }}>
        {visibleColumns.actions && <>
        {isEditing ? <>
          <form id={formId} className="sr-only" onSubmit={(event) => { event.preventDefault(); void saveContent(); }} />
          <div className="vocabulary-edit-actions">
            <button type="button" className="vocabulary-edit-button" aria-label="Cancel editing" title="Cancel editing" disabled={isSaving} onClick={() => { setIsEditing(false); setEditError(null); }}>×</button>
            <button type="submit" form={formId} className="vocabulary-edit-button save" aria-label={isSaving ? "Saving changes" : "Save changes"} aria-busy={isSaving} title={isSaving ? "Saving…" : "Save changes"} disabled={isSaving}>
              {isSaving ? <span className="vocabulary-save-spinner" aria-hidden="true" /> : <Icon name="check" size={19} />}
            </button>
          </div>
          {editError && <p className="vocabulary-edit-error" role="alert">{editError}</p>}
        </> : isConfirmingDelete ? <div className="flashcard-delete-confirm" role="group" aria-label={`Confirm deletion of ${card.phrase}`}>
          <span>Delete “{card.phrase}”?</span>
          <button type="button" className="flashcard-delete-cancel" disabled={isDeleting} onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
          <button type="button" className="flashcard-delete-confirm-button" disabled={isDeleting} onClick={async () => { setIsDeleting(true); if (await onDelete()) setIsConfirmingDelete(false); setIsDeleting(false); }}>
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div> : <>
          {canEdit && <button type="button" className="vocabulary-edit-button" aria-label={`Edit ${card.phrase}`} title="Edit phrase and meaning" onClick={startEditing}><Icon name="writing" size={18} /></button>}
          {canEdit && <button type="button" className="vocabulary-edit-button vocabulary-delete-trigger" aria-label={`Delete ${card.phrase}`} title="Delete flashcard" onClick={() => setIsConfirmingDelete(true)}><Icon name="trash" size={18} /></button>}
          <FlashcardFlagButtons
            isWeak={card.is_weak}
            isBookmarked={card.is_bookmarked}
            onWeakChange={onWeakChange}
            onBookmarkChange={onBookmarkChange}
          />
        </>}
        </>}
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
