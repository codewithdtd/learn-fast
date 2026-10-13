"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWritingHistory } from "@/services/api";
import type { WritingAttemptList } from "@/types/writing";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";
import styles from "./writing.module.css";

export function WritingHistory() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [history, setHistory] = useState<WritingAttemptList | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getWritingHistory(page).then(setHistory).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "History could not be loaded.")).finally(() => setIsLoading(false));
  }, [isAuthenticated, page]);

  return (
    <main className={styles.page}>
      <div className={styles.pageHeading}><div><p className={styles.eyebrow}>YOUR PROGRESS</p><h1>Writing history</h1><p>Open any saved draft or review to continue learning from it.</p></div><Link className={styles.historyLink} href="/writing">← Browse topics</Link></div>
      {error && <div className={styles.errorNotice} role="alert">{error}</div>}
      {isAuthLoading || (isAuthenticated && isLoading) ? <div className={styles.loadingCard} role="status">Loading your writing history…</div> : !isAuthenticated ? <div className={styles.emptyCard}><h2>Sign in to view your writing</h2><p>Your writing history is private to your account.</p></div> : history?.items.length ? <>
        <div className={styles.historyList}>{history.items.map((item) => <Link href={`/writing/attempts/${item.id}`} className={styles.historyRow} key={item.id}>
          <div className={styles.historyDate}><strong>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong><span>{new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric" })}</span></div>
          <div className={styles.historyTopic}><span lang="vi">{item.title_vi}</span><strong>{item.title_en}</strong><small>{item.word_count} words · {item.status}</small></div>
          <div className={styles.historyScore}>{item.practice_score === null ? <span className={styles.statusPill}>{item.status}</span> : <><strong>{item.practice_score}<small>/10</small></strong><span>Practice score</span></>}</div>
          <span className={styles.historyArrow} aria-hidden="true">→</span>
        </Link>)}</div>
        <div className={styles.pagination}><button className={styles.secondaryButton} disabled={page <= 1} onClick={() => { setIsLoading(true); setPage((current) => current - 1); }}>Previous</button><span>Page {history.page} · {history.total} attempts</span><button className={styles.secondaryButton} disabled={page * history.page_size >= history.total} onClick={() => { setIsLoading(true); setPage((current) => current + 1); }}>Next</button></div>
      </> : <div className={styles.emptyCard}><span aria-hidden="true">✎</span><h2>Your first paragraph starts here</h2><p>Choose a topic and submit your writing. Your drafts and feedback will appear here.</p><Link className={styles.primaryButton} href="/writing">Explore writing topics</Link></div>}
      <AuthModal isOpen={authOpen || (!isAuthLoading && !isAuthenticated)} onClose={() => setAuthOpen(false)} initialMode="login" />
    </main>
  );
}
