"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatDate, formatLabel } from "@/lib/format";
import {
  getDashboard,
  type DashboardActiveSessionItem,
  type DashboardRecentSessionItem,
  type DashboardSheetItem,
  type DashboardSummary,
} from "@/services/api";

export function DashboardView() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
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
      .then((loadedDashboard) => {
        if (isCurrent) setDashboard(loadedDashboard);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load your learning dashboard.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading) return <DashboardLoading />;
  if (error && !dashboard) return <DashboardError message={error} onRetry={loadDashboard} />;
  if (!dashboard) return null;

  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">English SRS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Today</h1>
          <p className="mt-2 text-slate-600">Your next learning actions, ordered by priority.</p>
        </div>
        <nav aria-label="Workbook actions" className="flex flex-wrap gap-3">
          <Link href="/import" className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
            Import workbook
          </Link>
          <Link href="/workbooks" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
            Workbooks
          </Link>
        </nav>
      </header>

      <div className="mt-8 space-y-6">
        <DashboardSection title="Review Today" count={dashboard.due_sheets.length} description="Sheets whose scheduled review date has arrived.">
          {dashboard.due_sheets.length === 0 ? (
            <EmptyState>No sheets are due right now. You are up to date.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-200">
              {dashboard.due_sheets.map((sheet) => <DueSheetRow key={sheet.id} sheet={sheet} />)}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection title="Continue Learning" count={dashboard.active_sessions.length} description="Saved sessions that you can resume without starting over.">
          {dashboard.active_sessions.length === 0 ? (
            <EmptyState>No study sessions are currently in progress.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-200">
              {dashboard.active_sessions.map((session) => <ActiveSessionRow key={session.id} session={session} />)}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection title="Learn New" count={dashboard.new_sheets.length} description="Sheets that have not been started and have no active session.">
          {dashboard.new_sheets.length === 0 ? (
            <EmptyState>All available sheets have been started. Continue a session or import a workbook.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-200">
              {dashboard.new_sheets.map((sheet) => <NewSheetRow key={sheet.id} sheet={sheet} />)}
            </ul>
          )}
        </DashboardSection>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="text-xl font-semibold">Weak Cards</h2>
          {dashboard.weak_card_count === 0 ? (
            <p className="mt-2">No cards are currently marked Weak.</p>
          ) : (
            <p className="mt-2"><span className="font-semibold">{dashboard.weak_card_count}</span> card{dashboard.weak_card_count === 1 ? "" : "s"} need extra attention. Use Weak cards only from a sheet&apos;s study setup.</p>
          )}
        </section>

        <DashboardSection title="Recent Activity" description="Your five most recently completed study sessions.">
          {dashboard.recent_sessions.length === 0 ? (
            <EmptyState>Completed sessions will appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-200">
              {dashboard.recent_sessions.map((session) => <RecentSessionRow key={session.id} session={session} />)}
            </ul>
          )}
        </DashboardSection>
      </div>
    </section>
  );
}

function DashboardSection({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count?: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}{count !== undefined ? ` (${count})` : ""}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DueSheetRow({ sheet }: { sheet: DashboardSheetItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <SheetMetadata sheet={sheet} detail={`Due ${formatDate(sheet.next_review_at)}`} />
      <Link href={`/sheets/${sheet.id}/study?mode=review`} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
        Review now
      </Link>
    </li>
  );
}

function NewSheetRow({ sheet }: { sheet: DashboardSheetItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <SheetMetadata sheet={sheet} detail={`${sheet.card_count} card${sheet.card_count === 1 ? "" : "s"}`} />
      <Link href={`/sheets/${sheet.id}/study`} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
        Start learning
      </Link>
    </li>
  );
}

function SheetMetadata({ sheet, detail }: { sheet: DashboardSheetItem; detail: string }) {
  return (
    <div>
      <p className="font-semibold text-slate-900">{sheet.name}</p>
      <p className="mt-1 text-sm text-slate-600">{sheet.workbook_name} · {detail} · {formatLabel(sheet.priority)} priority</p>
    </div>
  );
}

function ActiveSessionRow({ session }: { session: DashboardActiveSessionItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="font-semibold text-slate-900">{session.sheet.name}</p>
        <p className="mt-1 text-sm text-slate-600">{sessionLabel(session.session_type)} · {session.sheet.workbook_name} · Started {formatDate(session.started_at)}</p>
      </div>
      <Link href={`/study-sessions/${session.id}`} className="rounded-lg border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50">
        Continue
      </Link>
    </li>
  );
}

function RecentSessionRow({ session }: { session: DashboardRecentSessionItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="font-semibold text-slate-900">{session.sheet_name}</p>
        <p className="mt-1 text-sm text-slate-600">{sessionLabel(session.session_type)} · {session.workbook_name} · Completed {formatDate(session.completed_at)}</p>
      </div>
      <Link href={`/study-sessions/${session.id}/result`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
        {session.mastery_score === null ? "View result" : `${session.mastery_score}% mastery`}
      </Link>
    </li>
  );
}

function sessionLabel(sessionType: DashboardActiveSessionItem["session_type"]): string {
  if (sessionType === "srs_review") return "Scheduled review";
  if (sessionType === "weak_cards") return "Weak-card practice";
  return "Flashcard study";
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{children}</p>;
}

function DashboardLoading() {
  return <p className="mt-8 text-slate-600">Loading your learning dashboard…</p>;
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p>{message}</p>
      <button type="button" onClick={() => void onRetry()} className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold">
        Try again
      </button>
    </section>
  );
}
