"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { WorkbookCard } from "@/components/workbooks/workbook-card";
import { getWorkbooks, type WorkbookListItem } from "@/services/api";

export function WorkbookList() {
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkbooks() {
    setIsLoading(true);
    setError(null);
    try {
      setWorkbooks(await getWorkbooks());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể tải workbooks.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    // Fetching resolves asynchronously. Keeping the state updates in promise
    // callbacks avoids a synchronous state update while React mounts.
    void getWorkbooks()
      .then((loadedWorkbooks) => {
        if (isCurrent) setWorkbooks(loadedWorkbooks);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Không thể tải workbooks.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  if (isLoading) {
    return <p className="mt-8 text-slate-600">Đang tải workbooks…</p>;
  }

  if (error) {
    return (
      <section role="alert" className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void loadWorkbooks()}
          className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold hover:bg-rose-100"
        >
          Thử lại
        </button>
      </section>
    );
  }

  if (workbooks.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold">Chưa có workbook nào</h2>
        <p className="mt-2 text-slate-600">Import một file Excel để bắt đầu học.</p>
        <Link
          href="/import"
          className="mt-5 inline-flex rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
        >
          Import workbook
        </Link>
      </section>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {workbooks.map((workbook) => (
        <WorkbookCard key={workbook.id} workbook={workbook} onDeleted={loadWorkbooks} />
      ))}
    </div>
  );
}
