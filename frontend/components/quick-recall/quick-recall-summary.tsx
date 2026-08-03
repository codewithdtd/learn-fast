import Link from "next/link";

import { Icon } from "@/components/layout/app-shell";
import type { QuickRecallCompletion } from "@/services/api";

type QuickRecallSummaryProps = { totalCards: number; rememberedCount: number; needReviewCount: number; completion: QuickRecallCompletion | null; isFinishing: boolean; isFinishLocked: boolean; finishError: string | null; onFinish: () => void; sheetId: number };

export function QuickRecallSummary({ totalCards, rememberedCount, needReviewCount, completion, isFinishing, isFinishLocked, finishError, onFinish, sheetId }: QuickRecallSummaryProps) {
  const evaluatedCount = rememberedCount + needReviewCount;
  const recallPercentage = totalCards === 0 ? 0 : Math.round((rememberedCount / totalCards) * 10000) / 100;
  const isComplete = evaluatedCount === totalCards && totalCards > 0;

  if (completion) return <section aria-live="polite" className="quick-recall-completion"><div><p className="eyebrow">Session saved</p><h2>Quick Recall completed</h2><p>{completion.remembered_count} remembered and {completion.need_review_count} marked for review ({completion.recall_percentage}%).</p></div><Link href={`/sheets/${sheetId}/table`} className="quick-recall-link-button">Open Table View <Icon name="arrow" size={18} /></Link></section>;

  return <section aria-live="polite" className="quick-recall-summary">
    <div><p className="eyebrow">Session summary</p><h2>Finish when every card is evaluated</h2></div>
    <dl className="quick-recall-stats"><Stat label="Remembered" value={String(rememberedCount)} /><Stat label="Need review" value={String(needReviewCount)} /><Stat label="Remaining" value={String(totalCards - evaluatedCount)} /><Stat label="Recall" value={`${recallPercentage}%`} /></dl>
    <div className="quick-recall-finish-row"><button type="button" disabled={!isComplete || isFinishing || isFinishLocked} onClick={onFinish}>{isFinishing ? "Saving…" : "Finish Quick Recall"}<Icon name="arrow" size={18} /></button>{!isComplete && <p>{evaluatedCount} of {totalCards} cards evaluated.</p>}</div>
    {finishError && <p role="alert" className="quick-recall-error">{finishError}</p>}
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
