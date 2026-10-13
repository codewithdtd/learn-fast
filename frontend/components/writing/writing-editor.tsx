"use client";

import styles from "./writing.module.css";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function WritingEditor({
  value,
  onChange,
  disabled,
  targetWords,
  saveState,
  onSave,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  targetWords: number;
  saveState: SaveState;
  onSave: () => void;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const statusText: Record<SaveState, string> = {
    idle: "Changes save automatically",
    saving: "Saving draft…",
    saved: "Draft saved",
    error: "Draft not saved",
  };
  return (
    <section className={styles.card} aria-labelledby="your-writing-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>YOUR PRACTICE</p><h2 id="your-writing-title">Your paragraph</h2></div>
        <span className={saveState === "error" ? styles.saveError : styles.saveStatus} role="status">{statusText[saveState]}</span>
      </div>
      <label className={styles.srOnly} htmlFor="writing-draft">Write your English paragraph</label>
      <textarea id="writing-draft" className={styles.editor} value={value} disabled={disabled} maxLength={4000} onChange={(event) => onChange(event.target.value)} placeholder="Start with one simple sentence. You can add more details as you go." />
      <div className={styles.editorFooter}>
        <span>{words} words <span aria-hidden="true">·</span> suggested {targetWords} words</span>
        {saveState === "error" && <button className={styles.textButton} type="button" onClick={onSave}>Try saving again</button>}
      </div>
    </section>
  );
}
