"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { deleteWorkbook } from "@/services/api";

type DeleteWorkbookButtonProps = { workbookId: number; workbookName: string; onDeleted: () => Promise<void> };

export function DeleteWorkbookButton({ workbookId, workbookName, onDeleted }: DeleteWorkbookButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function trapFocus(event: KeyboardEvent) {
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href]");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) setIsOpen(false);
      if (event.key === "Tab") trapFocus(event);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen, isDeleting]);

  function openDialog() { if (isDeleting) return; setError(null); setIsOpen(true); }
  function closeDialog() { if (!isDeleting) setIsOpen(false); }

  async function confirmDelete() {
    if (isDeleting) return;
    setIsDeleting(true); setError(null);
    try {
      await deleteWorkbook(String(workbookId));
      try {
        await onDeleted();
        setIsOpen(false);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? `The workbook was deleted, but the list could not refresh: ${caughtError.message}` : "The workbook was deleted, but the list could not refresh. Reload this page.");
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete this workbook.");
    } finally { setIsDeleting(false); }
  }

  return <div className="delete-workbook-control">
    <button ref={triggerRef} type="button" className="delete-trigger" onClick={openDialog} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete"}</button>
    {error && !isOpen && <p role="alert" className="delete-trigger-error">{error}</p>}
    {isOpen && <div className="delete-dialog-backdrop"><div ref={dialogRef} className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-workbook-title" aria-describedby="delete-workbook-description">
      <div className="delete-dialog-handle" aria-hidden="true" />
      <div className="delete-dialog-icon"><Icon name="weak" size={30} /></div>
      <h2 id="delete-workbook-title">Delete workbook?</h2>
      <p id="delete-workbook-description" className="delete-dialog-intro">You are about to delete <strong>{workbookName}</strong>.</p>
      <div className="delete-dialog-warning"><p>This action is permanent and cannot be undone. All data associated with this workbook will be lost:</p><ul><li>All sheets</li><li>All flashcards</li><li>Complete study history and sessions</li></ul></div>
      {error && <p role="alert" className="delete-dialog-error">{error}</p>}
      <div className="delete-dialog-actions"><button ref={cancelRef} type="button" className="delete-cancel" onClick={closeDialog} disabled={isDeleting}>Cancel</button><button type="button" className="delete-confirm" onClick={() => void confirmDelete()} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Delete workbook"}</button></div>
    </div></div>}
  </div>;
}
