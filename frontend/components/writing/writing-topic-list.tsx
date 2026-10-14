"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, createWritingAttempt, generateRandomWritingAttempt, getWritingPrompts } from "@/services/api";
import type { WritingPrompt } from "@/types/writing";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";
import styles from "./writing.module.css";

export function WritingTopicList() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [prompts, setPrompts] = useState<WritingPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    getWritingPrompts().then((result) => setPrompts(result.items)).catch(() => setError("Writing topics could not be loaded. Please try again.")).finally(() => setIsLoading(false));
  }, []);

  async function startWriting(promptId: number) {
    if (isGenerating || startingId !== null) return;
    if (!isAuthenticated) { setAuthOpen(true); return; }
    setStartingId(promptId);
    setError(null);
    try {
      const attempt = await createWritingAttempt(promptId);
      router.push(`/writing/attempts/${attempt.id}`);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) setAuthOpen(true);
      else setError(cause instanceof Error ? cause.message : "A writing draft could not be started.");
    } finally {
      setStartingId(null);
    }
  }

  async function generateRandomTopic() {
    if (isGenerating || startingId !== null) return;
    if (!isAuthenticated) { setAuthOpen(true); return; }
    setError(null);
    setIsGenerating(true);
    try {
      const attempt = await generateRandomWritingAttempt();
      router.push(`/writing/attempts/${attempt.id}`);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) setAuthOpen(true);
      else setError(cause instanceof Error ? cause.message : "A new writing topic could not be generated.");
    } finally {
      setIsGenerating(false);
    }
  }

  const suggested = prompts.find((prompt) => prompt.is_daily_suggestion);
  return (
    <main className={styles.page}>
      <div className={styles.pageHeading}>
        <div><p className={styles.eyebrow}>BUILD YOUR ENGLISH, ONE PARAGRAPH AT A TIME</p><h1>Writing practice</h1><p>Choose a familiar topic, use bilingual hints, and get clear feedback on your own writing.</p></div>
        <Link className={styles.historyLink} href="/writing/history">View writing history <span aria-hidden="true">→</span></Link>
      </div>
      <div className={styles.randomTopicAction}>
        <button className={styles.secondaryButton} disabled={isGenerating || startingId !== null} aria-busy={isGenerating} onClick={() => void generateRandomTopic()}>
          {isGenerating ? <><span className={styles.spinner} aria-hidden="true" /> Creating your topic...</> : <><span aria-hidden="true">✦</span> Generate a random topic with AI</>}
        </button>
        <span aria-live="polite">{isGenerating ? "AI is preparing a topic and bilingual hints." : "Get one of up to three fresh topics per day, with step-by-step hints."}</span>
      </div>
      {!isAuthenticated && <div className={styles.loginNotice} role="note"><strong>Sign in to save and review your writing.</strong><span>Your topics and hints are available before you sign in.</span></div>}
      {error && <div className={styles.errorNotice} role="alert">{error}</div>}
      {suggested && <section className={styles.dailyCard}>
        <div className={styles.dailyBadge}><span aria-hidden="true">✦</span> TODAY&apos;S SUGGESTION</div>
        <div><p className={styles.topicTitleVi}>{suggested.title_vi}</p><h2>{suggested.title_en}</h2><p>{suggested.prompt_en}</p><p lang="vi">{suggested.prompt_vi}</p><span className={styles.topicMeta}>{suggested.difficulty} · about {suggested.target_word_count} words</span></div>
        <button className={styles.primaryButton} disabled={startingId !== null || isGenerating} onClick={() => startWriting(suggested.id)}>{startingId === suggested.id ? "Starting…" : "Start today’s writing"}</button>
      </section>}
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>10 BEGINNER-FRIENDLY TOPICS</p><h2>Choose a topic</h2></div><span className={styles.countBadge}>{prompts.length} topics</span></div>
      {isLoading ? <div className={styles.loadingCard} role="status">Loading writing topics…</div> : prompts.length === 0 ? <div className={styles.emptyCard}><h2>No topics are available yet</h2><p>Writing prompts have not been seeded into this database.</p></div> : <div className={styles.topicGrid}>{prompts.map((prompt, index) => <article key={prompt.id} className={styles.topicCard}>
        <div className={styles.topicCardTop}><span className={styles.topicNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.levelPill}>{prompt.difficulty}</span></div>
        <p className={styles.topicTitleVi}>{prompt.title_vi}</p><h3>{prompt.title_en}</h3><p>{prompt.prompt_en}</p>
        <div className={styles.topicCardFooter}><span>≈ {prompt.target_word_count} words</span><button className={styles.secondaryButton} disabled={startingId !== null || isGenerating} onClick={() => startWriting(prompt.id)}>{startingId === prompt.id ? "Starting…" : "Start writing"}<span aria-hidden="true"> →</span></button></div>
      </article>)}</div>}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </main>
  );
}
