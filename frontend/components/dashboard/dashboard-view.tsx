"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardCheckinBanner } from "@/components/dashboard/dashboard-checkin-banner";
import { Icon } from "@/components/layout/app-shell";
import { formatDate, formatLabel } from "@/lib/format";
import { getDashboard, type DashboardActiveSessionItem, type DashboardRecentSessionItem, type DashboardSheetItem, type DashboardSummary } from "@/services/api";

export function DashboardView() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true); setError(null);
    try { setDashboard(await getDashboard()); }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Could not load your learning dashboard."); }
    finally { setIsLoading(false); }
  }

  useEffect(() => {
    let isCurrent = true;
    void getDashboard().then((value) => { if (isCurrent) setDashboard(value); }).catch((caughtError: unknown) => {
      if (isCurrent) setError(caughtError instanceof Error ? caughtError.message : "Could not load your learning dashboard.");
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, []);

  if (isLoading) return <DashboardLoading />;
  if (error && !dashboard) return <DashboardError message={error} onRetry={loadDashboard} />;
  if (!dashboard) return null;

  return (
    <main className="dashboard-page">
      <header className="dashboard-heading">
        <div><p className="eyebrow">English SRS</p><h1>Today&apos;s learning</h1><p className="heading-date"><Icon name="calendar" size={19} /> {formatDate(dashboard.generated_at)}</p></div>
        <div className="heading-actions"><Link href="/import" className="button secondary">Import workbook</Link><Link href="/workbooks" className="button secondary">Workbooks</Link></div>
      </header>

      <DashboardCheckinBanner />

      <div className="dashboard-grid">

        <div className="dashboard-main-column">
          <DashboardOverview dashboard={dashboard} />
          <DashboardSectionHeading title="Continue Learning" />
          {dashboard.active_sessions.length > 0 ? <div className="session-stack">{dashboard.active_sessions.map((session) => <ActiveSessionCard key={session.id} session={session} />)}</div> : <EmptyState>No study sessions are currently in progress.</EmptyState>}
          <ReviewSection sheets={dashboard.due_sheets} />
          <LearnNewSection sheets={dashboard.new_sheets} />
          <RecentActivity sessions={dashboard.recent_sessions} />
        </div>
        <aside className="dashboard-side-column">
          <OverviewSideCard dashboard={dashboard} />
          <WeakCardsSummary count={dashboard.weak_card_count} />
        </aside>
      </div>
    </main>
  );
}

function DashboardOverview({ dashboard }: { dashboard: DashboardSummary }) {
  return <section className="overview-mobile-card"><div className="section-heading"><div><p className="eyebrow">Your queues</p><h2>Ready when you are</h2></div><Icon name="review" size={28} /></div><div className="overview-stats"><Stat value={dashboard.due_sheets.length} label="Due sheets" tone="primary" /><Stat value={dashboard.active_sessions.length} label="Active sessions" tone="green" /><Stat value={dashboard.new_sheets.length} label="New sheets" tone="gold" /></div></section>;
}

function OverviewSideCard({ dashboard }: { dashboard: DashboardSummary }) {
  return <section className="side-card overview-side-card"><p className="eyebrow">Today&apos;s overview</p><div className="side-stat"><strong>{dashboard.due_sheets.length}</strong><span>due sheets</span></div><div className="queue-bar"><span style={{ width: `${dashboard.due_sheets.length > 0 ? 100 : 0}%` }} /></div><div className="side-stat-list"><span><Icon name="review" size={18} /> Scheduled review</span><strong>{dashboard.due_sheets.length}</strong><span><Icon name="clock" size={18} /> Active sessions</span><strong>{dashboard.active_sessions.length}</strong></div></section>;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "primary" | "green" | "gold" }) { return <div className={`stat stat-${tone}`}><strong>{value}</strong><span>{label}</span></div>; }

function ReviewSection({ sheets }: { sheets: DashboardSheetItem[] }) {
  return <section className="dashboard-section review-section"><DashboardSectionHeading title="Today&apos;s Review" count={sheets.length} /><div className="review-card">{sheets.length === 0 ? <EmptyState><span>No sheets are due right now. You are up to date.</span><Link href="/workbooks" className="text-link">Browse learning sheets <Icon name="arrow" size={17} /></Link></EmptyState> : <div className="review-list">{sheets.map((sheet) => <DueSheetRow key={sheet.id} sheet={sheet} />)}</div>}</div></section>;
}

function DueSheetRow({ sheet }: { sheet: DashboardSheetItem }) {
  return <div className="review-row"><div className="review-icon"><Icon name="review" size={25} /></div><div className="row-copy"><strong>{sheet.name}</strong><span>{sheet.workbook_name} · Due {formatDate(sheet.next_review_at)} · {formatLabel(sheet.priority)} priority</span></div><Link href={`/sheets/${sheet.id}/study?mode=review`} className="button primary">Review now</Link></div>;
}

function ActiveSessionCard({ session }: { session: DashboardActiveSessionItem }) {
  return <article className="active-session-card"><div className="session-badge">Current session</div><h3>{session.sheet.name}</h3><p>{session.sheet.workbook_name} · {sessionLabel(session.session_type)}</p><small>Started {formatDate(session.started_at)} · {session.total_cards} cards</small><Link href={`/study-sessions/${session.id}`} className="button light">Continue learning <Icon name="arrow" size={18} /></Link></article>;
}

function LearnNewSection({ sheets }: { sheets: DashboardSheetItem[] }) {
  return <section className="dashboard-section"><DashboardSectionHeading title="Learn New" count={sheets.length} action={<Link href="/workbooks" className="text-link">See all <Icon name="arrow" size={17} /></Link>} />{sheets.length === 0 ? <EmptyState>All available sheets have been started. Import a workbook to add more learning content.</EmptyState> : <div className="learn-new-grid">{sheets.map((sheet) => <Link key={sheet.id} href={`/sheets/${sheet.id}/study`} className="learn-new-card"><span className="card-icon"><Icon name="books" size={23} /></span><span className="card-title">{sheet.name}</span><span className="card-meta">{sheet.workbook_name}</span><span className="card-count">{sheet.card_count} cards</span></Link>)}</div>}</section>;
}

function WeakCardsSummary({ count }: { count: number }) {
  return <section className="side-card weak-card"><div className="section-heading"><p className="eyebrow">Weak cards</p><span className="count-badge">{count}</span></div><div className="weak-copy"><span className="weak-icon"><Icon name="weak" size={24} /></span><p>{count === 0 ? "No cards are currently marked Weak." : `${count} card${count === 1 ? "" : "s"} need extra attention in sheet study.`}</p></div>{count > 0 && <p className="supporting-copy">Choose Weak cards from a sheet&apos;s study setup when you are ready to practise them.</p>}</section>;
}

function RecentActivity({ sessions }: { sessions: DashboardRecentSessionItem[] }) {
  return <section className="dashboard-section recent-section"><DashboardSectionHeading title="Recent Activity" />{sessions.length === 0 ? <EmptyState>Completed sessions will appear here.</EmptyState> : <div className="activity-list">{sessions.map((session) => <RecentActivityItem key={session.id} session={session} />)}</div>}</section>;
}

function RecentActivityItem({ session }: { session: DashboardRecentSessionItem }) {
  return <Link href={`/study-sessions/${session.id}/result`} className="activity-item"><span className="activity-icon"><Icon name="check" size={20} /></span><span className="row-copy"><strong>{session.sheet_name}</strong><span>{session.workbook_name} · {sessionLabel(session.session_type)} · {formatDate(session.completed_at)}</span></span><span className="activity-score">{session.mastery_score === null ? "View" : `${session.mastery_score}%`}</span></Link>;
}

function DashboardSectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) { return <div className="dashboard-section-heading"><h2>{title}{count !== undefined && <span className="heading-count">{count}</span>}</h2>{action}</div>; }
function sessionLabel(type: DashboardActiveSessionItem["session_type"]): string { if (type === "srs_review") return "Scheduled review"; if (type === "weak_cards") return "Weak-card practice"; return "Flashcard study"; }
function EmptyState({ children }: { children: React.ReactNode }) { return <div className="empty-state">{children}</div>; }
function DashboardLoading() { return <main className="dashboard-page"><div className="dashboard-skeleton" aria-label="Loading dashboard"><span /><span /><span /><span /><span /></div></main>; }
function DashboardError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <main className="dashboard-page"><section role="alert" className="error-card"><p>{message}</p><button type="button" className="button secondary" onClick={() => void onRetry()}>Try again</button></section></main>; }
