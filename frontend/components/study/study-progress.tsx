type StudyProgressProps = {
  roundNumber: number;
  totalCards: number;
  answeredCards: number;
  rememberedCards: number;
  againCards: number;
};

/**
 * Clean, compact progress bar for Zen Study Mode
 * Minimal height, high visibility, zero distraction.
 */
export function StudyProgress({
  roundNumber,
  totalCards,
  answeredCards,
  rememberedCards,
  againCards,
}: StudyProgressProps) {
  const percentage = totalCards === 0 ? 0 : Math.round((answeredCards / totalCards) * 100);

  return (
    <div className="study-session-progress zen-progress" aria-label="Round progress">
      <div className="study-progress-track">
        <span style={{ width: `${percentage}%` }} />
      </div>
      <div className="study-progress-heading">
        <div className="study-progress-left">
          <span className="study-progress-round">Round {roundNumber}</span>
          <span className="study-progress-sep">·</span>
          <span className="study-progress-counts">
            {answeredCards} of {totalCards} answered ({percentage}%)
          </span>
        </div>
        <div className="study-progress-badges">
          <span className="study-progress-stat remembered" title="Remembered cards">
            ✓ {rememberedCards}
          </span>
          <span className="study-progress-stat again" title="Need review cards">
            ↺ {againCards}
          </span>
        </div>
      </div>
    </div>
  );
}
