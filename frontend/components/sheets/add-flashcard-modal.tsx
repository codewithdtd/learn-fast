"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { ApiRequestError, createFlashcardInSheet, type FlashcardListItem } from "@/services/api";

type AddFlashcardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string | number;
  sheetName?: string;
  onCardCreated: (newCard: FlashcardListItem) => void;
};

const subscribeToNothing = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function AddFlashcardModal({
  isOpen,
  onClose,
  sheetId,
  sheetName,
  onCardCreated,
}: AddFlashcardModalProps) {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMountedSnapshot, getServerMountedSnapshot);

  if (!isOpen || !mounted) {
    return null;
  }

  return (
    <AddFlashcardDialog
      onClose={onClose}
      sheetId={sheetId}
      sheetName={sheetName}
      onCardCreated={onCardCreated}
    />
  );
}

function AddFlashcardDialog({
  onClose,
  sheetId,
  sheetName,
  onCardCreated,
}: Omit<AddFlashcardModalProps, "isOpen">) {
  const [phrase, setPhrase] = useState("");
  const [meaning, setMeaning] = useState("");
  const [exampleEn, setExampleEn] = useState("");
  const [exampleVi, setExampleVi] = useState("");
  const [keepOpen, setKeepOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const phraseInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus the phrase input upon modal open
    setTimeout(() => {
      phraseInputRef.current?.focus();
    }, 50);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) {
        onClose();
      }

      // Focus trap
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanPhrase = phrase.trim();
    const cleanMeaning = meaning.trim();

    if (!cleanPhrase) {
      setError("Please enter the English phrase or word.");
      phraseInputRef.current?.focus();
      return;
    }
    if (!cleanMeaning) {
      setError("Please enter the Vietnamese meaning.");
      return;
    }

    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    try {
      const newCard = await createFlashcardInSheet(String(sheetId), {
        phrase: cleanPhrase,
        meaning: cleanMeaning,
        example_en: exampleEn.trim() || undefined,
        example_vi: exampleVi.trim() || undefined,
      });

      onCardCreated(newCard);

      if (keepOpen) {
        setPhrase("");
        setMeaning("");
        setExampleEn("");
        setExampleVi("");
        setSuccessNotice(`Added "${newCard.phrase}" successfully!`);
        phraseInputRef.current?.focus();
      } else {
        onClose();
      }
    } catch (caughtError: unknown) {
      if (caughtError instanceof ApiRequestError) {
        if (caughtError.status === 409) {
          setError("This word or phrase already exists in this sheet.");
        } else if (caughtError.status === 403) {
          setError("You do not have permission to add words to this sheet.");
        } else {
          setError(caughtError.message || "Failed to create flashcard.");
        }
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-card-dialog-title"
        className="w-full max-w-lg rounded-2xl sm:rounded-3xl border-2 border-outline bg-surface p-5 sm:p-7 shadow-xl transition-all"
        style={{
          boxShadow: "0 12px 40px rgba(50, 35, 20, 0.12)",
        }}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 mb-5 pb-3 border-b border-outline/30">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vocabulary Builder</span>
            </div>
            <h2 id="add-card-dialog-title" className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
              Add New Word
            </h2>
            {sheetName && (
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                Into sheet: <strong className="text-foreground">{sheetName}</strong>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-muted hover:text-foreground hover:bg-surface-low transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Notice for Sequential Adds */}
        {successNotice && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-green-700 dark:text-green-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-error/10 border border-error/20 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-error animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Card Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. English Phrase / Word */}
          <div>
            <label htmlFor="card-phrase" className="block text-xs sm:text-sm font-bold text-foreground mb-1.5">
              English Phrase / Word <span className="text-error">*</span>
            </label>
            <input
              id="card-phrase"
              ref={phraseInputRef}
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="e.g. break a leg, serendipity, look forward to"
              maxLength={200}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-outline bg-surface-low px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 2. Vietnamese Meaning */}
          <div>
            <label htmlFor="card-meaning" className="block text-xs sm:text-sm font-bold text-foreground mb-1.5">
              Vietnamese Meaning <span className="text-error">*</span>
            </label>
            <input
              id="card-meaning"
              type="text"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="e.g. chúc may mắn, sự may mắn tình cờ"
              maxLength={600}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-outline bg-surface-low px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 3. Examples Section (Two Columns on Desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="card-example-en" className="block text-xs font-semibold text-muted mb-1">
                English Example (optional)
              </label>
              <textarea
                id="card-example-en"
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                placeholder="e.g. Break a leg on your exam tomorrow!"
                rows={2}
                maxLength={2000}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
            <div>
              <label htmlFor="card-example-vi" className="block text-xs font-semibold text-muted mb-1">
                Vietnamese Translation (optional)
              </label>
              <textarea
                id="card-example-vi"
                value={exampleVi}
                onChange={(e) => setExampleVi(e.target.value)}
                placeholder="e.g. Chúc bạn thi tốt vào ngày mai nhé!"
                rows={2}
                maxLength={2000}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2 text-xs sm:text-sm text-foreground shadow-xs transition-colors placeholder:text-muted/60 focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          {/* 4. Keep Open Checkbox & Actions */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-outline/30">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepOpen}
                onChange={(e) => setKeepOpen(e.target.checked)}
                disabled={isSubmitting}
                className="w-4 h-4 rounded-md border-outline text-primary focus:ring-primary/20"
              />
              <span className="text-xs font-medium text-foreground">
                Add another word after saving
              </span>
            </label>

            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-outline bg-surface-low text-xs sm:text-sm font-semibold text-foreground hover:bg-surface transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !phrase.trim() || !meaning.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-xs sm:text-sm font-bold shadow-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Save Word</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
