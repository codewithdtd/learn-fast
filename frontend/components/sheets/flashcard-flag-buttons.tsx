"use client";

import { useState } from "react";

type FlashcardFlagButtonsProps = {
  isWeak: boolean;
  isBookmarked: boolean;
  onWeakChange: (nextValue: boolean) => Promise<void>;
  onBookmarkChange: (nextValue: boolean) => Promise<void>;
};

export function FlashcardFlagButtons({
  isWeak,
  isBookmarked,
  onWeakChange,
  onBookmarkChange,
}: FlashcardFlagButtonsProps) {
  const [pendingFlag, setPendingFlag] = useState<"weak" | "bookmark" | null>(null);

  async function changeFlag(
    flag: "weak" | "bookmark",
    persistChange: () => Promise<void>,
  ) {
    if (pendingFlag) return;

    setPendingFlag(flag);
    try {
      await persistChange();
    } catch {
      // The table owns rollback and the visible error message. Swallow here so
      // the click handler does not create an unhandled browser rejection.
    } finally {
      setPendingFlag(null);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={isWeak}
        disabled={pendingFlag !== null}
        onClick={() => void changeFlag("weak", () => onWeakChange(!isWeak))}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
          isWeak
            ? "bg-amber-200 text-amber-950 hover:bg-amber-300"
            : "border border-amber-300 text-amber-800 hover:bg-amber-50"
        }`}
      >
        {pendingFlag === "weak" ? "Saving…" : isWeak ? "Weak" : "Mark weak"}
      </button>
      <button
        type="button"
        aria-pressed={isBookmarked}
        disabled={pendingFlag !== null}
        onClick={() => void changeFlag("bookmark", () => onBookmarkChange(!isBookmarked))}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
          isBookmarked
            ? "bg-sky-200 text-sky-950 hover:bg-sky-300"
            : "border border-sky-300 text-sky-800 hover:bg-sky-50"
        }`}
      >
        {pendingFlag === "bookmark"
          ? "Saving…"
          : isBookmarked
            ? "Bookmarked"
            : "Bookmark"}
      </button>
    </div>
  );
}
