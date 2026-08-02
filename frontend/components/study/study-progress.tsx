type StudyProgressProps = { totalCards: number; rememberedCards: number; remainingCards: number; queueLength: number; totalAttempts: number };

export function StudyProgress({ totalCards, rememberedCards, remainingCards, queueLength, totalAttempts }: StudyProgressProps) {
  const percentage = totalCards === 0 ? 0 : Math.round((rememberedCards / totalCards) * 100);
  return <section className="study-session-progress" aria-label="Study progress"><div className="study-progress-heading"><div><p className="eyebrow">Session progress</p><strong>{rememberedCards} of {totalCards} remembered</strong></div><b>{percentage}%</b></div><div className="study-progress-track"><span style={{ width: `${percentage}%` }} /></div><dl><Stat label="Remaining" value={String(remainingCards)} /><Stat label="Queue turns" value={String(queueLength)} /><Stat label="Attempts" value={String(totalAttempts)} /></dl></section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
