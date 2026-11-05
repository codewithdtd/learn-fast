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
  Calendar,
  RotateCcw,
  BarChart3,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { InlineNameEditor } from "@/components/shared/inline-name-editor";
import { PrioritySelector } from "@/components/sheets/priority-selector";
import { formatDate, formatLabel } from "@/lib/format";
import { WorkbookCover } from "@/components/illustrations/workbook-cover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
 * Clean layout, high-contrast hierarchy, distraction-free study modes,
 * and responsive mobile ergonomics.
 */
export function SheetDetailView({ sheetId }: SheetDetailProps) {
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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

  if (isLoading) return <SheetLoadingState />;
  if (notFound) return <NotFound />;
  if (error) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  function handlePrioritySaved(priority: SheetPriority) {
    setSheet((currentSheet) => currentSheet && { ...currentSheet, priority });
  }

  async function handleSheetRenamed(name: string) {
    setSheet(await updateSheetName(sheetId, name));
  }

  return (
    <section className="sheet-detail-content max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* 1. Breadcrumb & Navigation */}
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-muted" aria-label="Breadcrumb">
        <Link href="/workbooks" className="hover:text-primary transition-colors">
          Workbooks
        </Link>
        <span>/</span>
        <Link href={`/workbooks/${sheet.workbook.id}`} className="hover:text-primary transition-colors">
          {sheet.workbook.name}
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground" aria-current="page">
          {sheet.name}
        </span>
      </nav>

      <div className="mb-6">
        <Link
          href={`/workbooks/${sheet.workbook.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {sheet.workbook.name}
        </Link>
      </div>

      {/* 2. Sheet Header Row */}
      <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-outline/40 bg-surface p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <WorkbookCover workbookId={sheet.workbook.id} className="h-16 w-14 shrink-0 rounded-lg object-cover shadow-xs" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Sheet {sheet.position}
              </span>
              <StatusBadge status={sheet.status} />
              {sheet.is_ai_generated && (
                <Badge variant="outline" className="text-[10px]">
                  ✨ AI Generated
                </Badge>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {sheet.name}
              </h1>
              <InlineNameEditor value={sheet.name} label="sheet name" onSave={handleSheetRenamed} />
            </div>

            <p className="mt-0.5 text-xs text-muted">
              Part of{" "}
              <Link
                href={`/workbooks/${sheet.workbook.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {sheet.workbook.name}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <Link
            href={`/sheets/${sheet.id}/study`}
            className={buttonVariants({
              variant: "default",
              size: "md",
              className: "w-full sm:w-auto shadow-sm",
            })}
          >
            <Play className="h-4 w-4 fill-current mr-1.5" /> Study Deck
          </Link>
        </div>
      </header>

      {/* 3. Main Content & Sidebar Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Primary Flashcard Action Hero */}
          <Card className="border-primary/25 bg-gradient-to-r from-surface to-surface-low shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge variant="default" className="text-xs">
                    Primary Study Mode
                  </Badge>
                  <h2 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                    Study Flashcards
                  </h2>
                  <p className="mt-1 text-xs text-muted sm:text-sm">
                    Review {sheet.card_count} flashcards with spaced repetition and active recall.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span>SRS Level: <strong>{sheet.srs_level}</strong></span>
                    <span>·</span>
                    <span>Interval: <strong>{sheet.interval_days}d</strong></span>
                    <span>·</span>
                    <span>Reviews: <strong>{sheet.review_count}</strong></span>
                  </div>
                </div>

                <Link
                  href={`/sheets/${sheet.id}/study`}
                  className={buttonVariants({
                    variant: "default",
                    size: "lg",
                    className: "w-full sm:w-auto shrink-0",
                  })}
                >
                  Start Flashcards <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Learning Modes (2x2 Grid) */}
          <section aria-labelledby="learning-modes-title">
            <h2 id="learning-modes-title" className="mb-3 text-base font-bold tracking-tight text-foreground">
              More Ways to Practice
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <LearningModeCard
                href={`/sheets/${sheet.id}/quick-recall`}
                icon={Sparkles}
                title="Practice Exercises"
                description="Check your recall with quizzes, reverse translation, and fill-in-the-blank."
              />

              <LearningModeCard
                href={`/sheets/${sheet.id}/table`}
                icon={Layers}
                title="Table View"
                description="Browse full vocabulary list, listen to audio pronunciation, and inspect examples."
              />

              <LearningModeCard
                href={`/ai-support?tab=sentences&sheet=${sheet.id}`}
                icon={Edit3}
                title="Write Sentences"
                description="Write sentences using these words and get bilingual AI feedback."
              />

              <LearningModeCard
                href={`/sheets/${sheet.id}/paragraph-practice`}
                icon={BookOpen}
                title="Translate a Story"
                description="Turn 5–10 expressions into a short story or dialogue with AI coaching."
              />
            </div>
          </section>
        </div>

        {/* Sidebar Column (1/3) */}
        <aside className="space-y-6">
          {/* Progress & SRS Stats Card */}
          <Card className="border-outline/40 bg-surface shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                <span>Sheet Progress</span>
                <BarChart3 className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* 4 Key Metrics */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <StatBox label="Total Cards" value={String(sheet.card_count)} />
                <StatBox label="Priority" value={formatLabel(sheet.priority)} />
                <StatBox label="Reviews" value={String(sheet.review_count)} />
                <StatBox label="Lapses" value={String(sheet.lapse_count)} />
              </div>

              {/* Detailed Metadata List */}
              <div className="divide-y divide-outline/30 text-xs">
                <MetaRow label="Next Review" value={formatDate(sheet.next_review_at)} />
                <MetaRow label="First Learned" value={formatDate(sheet.first_learned_at)} />
                <MetaRow label="Last Reviewed" value={formatDate(sheet.last_reviewed_at)} />
                <MetaRow label="SRS Level" value={String(sheet.srs_level)} />
                <MetaRow
                  label="Interval"
                  value={`${sheet.interval_days} day${sheet.interval_days === 1 ? "" : "s"}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Study Priority Setting Card */}
          <Card className="border-outline/40 bg-surface shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted">
                Study Priority
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-3 text-xs text-muted">
                Adjust how often this sheet is scheduled in your daily review rounds.
              </p>
              <PrioritySelector
                sheetId={sheet.id}
                priority={sheet.priority}
                onSaved={handlePrioritySaved}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

/**
 * Clean Learning Mode Card
 */
function LearningModeCard({
  href,
  icon: IconComponent,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-outline/40 bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-xs"
    >
      <div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-low text-muted group-hover:bg-primary-soft group-hover:text-primary transition-colors">
          <IconComponent className="h-4 w-4" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end text-xs font-semibold text-primary">
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline/30 bg-surface-low p-2.5 text-center">
      <span className="block text-[11px] font-medium text-muted">{label}</span>
      <span className="mt-0.5 block text-base font-bold text-foreground">{value}</span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SheetDetail["status"] }) {
  const variantMap: Record<SheetDetail["status"], "default" | "secondary" | "success" | "warning"> = {
    not_started: "secondary",
    learning: "warning",
    due: "warning",
    learned: "success",
  };
  return <Badge variant={variantMap[status] ?? "secondary"}>{formatLabel(status)}</Badge>;
}

function SheetLoadingState() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-12 text-center text-sm text-muted">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
      <p>Loading sheet details…</p>
    </section>
  );
}

function NotFound() {
  return (
    <section className="max-w-md mx-auto my-12 rounded-2xl border border-outline/40 bg-surface p-8 text-center shadow-xs">
      <h1 className="text-lg font-bold text-foreground">Sheet not found</h1>
      <p className="mt-1 text-xs text-muted">
        The sheet you are looking for may have been removed or renamed.
      </p>
      <div className="mt-4">
        <Link href="/workbooks" className={buttonVariants({ variant: "default", size: "sm" })}>
          Back to Workbooks
        </Link>
      </div>
    </section>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="max-w-md mx-auto my-12 rounded-2xl border border-error/30 bg-surface p-8 text-center shadow-xs">
      <p className="text-xs text-error font-medium">{message}</p>
      <div className="mt-4">
        <Button variant="secondary" size="sm" onClick={() => void onRetry()}>
          Try again
        </Button>
      </div>
    </section>
  );
}
