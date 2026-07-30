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
    if (!window.confirm(`Xóa workbook "${workbookName}" và toàn bộ card trong đó?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteWorkbook(String(workbookId));
      await onDeleted();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể xóa workbook.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "Đang xóa…" : "Xóa"}
      </button>
      {error && <p className="mt-1 max-w-48 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
