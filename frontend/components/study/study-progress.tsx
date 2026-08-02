type StudyProgressProps = {
  totalCards: number;
  rememberedCards: number;
  remainingCards: number;
  totalAttempts: number;
};

export function StudyProgress({
  totalCards,
  rememberedCards,
  remainingCards,
  totalAttempts,
}: StudyProgressProps) {
  const percentage = totalCards === 0 ? 0 : Math.round((rememberedCards / totalCards) * 100);

  return (
    <section aria-label="Study progress" className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Session progress</h2>
          <p className="mt-1 text-sm text-slate-600">
            {rememberedCards} of {totalCards} cards remembered
          </p>
        </div>
        <p className="text-lg font-semibold text-slate-900">{percentage}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-700 transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="Remaining cards" value={String(remainingCards)} />
        <Stat label="Total attempts" value={String(totalAttempts)} />
      </dl>
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
