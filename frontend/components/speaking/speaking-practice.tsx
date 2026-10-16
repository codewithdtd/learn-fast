"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeakingAttempt,
  getSpeakingAttempt,
  getSpeakingHistory,
  getSpeakingPrompts,
  getSpeakingUsage,
  generateRandomSpeakingAttempt,
  gradeSpeakingAttempt,
  saveSpeakingTranscript,
  transcribeSpeakingAttempt,
} from "@/services/api";
import type { SpeakingAttempt, SpeakingAttemptSummary, SpeakingFeedback, SpeakingPrompt, SpeakingUsage } from "@/types/speaking";
import styles from "./speaking.module.css";

const MAX_RECORDING_SECONDS = 120;

export function SpeakingPractice() {
  const [prompts, setPrompts] = useState<SpeakingPrompt[]>([]);
  const [history, setHistory] = useState<SpeakingAttemptSummary[]>([]);
  const [usage, setUsage] = useState<SpeakingUsage | null>(null);
  const [attempt, setAttempt] = useState<SpeakingAttempt | null>(null);
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  function clearRecordingPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setRecordedAudio(null);
    setConsent(false);
  }

  const refreshHistory = useCallback(async () => {
    const [historyResult, usageResult] = await Promise.all([getSpeakingHistory(), getSpeakingUsage()]);
    setHistory(historyResult.items);
    setUsage(usageResult);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getSpeakingPrompts(), getSpeakingHistory(), getSpeakingUsage()])
      .then(([promptResult, historyResult, usageResult]) => {
        if (!active) return;
        setPrompts(promptResult.items);
        setHistory(historyResult.items);
        setUsage(usageResult);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Speaking practice could not be loaded."))
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((value) => {
      if (value + 1 >= MAX_RECORDING_SECONDS) {
        recorderRef.current?.stop();
        return MAX_RECORDING_SECONDS;
      }
      return value + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const activeAttemptId = attempt?.id;
  const activeAttemptStatus = attempt?.status;
  useEffect(() => {
    if (!activeAttemptId || (activeAttemptStatus !== "transcribing" && activeAttemptStatus !== "grading")) return;
    const attemptId = activeAttemptId;
    const timer = window.setInterval(() => {
      getSpeakingAttempt(attemptId).then((fresh) => {
        setAttempt(fresh);
        setTranscript(fresh.transcript);
        if (fresh.status !== "transcribing" && fresh.status !== "grading") {
          void refreshHistory().catch(() => undefined);
        }
      }).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeAttemptId, activeAttemptStatus, refreshHistory]);

  async function startAttempt(prompt: SpeakingPrompt) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const next = await createSpeakingAttempt(prompt.id);
      setAttempt(next);
      setTranscript("");
      clearRecordingPreview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "A speaking attempt could not be started.");
    } finally {
      setBusy(false);
    }
  }

  async function generateTopic() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const next = await generateRandomSpeakingAttempt();
      setAttempt(next);
      setTranscript("");
      clearRecordingPreview();
      setNotice("Your new AI speaking topic is ready. Use the bilingual hints to plan your answer.");
      await refreshHistory().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "An AI speaking topic could not be generated. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openAttempt(attemptId: number) {
    setError(null);
    setBusy(true);
    try {
      const next = await getSpeakingAttempt(attemptId);
      setAttempt(next);
      setTranscript(next.transcript);
      clearRecordingPreview();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This speaking attempt could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError(null);
    setNotice(null);
    if (!attempt || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not available in this browser. Try the latest Safari or Chrome.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      setElapsed(0);
      clearRecordingPreview();
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => setError("The recording stopped unexpectedly. Please try again.");
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (!discardRef.current) {
          const type = recorder.mimeType || chunksRef.current[0]?.type || "audio/webm";
          const blob = new Blob(chunksRef.current, { type });
          if (blob.size) {
            setRecordedAudio(blob);
            previewUrlRef.current = URL.createObjectURL(blob);
            setPreviewUrl(previewUrlRef.current);
          }
          else setError("No audio was captured. Check microphone access and try again.");
        }
        chunksRef.current = [];
      };
      recorder.start(500);
      setRecording(true);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Microphone access was denied. Allow microphone access in your browser settings to record an answer."
        : "The microphone could not be started. Check your device settings and try again.");
    }
  }

  function stopRecording(discard = false) {
    discardRef.current = discard;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function uploadRecording() {
    if (!attempt || !recordedAudio || !consent) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await transcribeSpeakingAttempt(attempt.id, recordedAudio);
      setAttempt(next);
      setTranscript(next.transcript);
      setRecordedAudio(null);
      setConsent(false);
      setNotice("Transcript ready. Review and edit it before requesting feedback.");
      await refreshHistory().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The recording could not be transcribed.");
      try { const fresh = await getSpeakingAttempt(attempt.id); setAttempt(fresh); } catch { /* Keep the upload error visible. */ }
      await refreshHistory().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function saveTranscript() {
    if (!attempt) return null;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSpeakingTranscript(attempt.id, attempt.version, transcript);
      setAttempt(saved);
      setTranscript(saved.transcript);
      setNotice("Transcript saved.");
      await refreshHistory().catch(() => undefined);
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transcript could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function requestFeedback() {
    if (!attempt) return;
    let current = attempt;
    if (transcript.trim() !== attempt.transcript.trim()) {
      const saved = await saveTranscript();
      if (!saved) return;
      current = saved;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const graded = await gradeSpeakingAttempt(current.id, current.version);
      setAttempt(graded);
      setTranscript(graded.transcript);
      setNotice("Feedback is ready.");
      await refreshHistory().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI feedback could not be generated.");
      try { setAttempt(await getSpeakingAttempt(current.id)); } catch { /* Keep the feedback error visible. */ }
      await refreshHistory().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  const canEdit = attempt?.status === "ready" || attempt?.status === "graded" || (attempt?.status === "failed" && Boolean(attempt.transcript));
  const transcriptChanged = Boolean(attempt && transcript.trim() !== attempt.transcript.trim());
  return <main className={styles.page}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>SPEAK ONE ANSWER AT A TIME</p><h2>Speaking practice</h2><p>Answer a short everyday or IELTS Part 1 question, then learn from your transcript.</p></div>
      {usage && <div className={styles.quota} aria-label={`${usage.remaining} of ${usage.daily_limit} practice attempts remaining`}><strong>{usage.remaining}</strong><span>of {usage.daily_limit} today</span></div>}
    </div>
    <div className={styles.notice}><strong>Transcript-based feedback</strong><span>AI reviews your answer’s relevance, organization, vocabulary, and grammar. It does not score pronunciation or provide an official IELTS band.</span></div>
    {error && <div className={styles.error} role="alert">{error}</div>}
    {notice && <div className={styles.success} role="status" aria-live="polite">{notice}</div>}

    {attempt ? <section className={styles.practiceCard} aria-labelledby="speaking-question-title">
      <div className={styles.practiceTop}><div><span className={styles.category}>{attempt.prompt_snapshot.category === "ielts_part1" ? "IELTS SPEAKING PART 1" : "EVERYDAY CONVERSATION"}</span><h3 id="speaking-question-title">{attempt.prompt_snapshot.title_en}</h3></div><button type="button" className={styles.textButton} disabled={busy || recording} onClick={() => { setAttempt(null); clearRecordingPreview(); setError(null); }}>Choose another topic</button></div>
      <p className={styles.question}>{attempt.prompt_snapshot.question_en}</p>
      <p className={styles.translation} lang="vi">{attempt.prompt_snapshot.question_vi}</p>
      <div className={styles.hints}><strong>Ideas to help you answer</strong><ul>{attempt.prompt_snapshot.hints.map((hint, index) => <li key={`${attempt.id}-hint-${index}`}><span>{hint.en}</span><span lang="vi">{hint.vi}</span></li>)}</ul></div>

      {!attempt.transcript && <div className={styles.recording}>
        <div className={styles.recordRow}><button type="button" className={recording ? styles.stopButton : styles.recordButton} disabled={busy || (usage !== null && usage.remaining <= 0 && !attempt.quota_consumed)} onClick={() => recording ? stopRecording() : void startRecording()} aria-label={recording ? "Stop recording" : "Start recording"}>{recording ? "Stop recording" : "Start recording"}</button><span aria-live="polite">{recording ? `Recording · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} / 2:00` : "Maximum recording time: 2 minutes"}</span></div>
        {recording && <button type="button" className={styles.textButton} onClick={() => stopRecording(true)}>Cancel recording</button>}
        {recordedAudio && <div className={styles.uploadBox}>
          {previewUrl && <audio controls preload="metadata" src={previewUrl} aria-label="Preview your recorded answer" />}
          <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to send this audio to Google Gemini for transcription. Google may use content submitted on its free tier to improve its services. This app does not save the audio.</span></label>
          <div className={styles.recordRow}><button type="button" className={styles.primaryButton} disabled={busy || !consent} onClick={() => void uploadRecording()}>{busy ? "Transcribing…" : "Send for transcription"}</button><button type="button" className={styles.textButton} disabled={busy} onClick={clearRecordingPreview}>Discard recording</button></div>
        </div>}
      </div>}

      {attempt.status === "transcribing" && <p className={styles.loading} role="status">Transcribing your answer…</p>}
      {attempt.error_code === "transcription_timeout" && <p className={styles.warning} role="status">Transcription was interrupted. Your audio was not saved; record your answer again.</p>}
      {attempt.error_code === "grading_timeout" && <p className={styles.warning} role="status">The previous review timed out. Your transcript is saved; try again when ready.</p>}

      {attempt.transcript && <div className={styles.transcriptCard}>
        <label htmlFor="speaking-transcript">Your transcript</label>
        <textarea id="speaking-transcript" value={transcript} maxLength={4000} disabled={busy || !canEdit} onChange={(event) => setTranscript(event.target.value)} />
        <div className={styles.transcriptActions}><span>{transcript.length} / 4,000 characters</span><div>{canEdit && transcriptChanged && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void saveTranscript()}>{busy ? "Saving…" : "Save transcript"}</button>}<button type="button" className={styles.primaryButton} disabled={busy || !transcript.trim() || attempt.status === "grading" || attempt.status === "graded" && !transcriptChanged} onClick={() => void requestFeedback()}>{busy ? "Reviewing…" : attempt.status === "graded" ? "Refresh feedback" : "Get AI feedback"}</button></div></div>
      </div>}
      {attempt.status === "grading" && <p className={styles.loading} role="status" aria-live="polite">Your answer is being reviewed. This may take a little while.</p>}
      {attempt.feedback && <FeedbackPanel feedback={attempt.feedback} />}
    </section> : <>
      <section className={styles.topicSection} aria-labelledby="speaking-topics-title"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>BEGINNER-FRIENDLY QUESTIONS</p><h3 id="speaking-topics-title">Choose a topic</h3><p className={styles.topicIntro}>Pick a practice question or let AI create a fresh one with bilingual hints.</p></div><button type="button" className={styles.generateTopicButton} disabled={busy || loading} onClick={() => void generateTopic()} aria-busy={busy}>{busy ? <><span className={styles.generateIcon} aria-hidden="true">◌</span>Creating topic…</> : <><span className={styles.generateIcon} aria-hidden="true">✦</span>Generate a topic with AI</>}</button></div>
        {loading ? <div className={styles.loading} role="status">Loading speaking topics…</div> : prompts.length === 0 ? <div className={styles.empty}>No speaking topics are available yet.</div> : <div className={styles.topicGrid}>{prompts.map((prompt) => <article key={prompt.id} className={styles.topicCard}><span className={styles.category}>{prompt.category === "ielts_part1" ? "IELTS PART 1" : "CONVERSATION"}</span><h4>{prompt.title_en}</h4><p>{prompt.question_en}</p><p className={styles.translation} lang="vi">{prompt.question_vi}</p><button type="button" className={styles.secondaryButton} disabled={busy || (usage !== null && usage.remaining <= 0)} onClick={() => void startAttempt(prompt)}>{busy ? "Starting…" : "Practice this question"}</button></article>)}</div>}
      </section>
    </>}

    <section className={styles.history} aria-labelledby="speaking-history-title"><div className={styles.sectionHeader}><div><p className={styles.eyebrow}>YOUR SAVED TRANSCRIPTS & REVIEWS</p><h3 id="speaking-history-title">Speaking history</h3></div><span>{history.length} recent</span></div>
      {history.length === 0 ? <div className={styles.empty}>Your completed speaking practice will appear here.</div> : <ul className={styles.historyList}>{history.map((item) => <li key={item.id}><button type="button" disabled={busy} onClick={() => void openAttempt(item.id)}><span><strong>{item.title_en}</strong><small>{new Date(item.created_at).toLocaleDateString()} · {item.category === "ielts_part1" ? "IELTS Part 1" : "Conversation"}</small></span><span className={styles.status}>{item.status.replaceAll("_", " ")}</span></button></li>)}</ul>}
      <Link className={styles.writingLink} href="/ai-support?tab=writing">Go to Writing practice</Link>
    </section>
  </main>;
}

function FeedbackPanel({ feedback }: { feedback: SpeakingFeedback }) {
  const criteria: { key: keyof Pick<SpeakingFeedback, "relevance" | "coherence" | "vocabulary" | "grammar">; label: string }[] = [
    { key: "relevance", label: "Answer relevance" }, { key: "coherence", label: "Organization" },
    { key: "vocabulary", label: "Vocabulary" }, { key: "grammar", label: "Grammar" },
  ];
  return <section className={styles.feedback} aria-labelledby="speaking-feedback-title"><div className={styles.feedbackHeading}><div><p className={styles.eyebrow}>LANGUAGE FEEDBACK</p><h3 id="speaking-feedback-title">Your review</h3></div></div>
    <div className={styles.summary}><p>{feedback.summary_en}</p><p lang="vi">{feedback.summary_vi}</p></div>
    <div className={styles.criteria}>{criteria.map(({ key, label }) => <article key={key}><div><strong>{label}</strong><span>{feedback[key].score.toFixed(1)} / 10</span></div><p>{feedback[key].feedback_en}</p><p lang="vi">{feedback[key].feedback_vi}</p></article>)}</div>
    {feedback.strengths.length > 0 && <div className={styles.strengths}><strong>What you did well</strong><ul>{feedback.strengths.map((strength, index) => <li key={index}><span>{strength.en}</span><span lang="vi">{strength.vi}</span></li>)}</ul></div>}
    {feedback.improvements.length > 0 && <div className={styles.improvements}><strong>Ways to improve</strong>{feedback.improvements.map((item, index) => <article key={`${item.quote}-${index}`}><blockquote>“{item.quote}”</blockquote><p><strong>Try:</strong> {item.suggestion_en}</p><p lang="vi"><strong>Gợi ý:</strong> {item.suggestion_vi}</p><p>{item.reason_en}</p><p lang="vi">{item.reason_vi}</p></article>)}</div>}
    <div className={styles.nextSteps}><strong>Next steps</strong><ul>{feedback.next_steps.map((step, index) => <li key={index}><span>{step.en}</span><span lang="vi">{step.vi}</span></li>)}</ul></div>
    <p className={styles.disclaimer}>Practice feedback only. It is not an official IELTS score and does not assess pronunciation.</p>
  </section>;
}
