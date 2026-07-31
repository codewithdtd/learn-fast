import Link from "next/link";

import type { QuickRecallCompletion } from "@/services/api";

type QuickRecallSummaryProps = {
  totalCards: number;
  rememberedCount: number;
  needReviewCount: number;
  completion: QuickRecallCompletion | null;
  isFinishing: boolean;
  isFinishLocked: boolean;
  finishError: string | null;
  onFinish: () => void;
  sheetId: number;
};

export function QuickRecallSummary({
  totalCards,
  rememberedCount,
  needReviewCount,
  completion,
  isFinishing,
  isFinishLocked,
  finishError,
  onFinish,
  sheetId,
}: QuickRecallSummaryProps) {
  const evaluatedCount = rememberedCount + needReviewCount;
  const recallPercentage =
    totalCards === 0 ? 0 : Math.round((rememberedCount / totalCards) * 10000) / 100;
  const isComplete = evaluatedCount === totalCards && totalCards > 0;

  if (completion) {
    return (
      <section aria-live="polite" className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <h2 className="text-xl font-semibold">Quick Recall completed</h2>
        <p className="mt-2">
          {completion.remembered_count} remembered, {completion.need_review_count} need review
          ({completion.recall_percentage}%). Need Review cards are now available in the Weak filter.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/sheets/${sheetId}/table`}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Open Table View
          </Link>
          <DisabledAction label="Practice Weak Cards" />
          <DisabledAction label="Start Full Flashcard Review" />
        </div>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-semibold">Session summary</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total" value={String(totalCards)} />
        <Stat label="Remembered" value={String(rememberedCount)} />
        <Stat label="Need Review" value={String(needReviewCount)} />
        <Stat label="Not evaluated" value={String(totalCards - evaluatedCount)} />
        <Stat label="Recall" value={`${recallPercentage}%`} />
      </dl>
      <p className="mt-4 text-sm text-slate-600">
        {evaluatedCount} / {totalCards} cards evaluated.
      </p>
      <button
        type="button"
        disabled={!isComplete || isFinishing || isFinishLocked}
        onClick={onFinish}
        className="mt-4 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isFinishing ? "Finishing…" : "Finish Quick Recall"}
      </button>
      {!isComplete && (
        <p className="mt-2 text-sm text-slate-600">
          Select a result for every card before finishing.
        </p>
      )}
      {finishError && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {finishError}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed"
    >
      {label} · Coming in Day 10
    </button>
  );
}
