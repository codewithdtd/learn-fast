"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  Sparkles,
  Layers,
  Edit3,
  BookOpen,
  BarChart3,
} from "lucide-react";

import { InlineNameEditor } from "@/components/shared/inline-name-editor";
import { PrioritySelector } from "@/components/sheets/priority-selector";
import { formatDate, formatLabel } from "@/lib/format";
import { WorkbookCover } from "@/components/illustrations/workbook-cover";
import {
  ApiRequestError,
  getSheet,
  updateSheetName,
  type SheetDetail,
  type SheetPriority,
} from "@/services/api";

type SheetDetailProps = { sheetId: string };

/**
 * Human-crafted Sheet Detail View
 * Adheres strictly to the unified theme system (Cozy Island, Retro, Playful, Dark, Light)
 * Preserves semantic hierarchy (.sheet-detail-*) for CSS themes while featuring
 * Lucide vector icons, inline renaming, and responsive mobile ergonomics.
 */
export function SheetDetailView({ sheetId }: SheetDetailProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Business logic: Fetches sheet metadata, card counts, and SRS interval metrics
  async function loadSheet() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setSheet(await getSheet(sheetId));
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load this sheet.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    void getSheet(sheetId)
      .then((loadedSheet) => {
        if (isCurrent) setSheet(loadedSheet);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : "Could not load this sheet.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sheetId]);

  if (isLoading) return <SheetState>Loading sheet…</SheetState>;
  if (notFound) return <NotFound />;
  if (error) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  // Business logic: Callback when user changes priority in the selector panel
  function handlePrioritySaved(priority: SheetPriority) {
    setSheet((currentSheet) => currentSheet && { ...currentSheet, priority });
  }

  // Business logic: Renames the sheet inline and persists change to backend
  async function handleSheetRenamed(name: string) {
    setSheet(await updateSheetName(sheetId, name));
  }

  return (
    <section className="sheet-detail-content">
      {/* 1. Header with Breadcrumb and Sheet Title */}
      <header className="sheet-detail-header">
        <nav className="sheet-detail-breadcrumb" aria-label="Breadcrumb">
          <Link href="/workbooks">Workbooks</Link>
          <span>›</span>
          <Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link>
          <span>›</span>
          <span aria-current="page">{sheet.name}</span>
        </nav>
        <Link href={`/workbooks/${sheet.workbook.id}`} className="sheet-detail-back">
          <ArrowLeft className="h-4 w-4 inline-block mr-1" /> Back to {sheet.workbook.name}
        </Link>
        <div className="sheet-detail-title-row">
          <WorkbookCover workbookId={sheet.workbook.id} className="journey-sheet-cover" />
          <div>
            <p className="sheet-detail-kicker">
              Sheet {sheet.position} · {formatLabel(sheet.status)}
            </p>
            <div className="sheet-detail-name-row">
              <h1>{sheet.name}</h1>
              {sheet.is_ai_generated && <span className="sheet-ai-badge">✨ AI Generated</span>}
              <InlineNameEditor value={sheet.name} label="sheet name" onSave={handleSheetRenamed} />
            </div>
            <p className="sheet-detail-subtitle">
              Part of <Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link>
            </p>
          </div>
          <StatusBadge status={sheet.status} />
        </div>
      </header>

      {/* 2. Main Column & Sidebar Layout */}
      <div className="sheet-detail-layout">
        <div className="sheet-detail-main">
          {/* Hero Study Mode Action */}
          <section className="sheet-detail-hero-card">
            <div className="sheet-detail-hero-copy">
              <p className="eyebrow">Ready to learn</p>
              <h2>Choose your study mode</h2>
              <p>Review this sheet with spaced repetition and focused active recall.</p>
            </div>
            <Link href={`/sheets/${sheet.id}/study`} className="sheet-detail-primary-action">
              <span className="sheet-action-icon">
                <Play className="h-5 w-5 fill-current" />
              </span>
              <span>
                <strong>Study Flashcards</strong>
                <small>Review this sheet with spaced repetition.</small>
              </span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </section>

          {/* Practice & Learning Modes */}
          <section className="sheet-detail-actions" aria-labelledby="sheet-actions-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">More ways to practice</p>
                <h2 id="sheet-actions-title">Learning modes</h2>
              </div>
            </div>
            <div className="sheet-action-grid">
              <ActionCard
                href={`/sheets/${sheet.id}/quick-recall`}
                icon={Sparkles}
                title="Practice Exercises"
                description="Check your recall with quizzes, translation, and fill-in-the-blank."
                tone="mint"
              />
              <ActionCard
                href={`/sheets/${sheet.id}/table`}
                icon={Layers}
                title="Table View"
                description="Browse the full vocabulary list and hear audio pronunciation."
                tone="gold"
              />
              <ActionCard
                href={`/ai-support?tab=sentences&sheet=${sheet.id}`}
                icon={Edit3}
                title="Use this word"
                description="Write sentences using these words and get bilingual AI coaching."
                tone="mint"
              />
              <ActionCard
                href={`/sheets/${sheet.id}/paragraph-practice`}
                icon={BookOpen}
                title="Translate a story"
                description="Turn 5–10 expressions into a short story or dialogue with AI coaching."
                tone="gold"
              />
            </div>
          </section>
        </div>

        {/* Sidebar: Sheet Stats & Priority */}
        <aside className="sheet-detail-sidebar">
          <section className="sheet-detail-panel" aria-labelledby="sheet-overview-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sheet overview</p>
                <h2 id="sheet-overview-title">Progress data</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <dl className="sheet-detail-stats">
              <Stat label="Cards" value={String(sheet.card_count)} tone="primary" />
              <Stat label="Priority" value={formatLabel(sheet.priority)} tone="mint" />
              <Stat label="Reviews" value={String(sheet.review_count)} tone="lavender" />
              <Stat label="Lapses" value={String(sheet.lapse_count)} tone="rose" />
            </dl>
            <div className="sheet-detail-meta-list">
              <MetaRow label="Next review" value={formatDate(sheet.next_review_at)} />
              <MetaRow label="First learned" value={formatDate(sheet.first_learned_at)} />
              <MetaRow label="Last reviewed" value={formatDate(sheet.last_reviewed_at)} />
              <MetaRow label="SRS level" value={String(sheet.srs_level)} />
              <MetaRow
                label="Interval"
                value={`${sheet.interval_days} day${sheet.interval_days === 1 ? "" : "s"}`}
              />
            </div>
          </section>

          <section className="sheet-detail-panel sheet-priority-panel" aria-labelledby="sheet-priority-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Personalize review</p>
                <h2 id="sheet-priority-title">Study priority</h2>
              </div>
            </div>
            <PrioritySelector sheetId={sheet.id} priority={sheet.priority} onSaved={handlePrioritySaved} />
          </section>
        </aside>
      </div>
    </section>
  );
}

function ActionCard({
  href,
  icon: IconComponent,
  title,
  description,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: "mint" | "gold";
}) {
  return (
    <Link href={href} className={`sheet-action-card ${tone}`}>
      <span className="sheet-action-icon">
        <IconComponent className="h-5 w-5" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ArrowRight className="h-5 w-5" />
    </Link>
  );
}

function StatusBadge({ status }: { status: SheetDetail["status"] }) {
  return <span className={`sheet-status-badge ${status}`}>{formatLabel(status)}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`sheet-stat ${tone}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SheetState({ children }: { children: React.ReactNode }) {
  return <section className="sheet-detail-state">{children}</section>;
}

function NotFound() {
  return (
    <section className="sheet-detail-state">
      <h1>Sheet not found</h1>
      <Link href="/workbooks" className="button primary">
        Back to workbooks
      </Link>
    </section>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="sheet-detail-state sheet-detail-state-error">
      <p>{message}</p>
      <button type="button" className="button primary" onClick={() => void onRetry()}>
        Try again
      </button>
    </section>
  );
}
