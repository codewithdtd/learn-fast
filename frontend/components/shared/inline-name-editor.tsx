"use client";

import { useEffect, useRef, useState } from "react";

type InlineNameEditorProps = {
  value: string;
  label: string;
  onSave: (name: string) => Promise<void>;
};

const MAX_NAME_LENGTH = 255;

export function InlineNameEditor({ value, label, onSave }: InlineNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEditing() {
    setDraft(value);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    if (isSaving) return;
    setDraft(value);
    setError(null);
    setIsEditing(false);
  }

  async function saveName() {
    const normalizedName = draft.trim();
    if (!normalizedName) {
      setError("Name cannot be empty.");
      return;
    }
    if (normalizedName.length > MAX_NAME_LENGTH) {
      setError(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Keep the title unchanged until the API confirms persistence, so a
      // failed request never leaves the page showing data that was not saved.
      await onSave(normalizedName);
      setIsEditing(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save this name.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        className="inline-name-edit-trigger"
        onClick={startEditing}
        aria-label={`Edit ${label}`}
      >
        Rename
      </button>
    );
  }

  return (
    <div className="inline-name-editor" role="group" aria-label={`Edit ${label}`}>
      <label className="sr-only" htmlFor={`inline-name-${label.toLowerCase().replaceAll(" ", "-")}`}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={`inline-name-${label.toLowerCase().replaceAll(" ", "-")}`}
        className="inline-name-input"
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        disabled={isSaving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void saveName();
          if (event.key === "Escape") cancelEditing();
        }}
        aria-invalid={Boolean(error)}
      />
      <button type="button" className="button primary inline-name-save" onClick={() => void saveName()} disabled={isSaving}>
        {isSaving ? "Saving…" : "Save"}
      </button>
      <button type="button" className="button secondary inline-name-cancel" onClick={cancelEditing} disabled={isSaving}>
        Cancel
      </button>
      {error && <p className="inline-name-error" role="alert">{error}</p>}
    </div>
  );
}
