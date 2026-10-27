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
  sentence = false,
  conversation = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  targetWords: number;
  saveState: SaveState;
  onSave: () => void;
  sentence?: boolean;
  conversation?: boolean;
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
        <div><p className={styles.eyebrow}>YOUR PRACTICE</p><h2 id="your-writing-title">{sentence ? "Your sentence" : conversation ? "Your conversation" : "Your paragraph"}</h2></div>
        <span className={saveState === "error" ? styles.saveError : styles.saveStatus} role="status">{statusText[saveState]}</span>
      </div>
      <label className={styles.srOnly} htmlFor="writing-draft">{sentence ? "Write your own English sentence using the target expression" : conversation ? "Translate both speakers into an English conversation" : "Write your English paragraph"}</label>
      <textarea id="writing-draft" className={`${styles.editor} ${sentence ? styles.sentenceEditor : ""}`} value={value} disabled={disabled} maxLength={sentence ? 600 : 4000} autoCorrect={sentence ? "off" : undefined} spellCheck={!sentence} onChange={(event) => onChange(event.target.value)} placeholder={sentence ? "Use the target expression in one sentence of your own." : conversation ? "Translate both speakers and keep the A/B turns." : "Start with one simple sentence. You can add more details as you go."} />
      <div className={styles.editorFooter}>
        <span>{words} words <span aria-hidden="true">·</span> {sentence ? "one sentence, maximum 60 words" : `suggested ${targetWords} words`}</span>
        {saveState === "error" && <button className={styles.textButton} type="button" onClick={onSave}>Try saving again</button>}
      </div>
    </section>
  );
}
