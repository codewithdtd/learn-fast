"use client";

import Link from "next/link";
import { useState } from "react";
import { DEMO_CARDS, DEMO_SHEET, type DemoView } from "@/lib/demo-data";
import { PracticeExerciseSession } from "@/components/quick-recall/practice-exercise-session";
import { Flashcard } from "@/components/study/flashcard";
import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import type { StudyAnswerResult, StudySessionCard } from "@/services/api";
import styles from "./public-demo.module.css";

export function PublicDemo({ view = "overview" }: { view?: DemoView }) {
  return <main className={styles.page}>
    <header className={styles.header}><p className={styles.eyebrow}>PUBLIC PROJECT PREVIEW</p><h1>Try a sample sheet</h1>
      <p>Explore flashcards, vocabulary and practice exercises with one sample English sheet.</p>
      <p className={styles.notice}>Preview results reset when you leave. Full access, saved progress and AI features require an administrator account.</p></header>
    <nav className={styles.tabs} aria-label="Sample sheet views">
      {[{ view: "overview", label: "Sheet" }, { view: "flashcards", label: "Flashcards" }, { view: "table", label: "Vocabulary" }, { view: "exercises", label: "Exercises" }].map((item) => <Link key={item.view} href={item.view === "overview" ? "/demo" : `/demo/${item.view}`} aria-current={view === item.view ? "page" : undefined}>{item.label}</Link>)}
    </nav>
    {view === "overview" ? <section className={styles.card}><p className={styles.eyebrow}>ONE SAMPLE SHEET · {DEMO_CARDS.length} CARDS</p><h2>{DEMO_SHEET.name}</h2>
      <p>Learn useful expressions for everyday conversations. Reveal answers, listen to examples and test what you remember.</p>
      <div className={styles.actions}><Link className={styles.primary} href="/demo/flashcards">Try flashcards</Link><Link className={styles.secondary} href="/demo/exercises">Try practice exercises</Link></div>
      <ul className={styles.previewWords}>{DEMO_CARDS.slice(0, 4).map((card) => <li key={card.id}><strong>{card.phrase}</strong><span lang="vi">{card.meaning}</span></li>)}</ul></section>
      : view === "flashcards" ? <DemoFlashcards />
        : view === "table" ? <section className={styles.card}><h2>Sample vocabulary</h2><div className={styles.tableWrap}><table><thead><tr><th>Expression</th><th>Meaning</th><th>Example</th></tr></thead><tbody>{DEMO_CARDS.map((card) => <tr key={card.id}><td><strong>{card.phrase}</strong><AudioPronounceButton text={card.phrase} size="sm" /></td><td lang="vi">{card.meaning}</td><td>{card.example_en}<p lang="vi">{card.example_vi}</p></td></tr>)}</tbody></table></div></section>
          : <PracticeExerciseSession sheet={DEMO_SHEET} cards={DEMO_CARDS} backHref="/demo" />}
  </main>;
}

function DemoFlashcards() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<StudyAnswerResult[]>([]);
  const card = DEMO_CARDS[index];
  function reset() { setIndex(0); setFlipped(false); setAnswers([]); }
  function answer(result: StudyAnswerResult) {
    if (!flipped || !card) return;
    // Đây là lượt thử cục bộ: không gọi API session/rating, không thay đổi bộ mẫu hoặc SRS.
    setAnswers((current) => current.length === index ? [...current, result] : current);
    setFlipped(false); setIndex(index + 1);
  }
  if (!card) return <section className={styles.card} role="status"><h2>Sample round complete</h2><p>You marked {answers.filter((item) => item === "remembered").length} of {DEMO_CARDS.length} cards as remembered.</p><div className={styles.actions}><button className={styles.primary} onClick={reset}>Try again</button><Link className={styles.secondary} href="/demo/exercises">Test your recall</Link></div></section>;
  const sessionCard: StudySessionCard = { id: card.id, flashcard_id: card.id, direction: "en_to_vi", attempt_count: 0,
    again_count: 0, remembered: false, first_try_correct: false, last_answered_at: null, flashcard: card };
  return <section className={styles.flashcards} aria-label="Sample flashcard practice"><p className={styles.progress} role="status">Card {index + 1} of {DEMO_CARDS.length}</p>
    <Flashcard key={card.id} sessionCard={sessionCard} direction="en_to_vi" isFlipped={flipped} isDisabled={false} canSwipe={flipped} answerResult={null} onFlip={() => setFlipped(!flipped)} onSwipe={answer} />
    <div className={styles.actions}>{flipped ? <><button className={styles.secondary} onClick={() => answer("again")}>Again</button><button className={styles.primary} onClick={() => answer("remembered")}>Remembered</button></> : <button className={styles.primary} onClick={() => setFlipped(true)}>Reveal answer</button>}</div>
    <p className={styles.notice}>Flip the card, then choose Again or Remembered. On touch screens, swipe left for Again or right for Remembered.</p>
  </section>;
}
