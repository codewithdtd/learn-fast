"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { generateSentenceWritingAttempt, getSheet, getSheetCards, getWorkbook, getWorkbooks,
  type FlashcardListItem, type WorkbookDetail, type WorkbookListItem } from "@/services/api";
import styles from "./sentence-practice.module.css";

export function SentencePractice({ initialSheetId }: { initialSheetId?: string }) {
  const [data, setData] = useState<{ books: WorkbookListItem[]; initialBook?: number } | null>(null);
  const [bookId, setBookId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getWorkbooks(), initialSheetId ? getSheet(initialSheetId) : Promise.resolve(null)])
      .then(([books, sheet]) => { if (active) { setData({ books, initialBook: sheet?.workbook.id }); setError(null); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load your vocabulary."); });
    return () => { active = false; };
  }, [initialSheetId, reload]);
  const selectedBook = bookId || String(data?.initialBook ?? data?.books[0]?.id ?? "");

  return <section className={styles.root}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FROM RECOGNITION TO EXPRESSION</p><h2>Use this word</h2>
      <p>Try three original sentences a day. Pick a word, write about a real situation, then improve your sentence with AI feedback.</p></div>
      <Link href="/writing/history" className={styles.secondary}>Practice history</Link></header>
    <ol className={styles.steps}><li>Choose a word</li><li>Write your sentence</li><li>Review and rewrite</li></ol>
    <p className={styles.note}>Administrator access only. Task generation and feedback share your Writing AI limits. Each rewrite review uses another feedback turn.</p>
    {error ? <div role="alert" className={styles.error}><p>{error}</p><button className={styles.secondary} onClick={() => { setData(null); setError(null); setReload(reload + 1); }}>Try again</button>
      {initialSheetId && <Link href="/ai-support?tab=sentences">Choose another sheet</Link>}</div>
      : !data ? <p role="status" className={styles.card}>Loading vocabulary…</p>
        : !data.books.length ? <div className={styles.card}><h3>No workbooks yet</h3><p>Import a workbook before practicing with your vocabulary.</p><Link className={styles.secondary} href="/import">Import workbook</Link></div>
          : <div className={styles.card}><label className={styles.field}>Workbook<select value={selectedBook} onChange={(event) => setBookId(event.target.value)}>{data.books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}</select></label>
            <WorkbookWords key={selectedBook} bookId={selectedBook} initialSheetId={initialSheetId} /></div>}
  </section>;
}

function WorkbookWords({ bookId, initialSheetId }: { bookId: string; initialSheetId?: string }) {
  const [book, setBook] = useState<WorkbookDetail | null>(null);
  const [sheetId, setSheetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    getWorkbook(bookId).then((loaded) => { if (active) { setBook(loaded); setError(null); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load this workbook."); });
    return () => { active = false; };
  }, [bookId, reload]);
  if (error) return <div className={styles.error} role="alert"><p>{error}</p><button className={styles.secondary} onClick={() => { setError(null); setReload(reload + 1); }}>Retry workbook</button></div>;
  if (!book) return <p role="status">Loading sheets…</p>;
  if (!book.sheets.length) return <p>This workbook has no sheets. Choose another workbook.</p>;
  const selected = sheetId || (book.sheets.some((sheet) => String(sheet.id) === initialSheetId) ? initialSheetId! : String(book.sheets[0].id));
  return <><label className={styles.field}>Sheet<select value={selected} onChange={(event) => setSheetId(event.target.value)}>{book.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label>
    <WordPicker key={selected} sheetId={selected} /></>;
}

function WordPicker({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<FlashcardListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [weakOnly, setWeakOnly] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [reload, setReload] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    let active = true;
    getSheetCards(sheetId).then((loaded) => { if (active) { setCards(loaded); setLoadError(null); } })
      .catch((cause: unknown) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Could not load these words."); });
    return () => { active = false; };
  }, [sheetId, reload]);
  if (loadError) return <div className={styles.error} role="alert"><p>{loadError}</p><button className={styles.secondary} onClick={() => { setLoadError(null); setReload(reload + 1); }}>Retry words</button></div>;
  if (!cards) return <p role="status">Loading words…</p>;
  const query = search.trim().toLocaleLowerCase();
  const choices = cards.filter((card) => (!weakOnly || card.is_weak) && `${card.phrase} ${card.meaning}`.toLocaleLowerCase().includes(query));
  const selected = choices.find((card) => String(card.id) === selectedId) ?? choices[0];

  async function start() {
    if (!selected || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStarting(true); setError(null);
    let navigating = false;
    try {
      const attempt = await generateSentenceWritingAttempt(selected.id, controller.signal);
      if (!controller.signal.aborted) { router.push(`/writing/attempts/${attempt.id}`); navigating = true; }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The situation could not be generated. Try again.");
    } finally {
      if (!controller.signal.aborted && !navigating) { request.current = null; setStarting(false); }
    }
  }

  return <div className={styles.picker}>
    <div className={styles.filters}><label className={styles.field}>Find a word<input type="search" value={search} placeholder="Search phrase or meaning" disabled={starting} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className={styles.checkbox}><input type="checkbox" checked={weakOnly} disabled={starting} onChange={(event) => setWeakOnly(event.target.checked)} /> Weak cards only</label></div>
    {choices.length ? <><label className={styles.field}>Vocabulary ({choices.length})<select value={selected?.id ?? ""} disabled={starting} onChange={(event) => setSelectedId(event.target.value)}>{choices.map((card) => <option key={card.id} value={card.id}>{card.phrase.slice(0, 100)}{card.is_weak ? " · Weak" : ""}</option>)}</select></label>
      <div className={styles.word}><p className={styles.eyebrow}>YOUR TARGET EXPRESSION</p><h3>{selected.phrase}</h3><p lang="vi">{selected.meaning}</p></div>
      <p className={styles.note}>AI will create a bilingual situation. Hints stay hidden until you choose to open them.</p>
      <button className={styles.primary} type="button" disabled={starting} aria-busy={starting} onClick={() => void start()}>{starting ? "Creating your situation…" : "Create sentence challenge"}</button>
    </> : <p role="status">{cards.length ? "No words match. Adjust your search or turn off the Weak filter." : "This sheet has no vocabulary yet. Choose another sheet."}</p>}
    {error && <p role="alert" className={styles.error}>{error} Your saved challenges are available in Practice history.</p>}
  </div>;
}
