"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PrioritySelector } from "@/components/sheets/priority-selector";
import { formatDate, formatLabel } from "@/lib/format";
import { ApiRequestError, getSheet, type SheetDetail, type SheetPriority } from "@/services/api";

type SheetDetailProps = {
  sheetId: string;
};

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
        setError(caughtError instanceof Error ? caughtError.message : "Không thể tải sheet.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // The request resolves after mount; cancellation guards prevent an old
    // route request from changing the screen after navigation.
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
        setError(
          caughtError instanceof Error ? caughtError.message : "Không thể tải sheet.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sheetId]);

  if (isLoading) return <p className="text-slate-600">Đang tải sheet…</p>;
  if (notFound) return <NotFound />;
  if (error) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  function handlePrioritySaved(priority: SheetPriority) {
    setSheet((currentSheet) => currentSheet && { ...currentSheet, priority });
  }

  return (
    <section>
      <Link href={`/workbooks/${sheet.workbook.id}`} className="text-sm font-medium text-sky-700 hover:underline">
        ← {sheet.workbook.name}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-slate-500">Sheet {sheet.position}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{sheet.name}</h1>
        </div>
        <PrioritySelector sheetId={sheet.id} priority={sheet.priority} onSaved={handlePrioritySaved} />
      </div>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Cards" value={String(sheet.card_count)} />
        <Stat label="Status" value={formatLabel(sheet.status)} />
        <Stat label="Next review" value={formatDate(sheet.next_review_at)} />
        <Stat label="First learned" value={formatDate(sheet.first_learned_at)} />
        <Stat label="Last reviewed" value={formatDate(sheet.last_reviewed_at)} />
        <Stat label="Review count" value={String(sheet.review_count)} />
      </dl>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Study actions</h2>
        <p className="mt-2 text-sm text-slate-600">Các chế độ học sẽ được mở ở các ngày tiếp theo.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/sheets/${sheet.id}/table`}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Table View
          </Link>
          <Link
            href={`/sheets/${sheet.id}/quick-recall`}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
          >
            Quick Recall
          </Link>
          {['Study'].map((action) => (
            <button key={action} type="button" disabled className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed">
              {action} · Sắp có
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>;
}

function NotFound() {
  return <section className="rounded-xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-semibold">Sheet not found</h1><Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">Quay lại workbooks</Link></section>;
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900"><p>{message}</p><button type="button" onClick={() => void onRetry()} className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold">Thử lại</button></section>;
}
