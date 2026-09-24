"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardCheckinBanner } from "@/components/dashboard/dashboard-checkin-banner";
import { DashboardLearningChart } from "@/components/dashboard/dashboard-learning-chart";
import { Icon } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth-context";
import { formatDate, formatLabel } from "@/lib/format";
import {
  getCalendarMonth,
  getDashboard,
  type DashboardActiveSessionItem,
  type DashboardRecentSessionItem,
  type DashboardSheetItem,
  type DashboardSummary,
} from "@/services/api";

export function DashboardView() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [streak, setStreak] = useState(0);
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

    const now = new Date();
    void getCalendarMonth(now.getFullYear(), now.getMonth() + 1)
      .then((data) => {
        if (isCurrent) setStreak(data.current_streak);
      })
      .catch(() => {});

    return () => { isCurrent = false; };
  }, []);

  if (isLoading) return <DashboardLoading />;
  if (error && !dashboard) return <DashboardError message={error} onRetry={loadDashboard} />;
  if (!dashboard) return null;

  const displayName = user?.full_name?.trim() ? user.full_name.trim().split(" ")[0] : "Learner";
  const badgesCount = Math.max(1, Math.floor(streak / 2) + Math.min(5, dashboard.recent_sessions.length));
  const totalActiveCards =
    dashboard.active_sessions.reduce((acc, s) => acc + s.total_cards, 0) +
    dashboard.due_sheets.reduce((acc, s) => acc + s.card_count, 0) +
    dashboard.new_sheets.reduce((acc, s) => acc + s.card_count, 0);

  return (
    <main className="dashboard-page">
      <DashboardWelcomeHeader userName={displayName} />
      <DashboardGamifiedStatsBar streak={streak} cardsCount={totalActiveCards} badgesCount={badgesCount} />
      <FeaturedHeroCard dashboard={dashboard} />
      <ExplorePastelGrid dashboard={dashboard} />

      <header className="dashboard-heading">
        <div><p className="eyebrow">English SRS</p><h1>Today&apos;s learning</h1><p className="heading-date"><Icon name="calendar" size={19} /> {formatDate(dashboard.generated_at)}</p></div>
        <div className="heading-actions"><Link href="/import" className="button secondary">Import workbook</Link><Link href="/workbooks" className="button secondary">Workbooks</Link></div>
      </header>

      <DashboardCheckinBanner />

      <DashboardLearningChart dashboard={dashboard} />

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
  return (
    <section id="today-review" className="dashboard-section review-section">
      <DashboardSectionHeading title="Today's Review" count={sheets.length} />
      <div className="review-card">
        {sheets.length === 0 ? (
          <EmptyState>
            <span className="empty-state-icon" aria-hidden="true">
              <Icon name="check" size={24} />
            </span>
            <p>No sheets are due right now. You are completely up to date.</p>
            <Link href="/workbooks" className="text-link" aria-label="Browse learning sheets">
              Browse learning sheets <Icon name="arrow" size={17} />
            </Link>
          </EmptyState>
        ) : (
          <div className="review-list">
            {sheets.map((sheet) => (
              <DueSheetRow key={sheet.id} sheet={sheet} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DueSheetRow({ sheet }: { sheet: DashboardSheetItem }) {
  return (
    <div className="review-row">
      <div className="review-icon" aria-hidden="true">
        <Icon name="review" size={25} />
      </div>
      <div className="row-copy">
        <strong>{sheet.name}</strong>
        <span>
          {sheet.workbook_name} · Due {formatDate(sheet.next_review_at)} · {formatLabel(sheet.priority)} priority
        </span>
      </div>
      <Link
        href={`/sheets/${sheet.id}/study?mode=review`}
        className="button primary"
        aria-label={`Review now: ${sheet.name} from ${sheet.workbook_name}`}
      >
        Review now
      </Link>
    </div>
  );
}

function ActiveSessionCard({ session }: { session: DashboardActiveSessionItem }) {
  return (
    <article className="active-session-card">
      <div className="session-badge">Current session</div>
      <h3>{session.sheet.name}</h3>
      <p>
        {session.sheet.workbook_name} · {sessionLabel(session.session_type)}
      </p>
      <small>
        Started {formatDate(session.started_at)} · {session.total_cards} cards
      </small>
      <Link
        href={`/study-sessions/${session.id}`}
        className="button light"
        aria-label={`Continue learning session for ${session.sheet.name}`}
      >
        Continue learning <Icon name="arrow" size={18} />
      </Link>
    </article>
  );
}

function LearnNewSection({ sheets }: { sheets: DashboardSheetItem[] }) {
  return (
    <section className="dashboard-section">
      <DashboardSectionHeading
        title="Learn New"
        count={sheets.length}
        action={
          <Link href="/workbooks" className="text-link" aria-label="See all workbooks">
            See all <Icon name="arrow" size={17} />
          </Link>
        }
      />
      {sheets.length === 0 ? (
        <EmptyState>
          <span className="empty-state-icon" aria-hidden="true">
            <Icon name="books" size={24} />
          </span>
          <p>All available sheets have been started. Import a workbook to add more learning content.</p>
          <Link href="/import" className="text-link" aria-label="Import a new workbook">
            Import workbook <Icon name="arrow" size={17} />
          </Link>
        </EmptyState>
      ) : (
        <div className="learn-new-grid">
          {sheets.map((sheet) => (
            <Link
              key={sheet.id}
              href={`/sheets/${sheet.id}/study`}
              className="learn-new-card"
              aria-label={`Learn new sheet: ${sheet.name} from ${sheet.workbook_name}, ${sheet.card_count} cards`}
            >
              <span className="card-icon" aria-hidden="true">
                <Icon name="books" size={23} />
              </span>
              <span className="card-title">{sheet.name}</span>
              <span className="card-meta">{sheet.workbook_name}</span>
              <span className="card-count">{sheet.card_count} cards</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function WeakCardsSummary({ count }: { count: number }) {
  return <section className="side-card weak-card"><div className="section-heading"><p className="eyebrow">Weak cards</p><span className="count-badge">{count}</span></div><div className="weak-copy"><span className="weak-icon"><Icon name="weak" size={24} /></span><p>{count === 0 ? "No cards are currently marked Weak." : `${count} card${count === 1 ? "" : "s"} need extra attention in sheet study.`}</p></div>{count > 0 && <p className="supporting-copy">Choose Weak cards from a sheet&apos;s study setup when you are ready to practise them.</p>}</section>;
}

function RecentActivity({ sessions }: { sessions: DashboardRecentSessionItem[] }) {
  return (
    <section className="dashboard-section recent-section">
      <DashboardSectionHeading title="Recent Activity" />
      {sessions.length === 0 ? (
        <EmptyState>
          <span className="empty-state-icon" aria-hidden="true">
            <Icon name="clock" size={24} />
          </span>
          <p>Completed study sessions and review rounds will appear here.</p>
        </EmptyState>
      ) : (
        <div className="activity-list">
          {sessions.map((session) => (
            <RecentActivityItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivityItem({ session }: { session: DashboardRecentSessionItem }) {
  return (
    <Link
      href={`/study-sessions/${session.id}/result`}
      className="activity-item"
      aria-label={`View result for ${session.sheet_name} session, scored ${session.mastery_score === null ? "unscored" : `${session.mastery_score}%`}`}
    >
      <span className="activity-icon" aria-hidden="true">
        <Icon name="check" size={20} />
      </span>
      <span className="row-copy">
        <strong>{session.sheet_name}</strong>
        <span>
          {session.workbook_name} · {sessionLabel(session.session_type)} · {formatDate(session.completed_at)}
        </span>
      </span>
      <span className="activity-score">{session.mastery_score === null ? "View" : `${session.mastery_score}%`}</span>
    </Link>
  );
}

function DashboardSectionHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) { return <div className="dashboard-section-heading"><h2>{title}{count !== undefined && <span className="heading-count">{count}</span>}</h2>{action}</div>; }
function sessionLabel(type: DashboardActiveSessionItem["session_type"]): string { if (type === "srs_review") return "Scheduled review"; if (type === "weak_cards") return "Weak-card practice"; return "Flashcard study"; }
function EmptyState({ children }: { children: React.ReactNode }) { return <div className="empty-state">{children}</div>; }
function DashboardLoading() { return <main className="dashboard-page"><div className="dashboard-skeleton" aria-label="Loading dashboard"><span /><span /><span /><span /><span /></div></main>; }
function DashboardError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <main className="dashboard-page"><section role="alert" className="error-card"><p>{message}</p><button type="button" className="button secondary" onClick={() => void onRetry()}>Try again</button></section></main>; }

function DashboardWelcomeHeader({ userName }: { userName: string }) {
  const initial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "L";
  return (
    <div className="dashboard-welcome-header">
      <div className="welcome-avatar-wrap">
        <div className="welcome-avatar" aria-hidden="true">
          {initial}
        </div>
        <div className="welcome-text">
          <h2>Hello, {userName}! 👋</h2>
          <p>Ready to learn something new?</p>
        </div>
      </div>
    </div>
  );
}

function DashboardGamifiedStatsBar({
  streak,
  cardsCount,
  badgesCount,
}: {
  streak: number;
  cardsCount: number;
  badgesCount: number;
}) {
  return (
    <div className="gamified-stats-bar" aria-label="Learning statistics">
      <Link href="/calendar" className="gamified-stat-chip" title="View study calendar and streaks">
        <span className="gamified-stat-icon" aria-hidden="true">🔥</span>
        <div className="gamified-stat-data">
          <strong>{streak}</strong>
          <span>Day Streak</span>
        </div>
      </Link>
      <div className="gamified-stat-chip" title="Total active and due learning cards">
        <span className="gamified-stat-icon" aria-hidden="true">🪙</span>
        <div className="gamified-stat-data">
          <strong>{cardsCount}</strong>
          <span>Cards</span>
        </div>
      </div>
      <div className="gamified-stat-chip" title="Badges and learning achievements">
        <span className="gamified-stat-icon" aria-hidden="true">🎖️</span>
        <div className="gamified-stat-data">
          <strong>{badgesCount}</strong>
          <span>Badges</span>
        </div>
      </div>
    </div>
  );
}

function FeaturedHeroCard({ dashboard }: { dashboard: DashboardSummary }) {
  const activeSession = dashboard.active_sessions[0];
  const dueSheet = dashboard.due_sheets[0];
  const newSheet = dashboard.new_sheets[0];

  let pill = "Featured Lesson";
  let title = "Your English Decks";
  let subtitle = "Start studying flashcards to build long-term memory.";
  let href = "/workbooks";
  let ctaText = "Explore Decks";
  let mascot = "⭐";

  if (activeSession) {
    pill = "Continue Session";
    title = activeSession.sheet.name;
    subtitle = `${activeSession.sheet.workbook_name} · ${activeSession.total_cards} cards`;
    href = `/study-sessions/${activeSession.id}`;
    ctaText = "Continue Learning";
    mascot = "🚀";
  } else if (dueSheet) {
    pill = "Due for Review";
    title = dueSheet.name;
    subtitle = `${dueSheet.workbook_name} · Due now · ${formatLabel(dueSheet.priority)} priority`;
    href = `/sheets/${dueSheet.id}/study?mode=review`;
    ctaText = "Review Now";
    mascot = "🎯";
  } else if (newSheet) {
    pill = "Start New Sheet";
    title = newSheet.name;
    subtitle = `${newSheet.workbook_name} · ${newSheet.card_count} new cards ready`;
    href = `/sheets/${newSheet.id}/study`;
    ctaText = "Start Learning";
    mascot = "📚";
  }

  return (
    <section className="featured-hero-card" aria-label="Featured learning activity">
      <span className="hero-pill-badge">{pill}</span>
      <div className="hero-content-wrap">
        <div className="hero-text-block">
          <h2 className="hero-title">{title}</h2>
          <p className="hero-subtitle">{subtitle}</p>
          <Link href={href} className="hero-cta-btn">
            {ctaText} <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="hero-mascot-badge" aria-hidden="true">
          {mascot}
        </div>
      </div>
    </section>
  );
}

function ExplorePastelGrid({ dashboard }: { dashboard: DashboardSummary }) {
  return (
    <section className="explore-section" aria-label="Explore learning modules">
      <div className="explore-section-header">
        <h3>✨ Let&apos;s Explore</h3>
        <Link href="/workbooks" className="text-link" style={{ fontSize: "12px" }}>
          View all <Icon name="arrow" size={15} />
        </Link>
      </div>
      <div className="explore-grid">
        <Link href="/workbooks" className="explore-tile pastel-blue" aria-label="Explore English SRS Workbooks">
          <div className="explore-tile-icon-wrap" aria-hidden="true">📚</div>
          <div className="explore-tile-info">
            <strong>English SRS</strong>
            <span>All Workbooks</span>
          </div>
        </Link>

        <Link href="/workbooks" className="explore-tile pastel-peach" aria-label="Quick Recall fast practice">
          <div className="explore-tile-icon-wrap" aria-hidden="true">⚡</div>
          <div className="explore-tile-info">
            <strong>Quick Recall</strong>
            <span>Fast recall mode</span>
          </div>
        </Link>

        <Link href="/calendar" className="explore-tile pastel-mint" aria-label="Study Calendar and streak">
          <div className="explore-tile-icon-wrap" aria-hidden="true">📅</div>
          <div className="explore-tile-info">
            <strong>Calendar</strong>
            <span>Check-in streak</span>
          </div>
        </Link>

        <Link href="/import" className="explore-tile pastel-lavender" aria-label="Import deck from Excel or Anki">
          <div className="explore-tile-icon-wrap" aria-hidden="true">📥</div>
          <div className="explore-tile-info">
            <strong>Import Deck</strong>
            <span>Excel / Sheets</span>
          </div>
        </Link>

        <Link href="/workbooks" className="explore-tile pastel-coral" aria-label={`Weak cards: ${dashboard.weak_card_count} cards`}>
          <div className="explore-tile-icon-wrap" aria-hidden="true">🎯</div>
          <div className="explore-tile-info">
            <strong>Weak Cards</strong>
            <span>{dashboard.weak_card_count} to fix</span>
          </div>
        </Link>

        <Link href="#today-review" className="explore-tile pastel-yellow" aria-label={`Today's review: ${dashboard.due_sheets.length} due`}>
          <div className="explore-tile-icon-wrap" aria-hidden="true">🏆</div>
          <div className="explore-tile-info">
            <strong>Quiz Review</strong>
            <span>{dashboard.due_sheets.length} due</span>
          </div>
        </Link>
      </div>
    </section>
  );
}


