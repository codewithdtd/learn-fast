"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WorkbookCard } from "@/components/workbooks/workbook-card";
import { getWorkbooks, type WorkbookListItem } from "@/services/api";

export function WorkbookList() {
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkbooks() {
    setIsLoading(true);
    setError(null);
    try {
      setWorkbooks(await getWorkbooks());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load your workbooks.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    void getWorkbooks()
      .then((loadedWorkbooks) => {
        if (isCurrent) setWorkbooks(loadedWorkbooks);
      })
      .catch((caughtError: unknown) => {
        if (isCurrent) {
          setError(caughtError instanceof Error ? caughtError.message : "Could not load your workbooks.");
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredWorkbooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return workbooks;

    return workbooks.filter((workbook) =>
      `${workbook.name} ${workbook.original_filename}`.toLowerCase().includes(normalizedSearch),
    );
  }, [search, workbooks]);

  if (isLoading) return <WorkbookLoading />;
  if (error) return <WorkbookError message={error} onRetry={loadWorkbooks} />;
  if (workbooks.length === 0) return <WorkbookEmpty />;

  return (
    <section className="library-content" aria-label="Workbook library">
      <div className="library-toolbar">
        <label className="library-search">
          <span className="sr-only">Search workbooks</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workbooks..."
            type="search"
          />
        </label>
        <span className="library-count">
          {filteredWorkbooks.length} {filteredWorkbooks.length === 1 ? "workbook" : "workbooks"}
        </span>
      </div>

      {filteredWorkbooks.length === 0 ? (
        <p className="library-no-results">No workbooks match “{search}”.</p>
      ) : (
        <div className="workbook-grid">
          {filteredWorkbooks.map((workbook) => (
            <WorkbookCard key={workbook.id} workbook={workbook} onDeleted={loadWorkbooks} />
          ))}
        </div>
      )}
    </section>
  );
}

function WorkbookLoading() {
  return <div className="workbook-loading" aria-label="Loading workbooks"><span /><span /><span /></div>;
}

function WorkbookError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="library-error">
      <p>{message}</p>
      <button type="button" className="library-button library-button-secondary" onClick={() => void onRetry()}>
        Try again
      </button>
    </section>
  );
}

function WorkbookEmpty() {
  return (
    <section className="library-empty">
      <div className="library-empty-icon">+</div>
      <h2>No workbooks yet</h2>
      <p>Import an Excel workbook to start building your vocabulary library.</p>
      <Link href="/import" className="library-button library-button-primary">Import workbook</Link>
    </section>
  );
}
