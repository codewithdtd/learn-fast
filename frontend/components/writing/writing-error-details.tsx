"use client";

import type { WritingIssue } from "@/types/writing";
import styles from "./writing.module.css";

export function WritingErrorDetails({ issue }: { issue: WritingIssue | null }) {
  if (!issue) return <aside className={styles.detailPanel}><p className={styles.eyebrow}>FEEDBACK GUIDE</p><h3>Select a marked phrase</h3><p>Choose an issue in the paragraph or the table to see why it needs attention and how to improve it.</p></aside>;
  return (
    <aside className={styles.detailPanel} aria-live="polite">
      <div className={styles.issueTitle}><span className={issue.kind === "error" ? styles.errorBadge : styles.suggestionBadge}>{issue.id} · {issue.kind === "error" ? "Error" : "Suggestion"}</span><span className={styles.category}>{issue.category.replaceAll("_", " ")}</span></div>
      <h3>{issue.operation === "insert" ? "Add a missing phrase" : "Review this phrase"}</h3>
      <p className={styles.quote}>&ldquo;{issue.quote}&rdquo;{issue.operation === "insert" && <span> → {issue.anchor_position} this phrase</span>}</p>
      {issue.operation !== "delete" && <div className={styles.replacement}><span>Try</span><strong>{issue.replacement || "Keep the original wording"}</strong></div>}
      <div className={styles.explanation}><strong>Why it matters</strong><p>{issue.explanation_en}</p><p lang="vi">{issue.explanation_vi}</p></div>
      <div className={styles.rule}><strong>Rule</strong><p>{issue.rule_en}</p><p lang="vi">{issue.rule_vi}</p></div>
      <div className={styles.example}><strong>Example</strong><p>{issue.example_en}</p><p lang="vi">{issue.example_vi}</p></div>
    </aside>
  );
}
