"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { PrioritySelector } from "@/components/sheets/priority-selector";
import { formatDate, formatLabel } from "@/lib/format";
import { ApiRequestError, getSheet, type SheetDetail, type SheetPriority } from "@/services/api";

type SheetDetailProps = { sheetId: string };

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

  if (isLoading) return <SheetState>Loading sheet…</SheetState>;
  if (notFound) return <NotFound />;
  if (error) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  function handlePrioritySaved(priority: SheetPriority) {
    setSheet((currentSheet) => currentSheet && { ...currentSheet, priority });
  }

  return (
    <section className="sheet-detail-content">
      <header className="sheet-detail-header">
        <nav className="sheet-detail-breadcrumb" aria-label="Breadcrumb">
          <Link href="/workbooks">Workbooks</Link>
          <span>›</span>
          <Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link>
          <span>›</span>
          <span aria-current="page">{sheet.name}</span>
        </nav>
        <Link href={`/workbooks/${sheet.workbook.id}`} className="sheet-detail-back">
          <Icon name="back" size={18} /> Back to {sheet.workbook.name}
        </Link>
        <div className="sheet-detail-title-row">
          <div>
            <p className="sheet-detail-kicker">Sheet {sheet.position} · {formatLabel(sheet.status)}</p>
            <h1>{sheet.name}</h1>
            <p className="sheet-detail-subtitle">Part of <Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link></p>
          </div>
          <StatusBadge status={sheet.status} />
        </div>
      </header>

      <div className="sheet-detail-layout">
        <div className="sheet-detail-main">
          <section className="sheet-detail-hero-card">
            <div className="sheet-detail-hero-copy">
              <p className="eyebrow">Ready to learn</p>
              <h2>Choose your study mode</h2>
              <p>Use the mode that fits your next focused learning session.</p>
            </div>
            <Link href={`/sheets/${sheet.id}/study`} className="sheet-detail-primary-action">
              <span className="sheet-action-icon"><Icon name="study" size={22} /></span>
              <span><strong>Study Flashcards</strong><small>Review this sheet with spaced repetition.</small></span>
              <Icon name="arrow" size={20} />
            </Link>
          </section>

          <section className="sheet-detail-actions" aria-labelledby="sheet-actions-title">
            <div className="section-heading"><div><p className="eyebrow">More ways to practice</p><h2 id="sheet-actions-title">Learning modes</h2></div></div>
            <div className="sheet-action-grid">
              <ActionCard href={`/sheets/${sheet.id}/quick-recall`} icon="review" title="Quick Recall" description="Fast-paced recognition practice." tone="mint" />
              <ActionCard href={`/sheets/${sheet.id}/table`} icon="books" title="Table View" description="Browse the full vocabulary list." tone="gold" />
            </div>
          </section>
        </div>

        <aside className="sheet-detail-sidebar">
          <section className="sheet-detail-panel" aria-labelledby="sheet-overview-title">
            <div className="section-heading"><div><p className="eyebrow">Sheet overview</p><h2 id="sheet-overview-title">Progress data</h2></div><Icon name="review" size={22} /></div>
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
              <MetaRow label="Interval" value={`${sheet.interval_days} day${sheet.interval_days === 1 ? "" : "s"}`} />
            </div>
          </section>

          <section className="sheet-detail-panel sheet-priority-panel" aria-labelledby="sheet-priority-title">
            <div className="section-heading"><div><p className="eyebrow">Personalize review</p><h2 id="sheet-priority-title">Study priority</h2></div></div>
            <PrioritySelector sheetId={sheet.id} priority={sheet.priority} onSaved={handlePrioritySaved} />
          </section>
        </aside>
      </div>
    </section>
  );
}

function ActionCard({ href, icon, title, description, tone }: { href: string; icon: "review" | "books"; title: string; description: string; tone: "mint" | "gold" }) {
  return <Link href={href} className={`sheet-action-card ${tone}`}><span className="sheet-action-icon"><Icon name={icon} size={23} /></span><span><strong>{title}</strong><small>{description}</small></span><Icon name="arrow" size={20} /></Link>;
}

function StatusBadge({ status }: { status: SheetDetail["status"] }) { return <span className={`sheet-status-badge ${status}`}>{formatLabel(status)}</span>; }
function Stat({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`sheet-stat ${tone}`}><dt>{label}</dt><dd>{value}</dd></div>; }
function MetaRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function SheetState({ children }: { children: React.ReactNode }) { return <section className="sheet-detail-state">{children}</section>; }
function NotFound() { return <section className="sheet-detail-state"><h1>Sheet not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="sheet-detail-state sheet-detail-state-error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
