"use client";

import { useState } from "react";

import { deleteWorkbook } from "@/services/api";

type DeleteWorkbookButtonProps = {
  workbookId: number;
  workbookName: string;
  onDeleted: () => Promise<void>;
};

export function DeleteWorkbookButton({
  workbookId,
  workbookName,
  onDeleted,
}: DeleteWorkbookButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const shouldDelete = window.confirm(
      `Delete "${workbookName}"? This permanently removes its sheets, flashcards, and study sessions.`,
    );
    if (!shouldDelete || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await deleteWorkbook(String(workbookId));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete this workbook.");
      setIsDeleting(false);
      return;
    }

    try {
      await onDeleted();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `The workbook was deleted, but the list could not refresh: ${caughtError.message}`
          : "The workbook was deleted, but the list could not refresh. Reload this page.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={isDeleting}
        className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className="mt-1 max-w-48 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
