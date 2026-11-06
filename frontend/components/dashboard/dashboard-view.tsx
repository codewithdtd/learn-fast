"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Flame,
  BookOpen,
  Sparkles,
  Clock,
  ArrowRight,
  Play,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  RotateCcw,
  Plus,
} from "lucide-react";

import { DashboardCheckinBanner } from "@/components/dashboard/dashboard-checkin-banner";
import { DashboardLearningChart } from "@/components/dashboard/dashboard-learning-chart";
import { CozyDashboardView } from "@/components/dashboard/island/cozy-dashboard-view";
import { useTheme } from "@/hooks/use-theme";
import { StartupWarmupCountdown } from "@/components/shared/startup-warmup-countdown";
import { useAuth } from "@/context/auth-context";
import { formatDate, formatLabel } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createStudySession,
  getCalendarMonth,
  getDashboard,
  type DashboardActiveSessionItem,
  type DashboardRecentSessionItem,
  type DashboardSheetItem,
  type DashboardSummary,
} from "@/services/api";

/**
 * Human-crafted Learning Hub Dashboard
 * Follows Linear / Readwise aesthetic: 1px subtle borders, no AI card soup,
 * high-contrast hierarchy, and instant 1-click actionability.
 */
export function DashboardView() {
  const { user } = useAuth();
  const activeTheme = useTheme();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);
    try {
      setDashboard(await getDashboard());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load your learning dashboard.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;
    void getDashboard()
      .then((value) => {
        if (isCurrent) setDashboard(value);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent)
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load your learning dashboard.",
          );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    const now = new Date();
    void getCalendarMonth(now.getFullYear(), now.getMonth() + 1)
      .then((data) => {
        if (isCurrent) setStreak(data.current_streak);
      })
      .catch(() => {});

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading) return <DashboardLoading onRetry={() => void loadDashboard()} />;
  if (error && !dashboard) return <DashboardError message={error} onRetry={loadDashboard} />;
  if (!dashboard) return null;

  const displayName = user?.full_name?.trim() ? user.full_name.trim().split(" ")[0] : "Learner";

  // Khi chọn theme "Cozy Island", hiển thị trải nghiệm Dashboard Hòn đảo mộc mạc
  if (activeTheme === "island") {
    return (
      <main className="dashboard-page">
        <CozyDashboardView dashboard={dashboard} streak={streak} userName={displayName} />
      </main>
    );
  }

  const totalActiveCards =
    dashboard.active_sessions.reduce((acc, s) => acc + s.total_cards, 0) +
    dashboard.due_sheets.reduce((acc, s) => acc + s.card_count, 0) +
    dashboard.new_sheets.reduce((acc, s) => acc + s.card_count, 0);

  return (
    <main className="dashboard-page">
      {/* 1. Header: Greeting, Date, Streak & Stats Strip */}
      <DashboardHeader
        userName={displayName}
        streak={streak}
        totalActiveCards={totalActiveCards}
        dueSheetsCount={dashboard.due_sheets.length}
        generatedAt={dashboard.generated_at}
      />

      {/* 2. Primary Action Hero: 1-Click Actionable Study Loop */}
      <DailyActionHero dashboard={dashboard} />

      {/* 3. Main Dashboard Grid: Two-Column on Desktop, Flow Stack on Mobile */}
      <div className="dashboard-grid">
        <div className="dashboard-main-column">
          {/* Active Sessions in Progress */}
          {dashboard.active_sessions.length > 0 && (
            <ActiveSessionsSection sessions={dashboard.active_sessions} />
          )}

          {/* Due Review Sheets */}
          <DueReviewSection sheets={dashboard.due_sheets} />

          {/* Learn New Content */}
          <LearnNewSection sheets={dashboard.new_sheets} />

          {/* Recent Activity */}
          <RecentActivitySection sessions={dashboard.recent_sessions} />
        </div>

        <aside className="dashboard-side-column">
          {/* Daily Check-in */}
          <DashboardCheckinBanner />

          {/* Study Trends Analytics Chart */}
          <div className="rounded-2xl border border-outline/40 bg-surface p-5 shadow-xs">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">
              Learning Activity
            </h3>
            <DashboardLearningChart dashboard={dashboard} />
          </div>

          {/* Quick Shortcuts */}
          <QuickShortcutsCard weakCount={dashboard.weak_card_count} />

          {/* Weak Cards Alert */}
          {dashboard.weak_card_count > 0 && (
            <WeakCardsCard count={dashboard.weak_card_count} />
          )}
        </aside>
      </div>
    </main>
  );
}

