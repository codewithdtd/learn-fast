"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { generateVocabularyParagraph, getSheet, getSheetCards, gradeGuestVocabularyParagraph, type FlashcardListItem, type SheetDetail } from "@/services/api";
import { WritingFeedbackView } from "@/components/writing/writing-feedback";
import { VietnamesePassage } from "@/components/paragraph-practice/vietnamese-passage";
import type { ParagraphPracticeTask, WritingAttempt, WritingFeedback } from "@/types/writing";
import styles from "./paragraph-practice.module.css";

export function ParagraphPractice({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [cards, setCards] = useState<FlashcardListItem[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [count, setCount] = useState(5);
  const [style, setStyle] = useState<"paragraph" | "dialogue">("paragraph");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestTask, setGuestTask] = useState<ParagraphPracticeTask | null>(null);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getSheet(sheetId), getSheetCards(sheetId)]).then(([loadedSheet, loadedCards]) => {
      if (active) { setSheet(loadedSheet); setCards(loadedCards); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this sheet."); });
    return () => { active = false; };
  }, [sheetId]);

  const choices = useMemo(() => (cards ?? []).filter((card) => `${card.phrase} ${card.meaning}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [cards, query]);

  function toggle(id: number) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 10 ? [...current, id] : current);
  }

  function chooseRandom() {
    if (!cards) return;
    // Fisher–Yates gives every card a fair chance without changing the sheet's stored order.
    const shuffled = [...cards];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    setSelected(shuffled.slice(0, count).map((card) => card.id));
    setError(null);
  }

  async function createTask() {
    if (busy || selected.length < 5 || selected.length > 10 || authLoading) return;
    setBusy(true); setError(null);
    try {
      const result = await generateVocabularyParagraph(Number(sheetId), selected, style, !isAuthenticated);
      if ("prompt_snapshot" in result) router.push(`/writing/attempts/${(result as WritingAttempt).id}`);
      else { setGuestTask(result); setDraft(""); setFeedback(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create your passage. Try again."); }
    finally { setBusy(false); }
  }

  async function gradeGuest() {
    if (!guestTask || !draft.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await gradeGuestVocabularyParagraph(guestTask, draft.trim());
      setSubmitted(draft.trim()); setFeedback(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not review your translation."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><Link href={`/sheets/${sheetId}`}>← Back to sheet</Link><p className={styles.eyebrow}>VOCABULARY → REAL STORIES</p><h1>{style === "dialogue" ? "Translate a conversation" : "Translate a story"}</h1><p>{style === "dialogue" ? "Translate a short Vietnamese chat between two people into natural English." : `Turn expressions from ${sheet?.name ?? "your sheet"} into a Vietnamese passage, then make it your own in English.`}</p></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!cards && !error && <p role="status" className={styles.panel}>Loading vocabulary…</p>}
    {cards && cards.length < 5 && <section className={styles.panel}><h2>More words needed</h2><p>This sheet needs at least five vocabulary cards for a story.</p><Link href={`/sheets/${sheetId}`}>Back to sheet</Link></section>}
    {cards && cards.length >= 5 && !guestTask && <>
      <section className={styles.panel}>
        <div className={styles.sectionTitle}><div><span className={styles.step}>01</span><h2>Choose your expressions</h2><p>Select 5–10 cards, or let us pick for you.</p></div><strong className={styles.counter}>{selected.length} / 10 selected</strong></div>
        <div className={styles.randomRow}><label>Random selection <select value={count} onChange={(event) => setCount(Number(event.target.value))} disabled={busy}>{Array.from({ length: Math.min(10, cards.length) - 4 }, (_, index) => index + 5).map((number) => <option key={number} value={number}>{number} words</option>)}</select></label><button className={styles.secondary} type="button" disabled={busy} onClick={chooseRandom}>Shuffle words</button><button className={styles.textButton} type="button" disabled={busy || !selected.length} onClick={() => setSelected([])}>Clear selection</button></div>
        <label className={styles.search}>Find an expression<input type="search" value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} placeholder="Search phrase or meaning" /></label>
        <div className={styles.words} aria-label="Vocabulary selection">{choices.map((card) => <label key={card.id} className={styles.word} data-selected={selected.includes(card.id)}><input type="checkbox" checked={selected.includes(card.id)} disabled={busy || (!selected.includes(card.id) && selected.length >= 10)} onChange={() => toggle(card.id)} /><span><strong>{card.phrase}</strong><small lang="vi">{card.meaning}</small></span></label>)}</div>
        {!choices.length && <p>No expressions match your search.</p>}
      </section>
      <section className={styles.panel}><div className={styles.sectionTitle}><div><span className={styles.step}>02</span><h2>Choose your format</h2><p>AI creates a Vietnamese text that uses the meaning of your selected expressions.</p></div></div>
        <div className={styles.formats} role="group" aria-label="Passage format"><button type="button" className={styles.format} aria-pressed={style === "paragraph"} disabled={busy} onClick={() => setStyle("paragraph")}><strong>✦ Short story</strong><span>A connected paragraph</span></button><button type="button" className={styles.format} aria-pressed={style === "dialogue"} disabled={busy} onClick={() => setStyle("dialogue")}><strong>☏ Conversation</strong><span>A short dialogue</span></button></div>
        <p className={styles.note}>{isAuthenticated && user?.is_superuser ? "Your work is saved to your account." : isAuthenticated ? "One passage and one review trial. Your work is saved to your account." : "Guest trial: one passage and one review. Your work stays on this page and is not saved to an account."}</p>
        <button type="button" className={styles.primary} disabled={busy || authLoading || selected.length < 5} aria-busy={busy} onClick={() => void createTask()}>{busy ? "Creating your passage…" : "Create my passage →"}</button>
      </section>
    </>}
    {guestTask && <>
      <section className={styles.panel}><span className={styles.step}>{guestTask.style === "dialogue" ? "VIETNAMESE CONVERSATION" : "YOUR VIETNAMESE TEXT"}</span><h2>{guestTask.title_en}</h2><VietnamesePassage text={guestTask.paragraph_vi} style={guestTask.style} /><div className={styles.chips}>{guestTask.words.map((word) => <span key={word.id}><strong>{word.phrase}</strong> · {word.meaning}</span>)}</div></section>
      <section className={styles.panel}><h2>Your English translation</h2><label className={styles.search}>Write your version<textarea rows={8} maxLength={4000} value={draft} disabled={busy || !!feedback} onChange={(event) => setDraft(event.target.value)} placeholder={guestTask.style === "dialogue" ? "Translate the conversation into English…" : "Write the story in English…"} /></label><p className={styles.note}>Use the target expressions naturally. Your guest result will disappear when you leave or refresh this page.</p><button className={styles.primary} disabled={busy || !draft.trim() || !!feedback} onClick={() => void gradeGuest()}>{busy ? "Reviewing…" : feedback ? "Review completed" : "Get AI feedback"}</button></section>
      {feedback && <WritingFeedbackView feedback={feedback} sourceText={submitted} />}
    </>}
  </main>;
}
