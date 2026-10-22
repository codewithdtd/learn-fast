"use client";

import { useState } from "react";
import type { SentencePracticeContext } from "@/types/writing";
import styles from "./sentence-practice.module.css";

export function SentenceHints({ context }: { context: SentencePracticeContext }) {
  const [level, setLevel] = useState(0);
  const hints = [{ label: "Idea", value: context.idea }, { label: "Sentence frame", value: context.frame }, { label: "One possible example", value: context.example }];
  return <section className={styles.card} aria-labelledby="sentence-hints-title"><p className={styles.eyebrow}>HELP WHEN YOU NEED IT</p>
    <h2 id="sentence-hints-title">Try it yourself first</h2><p className={styles.note}>Reveal only as much help as you need. Many different sentences can be correct.</p>
    <div aria-live="polite">{hints.slice(0, level).map(({ label, value }) => <div className={styles.hint} key={label}><h3>{label}</h3><p>{value.en}</p><p lang="vi">{value.vi}</p></div>)}</div>
    {level < hints.length && <button type="button" className={styles.secondary} onClick={() => setLevel(level + 1)}>{level === 0 ? "Show an idea" : level === 1 ? "Show a sentence frame" : "Show an example"}</button>}
  </section>;
}
