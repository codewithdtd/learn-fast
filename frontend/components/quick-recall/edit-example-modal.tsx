"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { updateFlashcardContent, type FlashcardListItem } from "@/services/api";

type EditExampleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  card: {
    id: number;
    phrase: string;
    meaning: string;
    example_en?: string | null;
    example_vi?: string | null;
  };
  onSaved: (updatedCard: FlashcardListItem) => void;
};

const subscribeToNothing = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function EditExampleModal({
  isOpen,
  onClose,
  card,
  onSaved,
}: EditExampleModalProps) {
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMountedSnapshot, getServerMountedSnapshot);

  if (!isOpen || !mounted) {
    return null;
  }

  return (
    <EditExampleDialog
      onClose={onClose}
      card={card}
      onSaved={onSaved}
    />
  );
}

function EditExampleDialog({
  onClose,
  card,
  onSaved,
}: Omit<EditExampleModalProps, "isOpen">) {
  const [exampleEn, setExampleEn] = useState(card.example_en ?? "");
  const [exampleVi, setExampleVi] = useState(card.example_vi ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const exampleEnInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus vào textarea ví dụ tiếng Anh khi mở modal
  useEffect(() => {
    const timer = setTimeout(() => {
      exampleEnInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Xử lý phím Escape để đóng modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const cleanExampleEn = exampleEn.trim() || null;
    const cleanExampleVi = exampleVi.trim() || null;

    try {
      // Cập nhật câu ví dụ (Anh & Việt) qua API backend
      const updated = await updateFlashcardContent(String(card.id), {
        phrase: card.phrase,
        meaning: card.meaning,
        example_en: cleanExampleEn,
        example_vi: cleanExampleVi,
      });

      onSaved(updated);
      onClose();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save example sentences. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-example-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-outline bg-surface p-6 shadow-2xl transition-all space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-example-title" className="text-lg font-bold text-foreground">
                Edit Example Sentence
              </h2>
              <p className="text-xs text-muted">
                Update the English example and Vietnamese translation for this card
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Flashcard reference info */}
        <div className="rounded-xl border border-outline/50 bg-surface-hover/50 p-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted uppercase text-[10px]">Vocabulary Phrase:</span>
            <strong className="text-sm font-bold text-foreground">{card.phrase}</strong>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted uppercase text-[10px]">Meaning:</span>
            <span className="text-foreground/80">{card.meaning}</span>
          </div>
        </div>

        {/* Form nhập liệu */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* English example input */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-example-en"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span>English Example (EN)</span>
              <span className="text-[10px] text-muted font-normal">Optional</span>
            </label>
            <textarea
              ref={exampleEnInputRef}
              id="edit-example-en"
              rows={3}
              value={exampleEn}
              onChange={(e) => setExampleEn(e.target.value)}
              placeholder="e.g. We look forward to meeting you soon."
              maxLength={2000}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 resize-y"
            />
          </div>

          {/* Vietnamese translation input */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-example-vi"
              className="text-xs font-semibold text-foreground flex items-center justify-between"
            >
              <span>Vietnamese Translation (VI)</span>
              <span className="text-[10px] text-muted font-normal">Optional</span>
            </label>
            <textarea
              id="edit-example-vi"
              rows={3}
              value={exampleVi}
              onChange={(e) => setExampleVi(e.target.value)}
              placeholder="e.g. Chúng tôi rất mong sớm được gặp bạn."
              maxLength={2000}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-outline bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 resize-y"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-outline px-4 py-2 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
