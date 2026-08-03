"use client";

import { useState } from "react";

import { Icon } from "@/components/layout/app-shell";

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
    <div className="flashcard-flag-actions">
      <button
        type="button"
        aria-pressed={isWeak}
        aria-label={isWeak ? "Remove weak flag" : "Mark card as weak"}
        title={isWeak ? "Remove weak flag" : "Mark card as weak"}
        disabled={pendingFlag !== null}
        onClick={() => void changeFlag("weak", () => onWeakChange(!isWeak))}
        className={`flashcard-flag-button weak-flag ${isWeak ? "active" : ""}`}
      >
        <Icon name="flame" size={19} />
        {pendingFlag === "weak" ? "Saving…" : isWeak ? "Weak" : "Mark weak"}
      </button>
      <button
        type="button"
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? "Remove bookmark" : "Bookmark card"}
        title={isBookmarked ? "Remove bookmark" : "Bookmark card"}
        disabled={pendingFlag !== null}
        onClick={() => void changeFlag("bookmark", () => onBookmarkChange(!isBookmarked))}
        className={`flashcard-flag-button bookmark-flag ${isBookmarked ? "active" : ""}`}
      >
        <Icon name="bookmark" size={19} />
        {pendingFlag === "bookmark"
          ? "Saving…"
          : isBookmarked
            ? "Bookmarked"
            : "Bookmark"}
      </button>
    </div>
  );
}
