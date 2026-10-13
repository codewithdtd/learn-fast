"use client";

import type { WritingIssue } from "@/types/writing";
import styles from "./writing.module.css";

export function WritingErrorTable({ issues, selectedId, onSelect }: {
  issues: WritingIssue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (issues.length === 0) return <div className={styles.noIssues}><span aria-hidden="true">✓</span><div><strong>No corrections needed</strong><p>Your writing has no marked errors or suggestions in this review.</p></div></div>;
  return (
    <div className={styles.issueTableWrap}>
      <table className={styles.issueTable}>
        <thead><tr><th>Type</th><th>Your text</th><th>Suggested change</th><th>Reason</th></tr></thead>
        <tbody>{issues.map((issue) => <tr key={issue.id} className={selectedId === issue.id ? styles.selectedRow : undefined}>
          <td><button className={issue.kind === "error" ? styles.errorChip : styles.suggestionChip} onClick={() => onSelect(issue.id)} aria-pressed={selectedId === issue.id}>{issue.id} · {issue.kind}</button></td>
          <td><button className={styles.tableTextButton} onClick={() => onSelect(issue.id)}>{issue.quote}</button></td>
          <td>{issue.operation === "delete" ? <span className={styles.muted}>Remove</span> : issue.replacement || <span className={styles.muted}>—</span>}</td>
          <td>{issue.explanation_en}</td>
        </tr>)}</tbody>
      </table>
      <div className={styles.mobileIssueList}>{issues.map((issue) => <button key={issue.id} className={selectedId === issue.id ? styles.mobileIssueSelected : styles.mobileIssue} onClick={() => onSelect(issue.id)} aria-pressed={selectedId === issue.id}><span className={issue.kind === "error" ? styles.errorChip : styles.suggestionChip}>{issue.id} · {issue.kind}</span><strong>{issue.quote}</strong><span>{issue.operation === "delete" ? "Remove" : issue.replacement}</span><small>{issue.explanation_en}</small></button>)}</div>
    </div>
  );
}
