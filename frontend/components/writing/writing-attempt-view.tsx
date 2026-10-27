"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiRequestError, createWritingAttempt, generateSentenceWritingAttempt, getWritingAttempt, getWritingUsage, gradeWritingAttempt, saveWritingAttempt } from "@/services/api";
import { SentenceHints } from "@/components/sentences/sentence-hints";
import type { WritingAttempt, WritingUsage } from "@/types/writing";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { WritingHints } from "./writing-hints";
import { WritingEditor, type SaveState } from "./writing-editor";
import { WritingFeedbackView } from "./writing-feedback";
import { playJourneyCompletionSound } from "@/lib/journey-sounds";
import styles from "./writing.module.css";

export function WritingAttemptView({ attemptId }: { attemptId: number }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [attempt, setAttempt] = useState<WritingAttempt | null>(null);
  const [draft, setDraft] = useState("");
  const [usage, setUsage] = useState<WritingUsage | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isLoading, setIsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const creating = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const lastSavedText = useRef("");
  const reviewRequest = useRef<AbortController | null>(null);
  const feedbackStarting = useRef(false);
  const taskRequest = useRef<AbortController | null>(null);
  const activeView = useRef(true);

  useEffect(() => {
    activeView.current = true;
    return () => { activeView.current = false; reviewRequest.current?.abort(); taskRequest.current?.abort(); };
  }, [attemptId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = getWritingAttempt(attemptId);
    Promise.all([load, getWritingUsage()]).then(([loaded, quota]) => {
      setAttempt(loaded); setDraft(loaded.draft_text); lastSavedText.current = loaded.draft_text; setUsage(quota);
    }).catch((cause: unknown) => {
      if (cause instanceof ApiRequestError && cause.status === 401) setAuthOpen(true);
      setError(cause instanceof Error ? cause.message : "Your writing could not be loaded.");
    }).finally(() => setIsLoading(false));
  }, [attemptId, isAuthenticated]);

  const persistDraft = useCallback(async (text: string): Promise<WritingAttempt | null> => {
    if (!attempt || (attempt.status !== "draft" && attempt.status !== "failed")) return attempt;
    setSaveState("saving");
    try {
      const saved = await saveWritingAttempt(attempt.id, attempt.version, text);
      lastSavedText.current = text;
      setAttempt(saved);
      setSaveState("saved");
      return saved;
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Your draft could not be saved.");
      return null;
    }
  }, [attempt]);

  useEffect(() => {
    if (!attempt || isGrading || (attempt.status !== "draft" && attempt.status !== "failed") || draft === lastSavedText.current) return;
    const timer = window.setTimeout(() => { void persistDraft(draft); }, 700);
    return () => window.clearTimeout(timer);
  }, [attempt, draft, persistDraft, isGrading]);

  const acceptReviewStatus = useCallback((updated: WritingAttempt) => {
    setAttempt(updated);
    setPollingError(null);
    if (updated.status === "graded" || updated.status === "failed") {
      // Polling may observe a committed result before the original POST finishes.
      reviewRequest.current?.abort();
      setIsGrading(false);
      if (updated.status === "graded") {
        setDraft(updated.draft_text);
        lastSavedText.current = updated.draft_text;
      } else if (updated.error_code === "grading_timeout") {
        setError("The previous review was interrupted or timed out. Your draft is saved; you can request feedback again.");
      }
    }
  }, []);

  const reviewStatus = attempt?.status;
  useEffect(() => {
    if (reviewStatus !== "grading") return;
    let cancelled = false;
    let timer: number | undefined;
    async function poll() {
      try {
        const updated = await getWritingAttempt(attemptId);
        if (cancelled) return;
        acceptReviewStatus(updated);
        if (updated.status !== "grading") {
          const quota = await getWritingUsage().catch(() => null);
          if (!cancelled && quota) setUsage(quota);
          return;
        }
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiRequestError && cause.status === 401) setAuthOpen(true);
        setPollingError("Could not refresh your review status. Your saved draft is safe. Check your connection or refresh the status below.");
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 3000);
    }
    timer = window.setTimeout(() => void poll(), 3000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [attemptId, reviewStatus, acceptReviewStatus]);

  async function refreshReviewStatus() {
    try { acceptReviewStatus(await getWritingAttempt(attemptId)); }
    catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 401) setAuthOpen(true);
      setPollingError(cause instanceof Error ? cause.message : "Your review status could not be refreshed.");
    }
  }

  async function submitForFeedback() {
    if (!attempt || isGrading || feedbackStarting.current) return;
    feedbackStarting.current = true;
    // Dừng timer autosave trước khi lưu/chấm để hai request không tranh cùng version nháp.
    setIsGrading(true);
    setError(null);
    setPollingError(null);
    let current = attempt;
    if ((current.status === "draft" || current.status === "failed") && draft !== lastSavedText.current) {
      const saved = await persistDraft(draft);
      if (!saved) { feedbackStarting.current = false; setIsGrading(false); return; }
      current = saved;
    }
    const controller = new AbortController();
    reviewRequest.current = controller;
    setAttempt({ ...current, status: "grading" });
    try {
      const graded = await gradeWritingAttempt(current.id, current.version, controller.signal);
      setAttempt(graded); setDraft(graded.draft_text); lastSavedText.current = graded.draft_text;
      playJourneyCompletionSound("writing-" + graded.id + "-" + graded.version);
      const quota = await getWritingUsage().catch(() => null);
      if (quota) setUsage(quota);
      window.setTimeout(() => document.getElementById("feedback-title")?.focus(), 0);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const refreshed = await getWritingAttempt(current.id).catch(() => null);
      if (refreshed) setAttempt(refreshed);
      setUsage(await getWritingUsage().catch(() => usage));
      setError(cause instanceof Error ? cause.message : "Feedback could not be generated. Your draft is saved.");
    } finally {
      feedbackStarting.current = false;
      if (reviewRequest.current === controller) reviewRequest.current = null;
      setIsGrading(false);
    }
  }

  async function startRewrite() {
    if (!attempt || creating.current) return;
    creating.current = true; setIsCreating(true);
    let navigating = false;
    try {
      const fresh = await createWritingAttempt(attempt.prompt_id, attempt.id);
      if (activeView.current) { router.push(`/writing/attempts/${fresh.id}`); navigating = true; }
    } catch (cause) { if (activeView.current) setError(cause instanceof Error ? cause.message : "A rewrite could not be started."); }
    finally { if (!navigating) { creating.current = false; if (activeView.current) setIsCreating(false); } }
  }

  async function startNewSituation() {
    const target = attempt?.prompt_snapshot.paragraph_hints.sentence_practice;
    if (!target || creating.current) return;
    creating.current = true; setIsCreating(true); setError(null);
    const controller = new AbortController();
    taskRequest.current = controller;
    let navigating = false;
    try {
      const fresh = await generateSentenceWritingAttempt(target.flashcard_id, controller.signal);
      if (activeView.current) { router.push(`/writing/attempts/${fresh.id}`); navigating = true; }
    } catch (cause) { if (activeView.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "A new situation could not be created."); }
    finally { taskRequest.current = null; if (!navigating) { creating.current = false; if (activeView.current) setIsCreating(false); } }
  }

  if (isAuthLoading || (isAuthenticated && isLoading)) return <main className={styles.page}><div className={styles.loadingCard} role="status">Loading your writing…</div></main>;
  if (!isAuthenticated) return <main className={styles.page}><div className={styles.emptyCard}><h1>Sign in to continue</h1><p>Your writing drafts and feedback are private to your account.</p></div><AuthModal isOpen={authOpen || !isAuthLoading} onClose={() => setAuthOpen(false)} initialMode="login" /></main>;
  if (!attempt) return <main className={styles.page}><div className={styles.errorNotice} role="alert">{error || "This writing attempt could not be found."}</div><Link href="/writing" className={styles.secondaryButton}>Back to topics</Link><AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" /></main>;

  const prompt = attempt.prompt_snapshot;
  const sentenceContext = prompt.paragraph_hints.sentence_practice;
  const isSentence = prompt.format === "sentence";
  const locked = attempt.status === "graded" || attempt.status === "grading" || isGrading;
  const canGrade = (attempt.status === "draft" || attempt.status === "failed") && !isGrading && usage?.remaining !== 0;
  return (
    <main className={`${styles.page} ${isSentence ? styles.sentencePage : ""}`}>
      <div className={styles.pageHeading}><div><Link href={isSentence ? `/ai-support?tab=sentences${sentenceContext ? `&sheet=${sentenceContext.sheet_id}` : ""}` : "/ai-support?tab=writing"} className={styles.backLink}>{isSentence ? "← Choose another word" : "← All topics"}</Link><p className={styles.eyebrow}>{isSentence ? "ACTIVE VOCABULARY PRACTICE" : `${prompt.difficulty} WRITING PRACTICE`}</p><h1>{prompt.title_en}</h1><p lang="vi">{prompt.title_vi}</p></div><Link className={styles.historyLink} href="/writing/history">Practice history</Link></div>
      <div className={styles.assignmentCard}><p className={styles.eyebrow}>YOUR TASK</p><h2>{prompt.prompt_en}</h2><p lang="vi">{prompt.prompt_vi}</p>{sentenceContext && <p><strong>Target expression: {sentenceContext.phrase}</strong> · <span lang="vi">{sentenceContext.meaning}</span></p>}<div className={styles.assignmentMeta}><span>{isSentence ? "One original sentence" : `Suggested length: ${prompt.target_word_count} words`}</span><span>Maximum: {isSentence ? "60 words / 600 characters" : "300 words"}</span>{usage && <span>{usage.remaining} of {usage.daily_limit} feedback reviews left today</span>}</div></div>
      {error && <div className={styles.errorNotice} role="alert">{error}</div>}
      {isSentence && attempt.revision_of_id && <div className={styles.warningNotice} role="status">Write an improved sentence from memory. Your previous answer and feedback remain in history.</div>}
      {pollingError && <div className={styles.errorNotice} role="alert"><span>{pollingError}</span><button className={styles.secondaryButton} onClick={() => void refreshReviewStatus()}>Refresh review status</button></div>}
      {attempt.status === "failed" && <div className={styles.warningNotice} role="status">{attempt.error_code === "grading_timeout" ? "The previous review was interrupted or timed out. Your draft is saved; request feedback again when ready." : "Feedback could not be saved last time. Your writing is safe; try again when the service is available."}</div>}
      {attempt.status === "grading" && !pollingError && <div className={styles.progressNotice} role="status" aria-live="polite"><span className={styles.spinner} /> Your writing is being reviewed. This can take a little while.</div>}
      <div className={styles.writingLayout}>
        <div className={styles.writingMain}><WritingEditor sentence={isSentence} value={draft} onChange={setDraft} disabled={locked} targetWords={prompt.target_word_count} saveState={saveState} onSave={() => { void persistDraft(draft); }} />
          {attempt.status !== "graded" && <div className={styles.submitBar}><div><strong>Ready to review?</strong><span>Your saved {isSentence ? "sentence" : "paragraph"} will be sent to the configured AI provider.</span></div><button className={styles.primaryButton} disabled={!canGrade || saveState === "saving" || !draft.trim() || (isSentence && draft.trim().split(/\s+/).length > 60)} onClick={() => void submitForFeedback()}>{isGrading || attempt.status === "grading" ? pollingError ? "Review status unavailable" : "Reviewing…" : attempt.status === "failed" ? "Try feedback again" : "Submit for feedback"}</button></div>}
          {attempt.status === "graded" && attempt.feedback && <><WritingFeedbackView sentence={isSentence} feedback={attempt.feedback} sourceText={attempt.submitted_text ?? ""} /><div className={styles.rewriteBar}><div><strong>{isSentence ? "Now write it again from memory" : "Ready for another try?"}</strong><span>Your current score and feedback will stay in history. Each new review uses a feedback turn.</span></div><button className={styles.primaryButton} disabled={isCreating} onClick={() => void startRewrite()}>{isCreating ? "Creating…" : "Start a rewrite"}</button>{isSentence && <button className={styles.secondaryButton} disabled={isCreating} onClick={() => void startNewSituation()}>Try a new situation</button>}</div></>}
          {attempt.status === "graded" && !attempt.feedback && <div className={styles.errorNotice}>Saved feedback is unavailable for this attempt.</div>}
          {usage?.remaining === 0 && attempt.status !== "graded" && <p className={styles.quotaNotice}>You have used today&apos;s feedback limit. You can still save your draft and return tomorrow.</p>}
        </div>
        <div className={styles.hintsColumn}>{isSentence && sentenceContext ? <SentenceHints key={attempt.id} context={sentenceContext} /> : <WritingHints prompt={prompt} />}</div>
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </main>
  );
}
