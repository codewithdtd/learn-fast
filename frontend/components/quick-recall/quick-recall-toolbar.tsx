"use client";

import type { RecallDirection, RecallFilter } from "@/lib/quick-recall";

type QuickRecallToolbarProps = {
  direction: RecallDirection;
  filter: RecallFilter;
  visibleCardCount: number;
  totalCardCount: number;
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
  canShuffle,
  hasVisibleCards,
  onDirectionChange,
  onFilterChange,
  onRevealAll,
  onHideAll,
  onShuffle,
}: QuickRecallToolbarProps) {
  return (
    <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {visibleCardCount} / {totalCardCount} cards
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasVisibleCards}
            onClick={onRevealAll}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal all
          </button>
          <button
            type="button"
            disabled={!hasVisibleCards}
            onClick={onHideAll}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hide all
          </button>
          <button
            type="button"
            disabled={!canShuffle}
            onClick={onShuffle}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Shuffle
          </button>
        </div>
      </div>

      <ControlGroup label="Direction">
        {directionOptions.map((option) => (
          <ToggleButton
            key={option.value}
            isActive={direction === option.value}
            onClick={() => onDirectionChange(option.value)}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ControlGroup>

      <ControlGroup label="Filter">
        {filterOptions.map((option) => (
          <ToggleButton
            key={option.value}
            isActive={filter === option.value}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </ToggleButton>
        ))}
      </ControlGroup>
    </section>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-slate-700">{label}</span>
      {children}
    </div>
  );
}

function ToggleButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-semibold ${
        isActive
          ? "bg-sky-700 text-white"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
