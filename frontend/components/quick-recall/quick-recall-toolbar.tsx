"use client";

import { Icon } from "@/components/layout/app-shell";
import type { RecallDirection, RecallFilter } from "@/lib/quick-recall";

type QuickRecallToolbarProps = {
  direction: RecallDirection;
  filter: RecallFilter;
  visibleCardCount: number;
  totalCardCount: number;
  evaluatedCardCount: number;
  canShuffle: boolean;
  hasVisibleCards: boolean;
  onDirectionChange: (direction: RecallDirection) => void;
  onFilterChange: (filter: RecallFilter) => void;
  onRevealAll: () => void;
  onHideAll: () => void;
  onShuffle: () => void;
};

const directionOptions: Array<{ value: RecallDirection; label: string }> = [
  { value: "en_to_vi", label: "EN → VI" },
  { value: "vi_to_en", label: "VI → EN" },
];

const filterOptions: Array<{ value: RecallFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "weak", label: "Weak" },
  { value: "bookmarked", label: "Bookmarked" },
];

export function QuickRecallToolbar({
  direction,
  filter,
  visibleCardCount,
  totalCardCount,
  evaluatedCardCount,
  canShuffle,
  hasVisibleCards,
  onDirectionChange,
  onFilterChange,
  onRevealAll,
  onHideAll,
  onShuffle,
}: QuickRecallToolbarProps) {
  const progress = totalCardCount === 0 ? 0 : (evaluatedCardCount / totalCardCount) * 100;

  return (
    <section className="quick-recall-toolbar" aria-label="Quick Recall controls">
      <div className="quick-recall-toolbar-top">
        <div className="quick-recall-direction" aria-label="Recall direction">
          {directionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={direction === option.value}
              className={direction === option.value ? "is-active" : undefined}
              onClick={() => onDirectionChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="quick-recall-filters" aria-label="Card filter">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              className={filter === option.value ? "is-active" : undefined}
              onClick={() => onFilterChange(option.value)}
            >
              {option.value === "bookmarked" && <Icon name="bookmark" size={16} />}
              {option.label}
            </button>
          ))}
        </div>

        <button type="button" className="quick-recall-shuffle" disabled={!canShuffle} onClick={onShuffle}>
          <Icon name="refresh" size={18} /> Shuffle
        </button>
      </div>

      <div className="quick-recall-progress-card">
        <div className="quick-recall-progress-copy">
          <span>Recall progress</span>
          <strong>{evaluatedCardCount} / {totalCardCount} evaluated</strong>
        </div>
        <div className="quick-recall-progress-track" aria-label={`${evaluatedCardCount} of ${totalCardCount} cards evaluated`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="quick-recall-bulk-actions">
          <span>{visibleCardCount} shown</span>
          <button type="button" disabled={!hasVisibleCards} onClick={onRevealAll}><Icon name="eye" size={18} /> Reveal all</button>
          <button type="button" disabled={!hasVisibleCards} onClick={onHideAll}>Hide all</button>
        </div>
      </div>
    </section>
  );
}
