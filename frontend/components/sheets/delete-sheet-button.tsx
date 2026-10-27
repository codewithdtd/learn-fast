"use client";

import { useState } from "react";

import { deleteSheet } from "@/services/api";

type DeleteSheetButtonProps = {
  sheetId: number;
  sheetName: string;
  onDeleted: () => Promise<void>;
};

export function DeleteSheetButton({ sheetId, sheetName, onDeleted }: DeleteSheetButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteSheet(sheetId);
      await onDeleted();
      setIsConfirming(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete this sheet.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="delete-sheet-control">
      {isConfirming ? (
        <div className="delete-sheet-confirm" role="group" aria-label={`Confirm deleting ${sheetName}`}>
          <span>Delete this sheet, its flashcards, and study sessions?</span>
          <button type="button" className="delete-sheet-confirm-action" onClick={() => void confirmDelete()} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Confirm delete"}
          </button>
          <button type="button" className="delete-sheet-cancel" onClick={() => setIsConfirming(false)} disabled={isDeleting}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="delete-sheet-trigger" onClick={() => { setError(null); setIsConfirming(true); }}>
          Delete sheet
        </button>
      )}
      {error && <p role="alert" className="delete-sheet-error">{error}</p>}
    </div>
  );
}
