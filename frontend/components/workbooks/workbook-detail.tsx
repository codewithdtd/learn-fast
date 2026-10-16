"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { useAuth } from "@/context/auth-context";
import { InlineNameEditor } from "@/components/shared/inline-name-editor";
import { SheetListItem } from "@/components/sheets/sheet-list-item";
import { formatDate } from "@/lib/format";
import {
  ApiRequestError,
  getWorkbook,
  getWorkbooks,
  moveSheetsToWorkbook,
  updateSheetName,
  updateWorkbookName,
  type SheetSummary,
  type WorkbookDetail,
  type WorkbookListItem,
} from "@/services/api";

type WorkbookDetailProps = {
  workbookId: string;
};

export function WorkbookDetailView({ workbookId }: WorkbookDetailProps) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.is_superuser === true;
  const [workbook, setWorkbook] = useState<WorkbookDetail | null>(null);
  const [availableWorkbooks, setAvailableWorkbooks] = useState<WorkbookListItem[]>([]);
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
        setError(caughtError instanceof Error ? caughtError.message : "Could not load this workbook.");
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
            : "Could not load this workbook.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [workbookId]);

  useEffect(() => {
    if (!isAdmin) return;
    void getWorkbooks().then(setAvailableWorkbooks).catch(() => setAvailableWorkbooks([]));
  }, [isAdmin]);

  if (isLoading) return <WorkbookDetailLoading />;
  if (notFound) return <NotFound />;
  if (error) return <RetryError message={error} onRetry={loadWorkbook} />;
  if (!workbook) return null;
  /*
    return <p className="text-slate-600">Loading workbook…</p>;
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

  */
  const loadedWorkbook = workbook;
  return (
    <WorkbookDetailContent
      key={workbookId}
      workbook={loadedWorkbook}
      isAdmin={isAdmin}
      availableWorkbooks={availableWorkbooks}
      onWorkbookRenamed={async (name) => {
        setWorkbook(await updateWorkbookName(workbookId, name));
      }}
      onSheetRenamed={async (sheetId, name) => {
        await updateSheetName(String(sheetId), name);
        setWorkbook(await getWorkbook(workbookId));
      }}
      onSheetsMoved={async () => {
        setWorkbook(await getWorkbook(workbookId));
        setAvailableWorkbooks(await getWorkbooks());
      }}
    />
  );
  /*
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
  */
}

type WorkbookSummary = {
  startedSheets: number;
  learnedSheets: number;
  dueSheets: SheetSummary[];
  progress: number;
};

