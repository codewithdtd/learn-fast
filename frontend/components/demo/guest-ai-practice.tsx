"use client";

import { useEffect, useState } from "react";
import { DEMO_CARDS } from "@/lib/demo-data";
import {
  generateAICards, generateGuestSpeakingTopic, generateGuestWritingTopic,
  getSpeakingPrompts, getWritingPrompts, gradeGuestSentence, gradeGuestSpeaking,
  gradeGuestWriting, type AIGeneratedCardItem,
} from "@/services/api";
import type { WritingFeedback, WritingPrompt } from "@/types/writing";
import type { SpeakingFeedback, SpeakingPrompt } from "@/types/speaking";
import styles from "./public-demo.module.css";
import { VideoPractice } from "@/components/video-practice/video-practice";
import { IELTSPractice } from "@/components/ielts/ielts-practice";

type GuestAITab = "cards" | "writing" | "speaking" | "sentence" | "video" | "ielts";

export function GuestAIPractice({ initialVideo = false }: { initialVideo?: boolean }) {
  const [tab, setTab] = useState<GuestAITab>(initialVideo ? "video" : "cards");
  const [writingPrompts, setWritingPrompts] = useState<WritingPrompt[]>([]);
  const [speakingPrompts, setSpeakingPrompts] = useState<SpeakingPrompt[]>([]);
  const [writingPromptId, setWritingPromptId] = useState<number | null>(null);
  const [speakingPromptId, setSpeakingPromptId] = useState<number | null>(null);
  const [writingText, setWritingText] = useState("");
  const [spokenTranscript, setSpokenTranscript] = useState("");
  const [sentence, setSentence] = useState("");
  const [cards, setCards] = useState<AIGeneratedCardItem[] | null>(null);
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null);
  const [speakingFeedback, setSpeakingFeedback] = useState<SpeakingFeedback | null>(null);
  const [sentenceFeedback, setSentenceFeedback] = useState<WritingFeedback | null>(null);
  const [writingTopic, setWritingTopic] = useState<string | null>(null);
  const [speakingTopic, setSpeakingTopic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([getWritingPrompts(), getSpeakingPrompts()]).then(([writing, speaking]) => {
      setWritingPrompts(writing.items);
      setSpeakingPrompts(speaking.items);
      setWritingPromptId(writing.items[0]?.id ?? null);
      setSpeakingPromptId(speaking.items[0]?.id ?? null);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "AI practice topics could not be loaded."));
  }, []);

  async function run<T>(action: () => Promise<T>, save: (value: T) => void) {
    setBusy(true);
    setError(null);
    try { save(await action()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The guest AI trial could not be completed."); }
    finally { setBusy(false); }
  }

  const activeWritingPrompt = writingPrompts.find((item) => item.id === writingPromptId);
  const activeSpeakingPrompt = speakingPrompts.find((item) => item.id === speakingPromptId);
  return <section className={styles.card} aria-labelledby="guest-ai-heading">
    <div><p className={styles.eyebrow}>AI FEATURES · GUEST TRIALS</p><h2 id="guest-ai-heading">Try the AI tools</h2>
      <p>Each AI tool has one guest trial. Your drafts and feedback stay in this page and are not saved to an account.</p></div>
    <div className={styles.aiTabs} role="tablist" aria-label="Guest AI tools">
      {([ ["cards", "Flashcards"], ["writing", "Writing"], ["speaking", "Speaking"], ["sentence", "Sentences"], ["video", "Video"], ["ielts", "IELTS Practice"] ] as const).map(([value, label]) =>
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setError(null); }}>{label}</button>)}
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {tab === "ielts" && <IELTSPractice />}
    {tab === "cards" && <div className={styles.aiPanel}>
      <p>Generate a small vocabulary sample. It will not be added to a workbook.</p>
      <button className={styles.primary} type="button" disabled={busy || cards !== null} onClick={() => void run(() => generateAICards({ count: 5, topic: "Everyday English conversations", level: "Beginner A1-A2" }), (result) => setCards(result.cards))}>{busy ? "Generating…" : cards ? "Guest trial used" : "Generate sample cards"}</button>
      {cards && <div className={styles.previewWords}>{cards.map((card) => <p key={card.phrase}><strong>{card.phrase}</strong><span lang="vi">{card.meaning}</span><small>{card.example_en}</small></p>)}</div>}
    </div>}
    {tab === "writing" && <div className={styles.aiPanel}>
      <label>Practice topic<select value={writingPromptId ?? ""} onChange={(event) => { setWritingPromptId(Number(event.target.value)); setWritingFeedback(null); }}><option value="" disabled>Select a topic</option>{writingPrompts.map((item) => <option key={item.id} value={item.id}>{item.title_en}</option>)}</select></label>
      {activeWritingPrompt && <div className={styles.prompt}><strong>{activeWritingPrompt.prompt_en}</strong><p lang="vi">{activeWritingPrompt.prompt_vi}</p></div>}
      <label>Your paragraph<textarea rows={5} maxLength={4000} value={writingText} onChange={(event) => setWritingText(event.target.value)} placeholder="Write a short paragraph in English…" /></label>
      <div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy || writingTopic !== null} onClick={() => void run(generateGuestWritingTopic, (topic) => setWritingTopic(topic.prompt_en))}>{busy ? "Preparing…" : writingTopic ? "Topic trial used" : "Generate a fresh topic"}</button><button className={styles.primary} type="button" disabled={busy || !writingPromptId || !writingText.trim() || writingFeedback !== null} onClick={() => void run(() => gradeGuestWriting(writingPromptId!, writingText), setWritingFeedback)}>{busy ? "Reviewing…" : writingFeedback ? "Feedback trial used" : "Get AI feedback"}</button></div>
      {writingTopic && <p className={styles.prompt}><strong>AI topic:</strong> {writingTopic}</p>}
      {writingFeedback && <FeedbackSummary title="Writing feedback" summary={writingFeedback.summary_en} detail={writingFeedback.summary_vi} score={`${writingFeedback.practice_score}/10`} issues={writingFeedback.issues.map((issue) => `${issue.quote} → ${issue.replacement || issue.explanation_en}`)} />}
    </div>}
    {tab === "speaking" && <div className={styles.aiPanel}>
      <label>Practice question<select value={speakingPromptId ?? ""} onChange={(event) => { setSpeakingPromptId(Number(event.target.value)); setSpeakingFeedback(null); }}><option value="" disabled>Select a question</option>{speakingPrompts.map((item) => <option key={item.id} value={item.id}>{item.title_en}</option>)}</select></label>
      {activeSpeakingPrompt && <div className={styles.prompt}><strong>{activeSpeakingPrompt.question_en}</strong><p lang="vi">{activeSpeakingPrompt.question_vi}</p><ul>{activeSpeakingPrompt.hints.map((hint) => <li key={hint.en}>{hint.en} · {hint.vi}</li>)}</ul></div>}
      <label>Your answer transcript<textarea rows={4} maxLength={4000} value={spokenTranscript} onChange={(event) => setSpokenTranscript(event.target.value)} placeholder="Type what you would say in English…" /></label>
      <div className={styles.actions}><button className={styles.secondary} type="button" disabled={busy || speakingTopic !== null} onClick={() => void run(generateGuestSpeakingTopic, (topic) => setSpeakingTopic(topic.question_en))}>{busy ? "Preparing…" : speakingTopic ? "Topic trial used" : "Generate a fresh question"}</button><button className={styles.primary} type="button" disabled={busy || !speakingPromptId || !spokenTranscript.trim() || speakingFeedback !== null} onClick={() => void run(() => gradeGuestSpeaking(speakingPromptId!, spokenTranscript), setSpeakingFeedback)}>{busy ? "Reviewing…" : speakingFeedback ? "Feedback trial used" : "Review transcript once"}</button></div>
      {speakingTopic && <p className={styles.prompt}><strong>AI question:</strong> {speakingTopic}</p>}
      {speakingFeedback && <FeedbackSummary title="Speaking feedback" summary={speakingFeedback.summary_en} detail={speakingFeedback.summary_vi} score={`${speakingFeedback.relevance.score}/10 relevance`} issues={speakingFeedback.improvements.map((item) => `${item.quote} → ${item.suggestion_en}`)} />}
    </div>}
    {tab === "sentence" && <div className={styles.aiPanel}>
      <div className={styles.prompt}><strong>Target phrase:</strong> {DEMO_CARDS[0].phrase}<p lang="vi">{DEMO_CARDS[0].meaning}</p><span>Write one original sentence about making plans with a friend.</span></div>
      <label>Your sentence<textarea rows={3} maxLength={1000} value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder="Write one English sentence…" /></label>
      <button className={styles.primary} type="button" disabled={busy || !sentence.trim() || sentenceFeedback !== null} onClick={() => void run(() => gradeGuestSentence({ phrase: DEMO_CARDS[0].phrase, meaning: DEMO_CARDS[0].meaning, situation_en: "Write one sentence about making plans with a friend using the target phrase.", situation_vi: `Viết một câu về việc lên kế hoạch với bạn bè và dùng cụm từ “${DEMO_CARDS[0].phrase}”.`, sentence }), setSentenceFeedback)}>{busy ? "Reviewing…" : sentenceFeedback ? "Feedback trial used" : "Get AI sentence feedback"}</button>
      {sentenceFeedback && <FeedbackSummary title="Sentence feedback" summary={sentenceFeedback.summary_en} detail={sentenceFeedback.summary_vi} score={`${sentenceFeedback.practice_score}/10`} issues={sentenceFeedback.issues.map((issue) => `${issue.quote} → ${issue.replacement || issue.explanation_en}`)} />}
    </div>}
    {tab === "video" && <VideoPractice />}
  </section>;
}

function FeedbackSummary({ title, summary, detail, score, issues }: { title: string; summary: string; detail: string; score: string; issues: string[] }) {
  return <section className={styles.feedback} aria-label={title}><strong>{title} · {score}</strong><p>{summary}</p><p lang="vi">{detail}</p>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>}</section>;
}
