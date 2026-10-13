"use client";

import { useState } from "react";
import type { WritingPrompt } from "@/types/writing";
import styles from "./writing.module.css";

export function WritingHints({ prompt }: { prompt: WritingPrompt }) {
  const [view, setView] = useState<"sentences" | "outline">("sentences");
  const outline = prompt.paragraph_hints;

  return (
    <section className={styles.card} aria-labelledby="writing-hints-title">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>BILINGUAL SUPPORT</p><h2 id="writing-hints-title">Writing hints</h2></div>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Hint format">
        <button className={view === "sentences" ? styles.activeTab : styles.tab} role="tab" aria-selected={view === "sentences"} onClick={() => setView("sentences")}>Sentence hints</button>
        <button className={view === "outline" ? styles.activeTab : styles.tab} role="tab" aria-selected={view === "outline"} onClick={() => setView("outline")}>Paragraph outline</button>
      </div>
      {view === "sentences" ? (
        <ol className={styles.hintList}>
          {prompt.sentence_hints.map((hint, index) => (
            <li key={`${index}-${hint.question_en}`} className={styles.hintItem}>
              <span className={styles.hintNumber}>{index + 1}</span>
              <div><p>{hint.idea_vi}</p><strong>{hint.question_en}</strong><code>{hint.frame_en}</code></div>
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.outlineList}>
          <OutlineStep label="Opening" vi={outline.opening_vi} en={outline.opening_en} />
          <OutlineStep label="Details" vi={outline.details_vi} en={outline.details_en} />
          <OutlineStep label="Closing" vi={outline.closing_vi} en={outline.closing_en} />
          <div className={styles.vocabGrid}>
            <div><h3>Useful connectors</h3>{outline.connectors.map((item) => <p key={item.en}><span>{item.vi}</span><strong>{item.en}</strong></p>)}</div>
            <div><h3>Useful vocabulary</h3>{outline.vocabulary.map((item) => <p key={item.en}><span>{item.vi}</span><strong>{item.en}</strong></p>)}</div>
          </div>
        </div>
      )}
      <p className={styles.hintNote}>Use these ideas to build your own paragraph. They are not a full model answer.</p>
    </section>
  );
}

function OutlineStep({ label, vi, en }: { label: string; vi: string; en: string }) {
  return <div className={styles.outlineStep}><span>{label}</span><p>{vi}</p><strong>{en}</strong></div>;
}
