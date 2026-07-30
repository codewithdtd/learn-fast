"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SheetListItem } from "@/components/sheets/sheet-list-item";
import { formatDate } from "@/lib/format";
import { ApiRequestError, getWorkbook, type WorkbookDetail } from "@/services/api";

type WorkbookDetailProps = {
  workbookId: string;
};

export function WorkbookDetailView({ workbookId }: WorkbookDetailProps) {
  const [workbook, setWorkbook] = useState<WorkbookDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function loadWorkbook() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setWorkbook(await getWorkbook(workbookId));
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Không thể tải workbook.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // The request resolves after mount; cancellation guards prevent an old
    // route request from changing the screen after navigation.
    void getWorkbook(workbookId)
      .then((loadedWorkbook) => {
        if (isCurrent) setWorkbook(loadedWorkbook);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Không thể tải workbook.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [workbookId]);

  if (isLoading) {
    return <p className="text-slate-600">Đang tải workbook…</p>;
  }
  if (notFound) {
    return <NotFound />;
  }
  if (error) {
    return <RetryError message={error} onRetry={loadWorkbook} />;
  }
  if (!workbook) {
    return null;
  }

  return (
    <section>
      <Link href="/workbooks" className="text-sm font-medium text-sky-700 hover:underline">
        ← Workbooks
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{workbook.name}</h1>
      <p className="mt-2 text-slate-600">{workbook.original_filename}</p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Sheets" value={String(workbook.sheet_count)} />
        <Stat label="Cards" value={String(workbook.total_cards)} />
        <Stat label="Imported" value={formatDate(workbook.imported_at)} />
      </dl>
      <h2 className="mt-10 text-xl font-semibold">Sheets</h2>
      <ul className="mt-4 space-y-3">
        {workbook.sheets.map((sheet) => (
          <SheetListItem key={sheet.id} sheet={sheet} />
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function NotFound() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Workbook not found</h1>
      <Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">
        Quay lại workbooks
      </Link>
    </section>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p>{message}</p>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold"
      >
        Thử lại
      </button>
    </section>
  );
}