function WorkbookDetailContent({
  workbook,
  isAdmin,
  availableWorkbooks,
  onWorkbookRenamed,
  onSheetRenamed,
  onSheetsMoved,
}: {
  workbook: WorkbookDetail;
  isAdmin: boolean;
  availableWorkbooks: WorkbookListItem[];
  onWorkbookRenamed: (name: string) => Promise<void>;
  onSheetRenamed: (sheetId: number, name: string) => Promise<void>;
  onSheetsMoved: () => Promise<void>;
}) {
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<number>>(new Set());
  const [targetWorkbookId, setTargetWorkbookId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [managementNotice, setManagementNotice] = useState<string | null>(null);
  const summary = getWorkbookSummary(workbook.sheets);
  const targetWorkbooks = availableWorkbooks.filter((item) => item.id !== workbook.id);

  function toggleSheet(sheetId: number) {
    setSelectedSheetIds((current) => {
      const next = new Set(current);
      if (next.has(sheetId)) next.delete(sheetId);
      else next.add(sheetId);
      return next;
    });
  }

  async function moveSelectedSheets() {
    if (!targetWorkbookId || selectedSheetIds.size === 0 || isMoving) return;
    setIsMoving(true);
    setManagementError(null);
    setManagementNotice(null);
    try {
      const result = await moveSheetsToWorkbook(
        workbook.id,
        Number(targetWorkbookId),
        Array.from(selectedSheetIds),
      );
      const target = targetWorkbooks.find((item) => item.id === result.target_workbook_id);
      setSelectedSheetIds(new Set());
      await onSheetsMoved();
      setManagementNotice(`${result.moved_count} sheet${result.moved_count === 1 ? "" : "s"} moved to ${target?.name ?? "the selected workbook"}.`);
    } catch (caughtError) {
      setManagementError(caughtError instanceof Error ? caughtError.message : "Sheets could not be moved.");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <section className="workbook-detail-content">
      <header className="workbook-detail-header">
        <div className="workbook-detail-heading">
          <nav className="workbook-breadcrumb" aria-label="Breadcrumb">
            <Link href="/workbooks">Workbooks</Link>
            <Icon name="arrow" size={15} />
            <span aria-current="page">{workbook.name}</span>
          </nav>
          <div className="workbook-detail-title-row">
            <h1>{workbook.name}</h1>
            <InlineNameEditor value={workbook.name} label="workbook name" onSave={onWorkbookRenamed} />
          </div>
          <div className="workbook-detail-meta">
            <span><Icon name="calendar" size={17} /> Imported {formatDate(workbook.imported_at)}</span>
            <span><Icon name="books" size={17} /> {workbook.original_filename}</span>
            <span>{workbook.sheet_count} sheets</span>
            <span>{workbook.total_cards} total cards</span>
          </div>
        </div>
        <Link href="/workbooks" className="button secondary workbook-back-button">
          Back to workbooks
        </Link>
      </header>

      <WorkbookSnapshot workbook={workbook} summary={summary} />

      <section className="workbook-sheets-section" aria-labelledby="workbook-sheets-heading">
        <div className="workbook-section-heading">
          <div>
            <p className="eyebrow">Workbook contents</p>
            <h2 id="workbook-sheets-heading">Sheets</h2>
          </div>
          <span className="workbook-section-count">{workbook.sheets.length}</span>
        </div>

        {isAdmin && workbook.sheets.length > 0 && (
          <div className="workbook-sheet-manager" aria-label="Manage workbook sheets">
            <div>
              <strong>Organize sheets</strong>
              <p>Select sheets, then move them together into another workbook.</p>
            </div>
            <div className="workbook-sheet-manager-actions">
              <label>
                <span className="sr-only">Destination workbook</span>
                <select
                  value={targetWorkbookId}
                  onChange={(event) => setTargetWorkbookId(event.target.value)}
                  disabled={isMoving || targetWorkbooks.length === 0}
                >
                  <option value="">Choose a workbook</option>
                  {targetWorkbooks.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="button primary"
                onClick={() => void moveSelectedSheets()}
                disabled={isMoving || !targetWorkbookId || selectedSheetIds.size === 0}
              >
                {isMoving ? "Moving…" : `Move ${selectedSheetIds.size || "selected"} sheet${selectedSheetIds.size === 1 ? "" : "s"}`}
              </button>
            </div>
            {targetWorkbooks.length === 0 && <p className="workbook-manager-hint">Create or import another workbook before moving sheets.</p>}
            {managementError && <p className="workbook-manager-error" role="alert">{managementError}</p>}
            {managementNotice && <p className="workbook-manager-notice" role="status">{managementNotice}</p>}
          </div>
        )}

        {workbook.sheets.length > 0 ? (
          <ul className="workbook-sheet-list">
            {workbook.sheets.map((sheet) => (
              <SheetListItem
                key={sheet.id}
                sheet={sheet}
                management={isAdmin ? {
                  isSelected: selectedSheetIds.has(sheet.id),
                  onToggle: toggleSheet,
                  onRename: (name) => onSheetRenamed(sheet.id, name),
                } : undefined}
              />
            ))}
          </ul>
        ) : (
          <EmptySheets />
        )}
      </section>

      {summary.dueSheets.length > 0 && (
        <DueReviewCallout sheet={summary.dueSheets[0]} dueSheetCount={summary.dueSheets.length} />
      )}
    </section>
  );
}

function getWorkbookSummary(sheets: SheetSummary[]): WorkbookSummary {
  const startedSheets = sheets.filter((sheet) => sheet.status !== "not_started").length;
  const learnedSheets = sheets.filter((sheet) => sheet.status === "learned").length;
  const dueSheets = sheets.filter((sheet) => sheet.status === "due");

  return {
    startedSheets,
    learnedSheets,
    dueSheets,
    progress: sheets.length === 0 ? 0 : Math.round((startedSheets / sheets.length) * 100),
  };
}

function WorkbookSnapshot({
  workbook,
  summary,
}: {
  workbook: WorkbookDetail;
  summary: WorkbookSummary;
}) {
  return (
    <section className="workbook-snapshot" aria-labelledby="workbook-snapshot-heading">
      <div className="workbook-snapshot-topline">
        <div>
          <p className="workbook-card-label" id="workbook-snapshot-heading">Study coverage</p>
          <h2>{summary.progress}% of sheets started</h2>
        </div>
        <span className="workbook-progress-value" aria-label={`${summary.progress}% of sheets started`}>
          {summary.progress}%
        </span>
      </div>
      <div
        className="workbook-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.progress}
        aria-label="Sheets started"
      >
        <span style={{ width: `${summary.progress}%` }} />
      </div>
      <div className="workbook-snapshot-details">
        <span>{summary.startedSheets} of {workbook.sheets.length} sheets started</span>
        <span>{workbook.total_cards} total cards</span>
      </div>
      <dl className="workbook-snapshot-stats">
        <div>
          <dt>Learned sheets</dt>
          <dd>{summary.learnedSheets}</dd>
        </div>
        <div>
          <dt>Due sheets</dt>
          <dd>{summary.dueSheets.length}</dd>
        </div>
      </dl>
    </section>
  );
}

function DueReviewCallout({ sheet, dueSheetCount }: { sheet: SheetSummary; dueSheetCount: number }) {
  return (
    <section className="workbook-review-callout">
      <span className="workbook-review-icon"><Icon name="review" size={27} /></span>
      <div>
        <h2>Ready for a review?</h2>
        <p>{dueSheetCount} {dueSheetCount === 1 ? "sheet is" : "sheets are"} due in this workbook.</p>
      </div>
      <Link href={`/sheets/${sheet.id}/study?mode=review`} className="button primary">
        Review due sheet <Icon name="arrow" size={18} />
      </Link>
    </section>
  );
}

function EmptySheets() {
  return (
    <div className="workbook-empty-state">
      <span className="workbook-empty-icon"><Icon name="books" size={27} /></span>
      <div>
        <h3>No sheets in this workbook</h3>
        <p>The workbook was loaded successfully, but it does not contain any sheets to study yet.</p>
      </div>
      <Link href="/import" className="button secondary">Import another workbook</Link>
    </div>
  );
}

function WorkbookDetailLoading() {
  return (
    <div className="workbook-detail-skeleton" aria-label="Loading workbook">
      <span className="workbook-detail-skeleton-heading" />
      <span className="workbook-detail-skeleton-summary" />
      <span />
      <span />
      <span />
    </div>
  );
}

function NotFound() {
  return (
    <section className="workbook-state-card">
      <h1 className="text-xl font-semibold">Workbook not found</h1>
      <Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">
        Back to workbooks
      </Link>
    </section>
  );
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <section role="alert" className="workbook-state-card workbook-error-card">
      <p>{message}</p>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="button secondary"
      >
        Try again
      </button>
    </section>
  );
}