/**
 * Clean Top Header with Greeting, Date and Key Metric Chips
 */
function DashboardHeader({
  userName,
  streak,
  totalActiveCards,
  dueSheetsCount,
  generatedAt,
}: {
  userName: string;
  streak: number;
  totalActiveCards: number;
  dueSheetsCount: number;
  generatedAt: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatDate(generatedAt)}</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Hi, {userName} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted">
          {dueSheetsCount > 0
            ? `You have ${dueSheetsCount} sheet${dueSheetsCount === 1 ? "" : "s"} scheduled for review today.`
            : "All scheduled reviews are caught up. Pick a workbook or practice recall."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/calendar"
          className="group flex items-center gap-2 rounded-xl border border-outline/50 bg-surface px-3 py-2 text-xs font-semibold shadow-xs transition-colors hover:border-primary/40 hover:bg-surface-low"
          title="View study streak and calendar"
        >
          <Flame className="h-4 w-4 text-amber-500 transition-transform group-hover:scale-110" />
          <span>
            <strong className="text-sm font-bold text-foreground">{streak}</strong>{" "}
            <span className="text-muted">day streak</span>
          </span>
        </Link>

        <div
          className="flex items-center gap-2 rounded-xl border border-outline/50 bg-surface px-3 py-2 text-xs font-semibold shadow-xs"
          title="Total active and due learning cards"
        >
          <BookOpen className="h-4 w-4 text-primary" />
          <span>
            <strong className="text-sm font-bold text-foreground">{totalActiveCards}</strong>{" "}
            <span className="text-muted">cards</span>
          </span>
        </div>

        {dueSheetsCount > 0 && (
          <Badge variant="warning" className="px-3 py-1.5 text-xs font-bold">
            {dueSheetsCount} Due
          </Badge>
        )}
      </div>
    </header>
  );
}

/**
 * Actionable Daily Hero Card:
 * Prioritizes active in-progress session -> scheduled SRS review -> fresh cards -> clean state.
 */
