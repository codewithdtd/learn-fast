"use client";

import { useMemo, useState } from "react";
import type { WritingFeedback, WritingIssue } from "@/types/writing";
import { splitAnnotatedText } from "@/lib/writing-feedback";
import { WritingErrorDetails } from "./writing-error-details";
import { WritingErrorTable } from "./writing-error-table";
import styles from "./writing.module.css";

const criteria = [
  ["task_response", "Task response"],
  ["coherence", "Organisation"],
  ["vocabulary", "Vocabulary"],
  ["grammar", "Grammar"],
] as const;

export function WritingFeedbackView({ feedback, sourceText, sentence = false }: { feedback: WritingFeedback; sourceText: string; sentence?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCorrected, setShowCorrected] = useState(false);
  const segments = useMemo(() => splitAnnotatedText(sourceText, feedback), [feedback, sourceText]);
  const selectedIssue: WritingIssue | null = feedback.issues.find((issue) => issue.id === selectedId) ?? null;

  return (
    <section className={styles.feedbackSection} aria-labelledby="feedback-title">
      <div className={styles.resultHeader}>
        <div><p className={styles.eyebrow}>{sentence ? "SENTENCE REVIEW" : "WRITING REVIEW"}</p><h2 id="feedback-title" tabIndex={-1}>Your feedback</h2><p>{feedback.summary_en}</p><p lang="vi">{feedback.summary_vi}</p></div>
        <div className={styles.scoreCard}><span>Practice score</span><strong>{feedback.practice_score}<small>/10</small></strong><span>{sentence ? "Language practice feedback" : "Not an official IELTS band score"}</span></div>
      </div>
      <div className={styles.criteriaGrid}>{criteria.map(([key, label]) => { const item = feedback[key]; const title = sentence ? ({ task_response: "Task and target expression", coherence: "Clarity", vocabulary: "Word use", grammar: "Grammar" } as const)[key] : label; return <article className={styles.criterionCard} key={key}><div><strong>{title}</strong><b>{item.score.toFixed(1)}<small>/10</small></b></div><p>{item.explanation_en}</p><p lang="vi">{item.explanation_vi}</p></article>; })}</div>
      <div className={styles.resultColumns}>
        <div className={styles.card}>
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>INLINE REVIEW</p><h3>What is working and what to improve</h3></div>
            <div className={styles.tabs} role="group" aria-label="Writing display"><button className={!showCorrected ? styles.activeTab : styles.tab} onClick={() => setShowCorrected(false)}>Annotated original</button><button className={showCorrected ? styles.activeTab : styles.tab} onClick={() => setShowCorrected(true)}>Corrected version</button></div>
          </div>
          {showCorrected ? <p className={styles.correctedText}>{feedback.corrected_text}</p> : <p className={styles.annotatedText} aria-label="Annotated original writing">{segments.map((segment) => {
            if (segment.kind === "text") return <span key={segment.key}>{segment.text}</span>;
            if (segment.kind === "strength") return <mark key={segment.key} className={styles.strengthMark} title={segment.strength.note_en}>{segment.text}</mark>;
            if (segment.kind === "insertion") return <button key={segment.key} className={styles.insertionMark} onClick={() => setSelectedId(segment.issue.id)} aria-label={`Open ${segment.issue.id}, suggested insertion`}>＋<sup>{segment.issue.id}</sup></button>;
            return <button key={segment.key} className={segment.issue.kind === "error" ? styles.errorMark : styles.suggestionMark} onClick={() => setSelectedId(segment.issue.id)} aria-pressed={selectedId === segment.issue.id} title={`${segment.issue.id}: ${segment.issue.kind}`}>{segment.issue.kind === "error" ? <><s>{segment.text}</s>{segment.issue.operation === "replace" && segment.issue.replacement && <span className={styles.inlineCorrection}> → {segment.issue.replacement}</span>}</> : segment.text}<sup>{segment.issue.id}</sup></button>;
          })}</p>}
          <div className={styles.legend}><span><i className={styles.legendGreen} /> Strength</span><span><i className={styles.legendRed} /> Error</span><span><i className={styles.legendAmber} /> Suggestion</span></div>
        </div>
        <WritingErrorDetails issue={selectedIssue} />
      </div>
      <section className={styles.card}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>LEARN FROM EACH CHANGE</p><h3>Correction table</h3></div><span className={styles.countBadge}>{feedback.issues.length} items</span></div><WritingErrorTable issues={feedback.issues} selectedId={selectedId} onSelect={setSelectedId} /></section>
      {feedback.strengths.length > 0 && <section className={styles.card}><p className={styles.eyebrow}>KEEP DOING THIS</p><h3>Your strengths</h3><ul className={styles.strengthList}>{feedback.strengths.map((strength, index) => <li key={`${strength.start}-${index}`}><strong>&ldquo;{strength.quote}&rdquo;</strong><span>{strength.note_en}</span><span lang="vi">{strength.note_vi}</span></li>)}</ul></section>}
      <section className={styles.nextSteps}><p className={styles.eyebrow}>NEXT PRACTICE</p><h3>One step at a time</h3><ul>{feedback.next_steps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ul></section>
    </section>
  );
}
