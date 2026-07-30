"use client";

import { useState } from "react";

import { updateSheetPriority, type SheetPriority } from "@/services/api";

type PrioritySelectorProps = {
  sheetId: number;
  priority: SheetPriority;
  onSaved: (priority: SheetPriority) => void;
};

export function PrioritySelector({ sheetId, priority, onSaved }: PrioritySelectorProps) {
  const [selectedPriority, setSelectedPriority] = useState(priority);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(nextPriority: SheetPriority) {
    if (nextPriority === selectedPriority || isSaving) {
      return;
    }

    const previousPriority = selectedPriority;
    setSelectedPriority(nextPriority);
    setIsSaving(true);
    setError(null);
    try {
      const updatedSheet = await updateSheetPriority(String(sheetId), nextPriority);
      onSaved(updatedSheet.priority);
    } catch (caughtError) {
      // Restore the previous display value when persistence fails so the UI
      // never suggests that a priority update was saved when it was not.
      setSelectedPriority(previousPriority);
      setError(caughtError instanceof Error ? caughtError.message : "Không thể lưu priority.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <label htmlFor="sheet-priority" className="text-sm font-medium text-slate-700">
        Priority
      </label>
      <select
        id="sheet-priority"
        value={selectedPriority}
        disabled={isSaving}
        onChange={(event) => void handleChange(event.target.value as SheetPriority)}
        className="mt-2 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      {isSaving && <p className="mt-1 text-xs text-slate-500">Đang lưu…</p>}
      {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
    </div>
  );
}
