"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";

type InlineNameEditorProps = {
  value: string;
  label: string;
  onSave: (name: string) => Promise<void>;
};

const MAX_NAME_LENGTH = 255;

export function InlineNameEditor({ value, label, onSave }: InlineNameEditorProps) {
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = isAuthenticated && user?.is_superuser === true;

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function startEditing() {
    if (!isAdmin) {
      setPermissionAlert("Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa tên.");
      setTimeout(() => setPermissionAlert(null), 4000);
      return;
    }
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
      <div className="inline-name-trigger-wrapper">
        <button
          type="button"
          className="inline-name-edit-trigger"
          onClick={startEditing}
          aria-label={`Edit ${label}`}
        >
          Rename
        </button>
        {permissionAlert && (
          <span className="admin-inline-alert" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {permissionAlert}
          </span>
        )}
      </div>
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
