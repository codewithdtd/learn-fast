type StudyProgressProps = {
  roundNumber: number;
  totalCards: number;
  answeredCards: number;
  rememberedCards: number;
  againCards: number;
};

export function StudyProgress({
  roundNumber,
  totalCards,
  answeredCards,
  rememberedCards,
  againCards,
}: StudyProgressProps) {
  const percentage = totalCards === 0 ? 0 : Math.round((answeredCards / totalCards) * 100);
  return <section className="study-session-progress" aria-label="Round progress">
    <div className="study-progress-heading"><div><p className="eyebrow">Round {roundNumber}</p><strong>{answeredCards} of {totalCards} answered</strong></div><b>{percentage}%</b></div>
    <div className="study-progress-track"><span style={{ width: `${percentage}%` }} /></div>
    <dl><Stat label="Remembered" value={String(rememberedCards)} /><Stat label="Again" value={String(againCards)} /><Stat label="Remaining" value={String(totalCards - answeredCards)} /></dl>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