function DailyActionHero({ dashboard }: { dashboard: DashboardSummary }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const activeSession = dashboard.active_sessions[0];
  const dueSheet = dashboard.due_sheets[0];
  const newSheet = dashboard.new_sheets[0];
  const selectedSheet = dueSheet ?? newSheet;

  let kicker = "All caught up";
  let title = "Your queue is clear";
  let description = "You've completed all scheduled reviews for today. Practice recall or explore English news.";
  let buttonText = "Explore Workbooks";

  if (activeSession) {
    kicker = "In Progress";
    title = activeSession.sheet.name;
    description = `${activeSession.sheet.workbook_name} · Pick up where you left off with ${activeSession.total_cards} cards.`;
    buttonText = "Continue Practice";
  } else if (dueSheet) {
    kicker = "Due for Review";
    title = dueSheet.name;
    description = `${dueSheet.workbook_name} · ${dueSheet.card_count} cards are ready for spaced repetition review.`;
    buttonText = "Start Daily Review";
  } else if (newSheet) {
    kicker = "Learn New Words";
    title = newSheet.name;
    description = `${newSheet.workbook_name} · Start a new set of ${newSheet.card_count} flashcards.`;
    buttonText = "Start Learning";
  }

  async function handleActionClick() {
    if (isStarting) return;
    setStartError(null);

    if (activeSession) {
      router.push(`/study-sessions/${activeSession.id}`);
      return;
    }
    if (!selectedSheet) {
      router.push("/workbooks");
      return;
    }

    setIsStarting(true);
    try {
      // Ưu tiên lượt ôn đến hạn trước để người học không bỏ lỡ lịch SRS; chỉ học sheet mới khi không còn lượt ôn.
      const session = await createStudySession({
        sheet_id: selectedSheet.id,
        session_type: dueSheet ? "srs_review" : "new_learning",
        direction: "en_to_vi",
      });
      router.push(`/study-sessions/${session.id}`);
    } catch (caughtError) {
      setStartError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not start today's practice. Please try again.",
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <Card className="mb-8 border-primary/25 bg-gradient-to-r from-surface to-surface-low shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <Badge variant={activeSession ? "default" : dueSheet ? "warning" : "secondary"}>
                {kicker}
              </Badge>
              {(activeSession || selectedSheet) && (
                <span className="text-xs text-muted">
                  Step 1: Flashcards SRS → Step 2: Practice Exercises
                </span>
              )}
            </div>

            <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{description}</p>

            {startError && (
              <p className="mt-2 text-xs font-semibold text-error" role="alert">
                {startError}
              </p>
            )}
          </div>

          <div className="flex items-center sm:self-center">
            <Button
              size="lg"
              variant="default"
              className="w-full sm:w-auto"
              onClick={() => void handleActionClick()}
              disabled={isStarting}
              isLoading={isStarting}
              leftIcon={<Play className="h-4 w-4 fill-current" />}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Active study sessions in progress
 */
function ActiveSessionsSection({ sessions }: { sessions: DashboardActiveSessionItem[] }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Continue Learning
        </h2>
        <Badge variant="secondary">{sessions.length} active</Badge>
      </div>

      <div className="grid gap-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col gap-3 rounded-2xl border border-outline/40 bg-surface p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[11px]">
                  {sessionLabel(session.session_type)}
                </Badge>
                <span className="text-xs text-muted">{session.sheet.workbook_name}</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-foreground">
                {session.sheet.name}
              </h3>
              <p className="text-xs text-muted">
                Started {formatDate(session.started_at)} · {session.total_cards} cards in deck
              </p>
            </div>

            <Link
              href={`/study-sessions/${session.id}`}
              className={buttonVariants({ size: "sm", variant: "secondary", className: "w-full sm:w-auto" })}
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Scheduled review sheets
 */
function DueReviewSection({ sheets }: { sheets: DashboardSheetItem[] }) {
  return (
    <section id="today-review" className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Scheduled Review
        </h2>
        {sheets.length > 0 && <Badge variant="warning">{sheets.length} due</Badge>}
      </div>

      {sheets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline/60 bg-surface/50 p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-green" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            No reviews due right now!
          </p>
          <p className="text-xs text-muted">
            You are completely up to date with your spaced repetition schedule.
          </p>
          <Link
            href="/workbooks"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            Browse learning sheets <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-outline/30 rounded-2xl border border-outline/40 bg-surface shadow-xs">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{sheet.workbook_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {formatLabel(sheet.priority)}
                  </Badge>
                </div>
                <h3 className="mt-0.5 text-sm font-bold text-foreground">{sheet.name}</h3>
                <p className="text-xs text-muted">
                  Due {formatDate(sheet.next_review_at)} · {sheet.card_count} cards
                </p>
              </div>

              <Link
                href={`/sheets/${sheet.id}/study?mode=review`}
                className={buttonVariants({ size: "sm", variant: "default", className: "w-full sm:w-auto" })}
              >
                Review now <Play className="h-3 w-3 fill-current" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Learn new sheets
 */
function LearnNewSection({ sheets }: { sheets: DashboardSheetItem[] }) {
  if (sheets.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Learn New Words
        </h2>
        <Link
          href="/workbooks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          View all workbooks <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sheets.map((sheet) => (
          <Link
            key={sheet.id}
            href={`/sheets/${sheet.id}/study`}
            className="group flex flex-col justify-between rounded-2xl border border-outline/40 bg-surface p-4 transition-all hover:border-primary/40 hover:shadow-sm"
          >
            <div>
              <span className="text-xs text-muted">{sheet.workbook_name}</span>
              <h3 className="mt-0.5 text-sm font-bold text-foreground group-hover:text-primary">
                {sheet.name}
              </h3>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>{sheet.card_count} cards</span>
              <span className="font-semibold text-primary group-hover:underline">
                Start learning →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Recent completed sessions
 */
function RecentActivitySection({ sessions }: { sessions: DashboardRecentSessionItem[] }) {
  if (sessions.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Recent Activity
        </h2>
      </div>

      <div className="divide-y divide-outline/30 rounded-2xl border border-outline/40 bg-surface shadow-xs">
        {sessions.map((session) => (
          <Link
            key={session.id}
            href={`/study-sessions/${session.id}/result`}
            className="flex items-center justify-between p-3.5 transition-colors hover:bg-surface-low sm:p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-low text-muted">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground sm:text-sm">
                  {session.sheet_name}
                </p>
                <p className="text-[11px] text-muted">
                  {session.workbook_name} · {formatDate(session.completed_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={
                  session.mastery_score !== null && session.mastery_score >= 80
                    ? "success"
                    : "secondary"
                }
                className="text-xs font-bold"
              >
                {session.mastery_score === null ? "View" : `${session.mastery_score}%`}
              </Badge>
              <ArrowRight className="h-3.5 w-3.5 text-muted" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Clean Shortcuts Card for Quick Navigation
 */
function QuickShortcutsCard({ weakCount }: { weakCount: number }) {
  const shortcuts = [
    {
      title: "Practice Exercises",
      desc: "Quizzes, translation & recall",
      href: "/workbooks",
      icon: Sparkles,
    },
    {
      title: "Read English News",
      desc: "Bilingual reader & vocabulary",
      href: "/reading",
      icon: FileText,
    },
    {
      title: "Weak Cards",
      desc: `${weakCount} cards need attention`,
      href: "/workbooks",
      icon: AlertTriangle,
    },
    {
      title: "Import Deck",
      desc: "Upload from Excel or Anki",
      href: "/import",
      icon: Plus,
    },
  ];

  return (
    <Card className="border-outline/40 bg-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted">
          Quick Practice & Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1 p-2 pt-0">
        {shortcuts.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-low"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-low text-muted">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground">{item.title}</p>
              <p className="truncate text-[11px] text-muted">{item.desc}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Weak Cards Summary Card
 */
function WeakCardsCard({ count }: { count: number }) {
  return (
    <Card className="border-error/25 bg-error-soft/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <p className="text-xs font-bold text-foreground">
              {count} Weak {count === 1 ? "Card" : "Cards"}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              These cards need extra recall attention. Select Weak Cards in sheet study to practice.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function sessionLabel(type: DashboardActiveSessionItem["session_type"]): string {
  if (type === "srs_review") return "Scheduled Review";
  if (type === "weak_cards") return "Weak-card Practice";
  return "Flashcard Study";
}

function DashboardLoading({ onRetry }: { onRetry?: () => void }) {
  const [showWarmup, setShowWarmup] = useState(false);

  useEffect(() => {
    // Nếu nạp nhanh (< 900ms), giữ skeleton nhẹ để không làm giật giao diện.
    // Nếu quá 900ms (dấu hiệu Render cold start), hiển thị bộ đếm ngược sinh động.
    const timer = setTimeout(() => {
      setShowWarmup(true);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  if (showWarmup) {
    return (
      <main className="dashboard-page">
        <StartupWarmupCountdown context="dashboard" onReady={onRetry} />
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-skeleton" aria-label="Loading dashboard">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <main className="dashboard-page">
      <StartupWarmupCountdown
        context="dashboard"
        initialSeconds={30}
        onReady={() => void onRetry()}
      />
      <section role="alert" className="error-card mt-4 p-4 text-center">
        <p className="mb-2 text-xs text-muted">Connection note: {message}</p>
        <Button variant="secondary" size="sm" onClick={() => void onRetry()}>
          Thử tải lại Dashboard
        </Button>
      </section>
    </main>
  );
}
