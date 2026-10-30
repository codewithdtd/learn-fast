"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { YouTubePlayer, type YouTubeController } from "@/components/video-practice/youtube-player";
import { useAuth } from "@/context/auth-context";
import { consumeIELTSPracticePrefill } from "@/lib/ielts-practice-prefill";
import { ApiRequestError, createIELTSSample, createIELTSSource, createIELTSTestSet, deleteIELTSTestSet, getIELTSAttempt, getIELTSAttempts,
  getIELTSReading, getIELTSTestSet, getIELTSTestSets, saveIELTSAnswers,
  startIELTSAttempt, submitIELTSAttempt, type TranscriptSegment } from "@/services/api";
import type { IELTSAttempt, IELTSQuestion, IELTSSkill, IELTSSource, IELTSTestSet } from "@/types/ielts";
import styles from "./ielts-practice.module.css";

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function highlighted(text: string, quote: string) {
  const index = quote ? text.indexOf(quote) : -1;
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{quote}</mark>{text.slice(index + quote.length)}</>;
}

function mergeById<T extends { id: number }>(current: T[], incoming: T[]): T[] {
  const items = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) items.set(item.id, item);
  return [...items.values()].sort((left, right) => right.id - left.id);
}

const HISTORY_PAGE_SIZE = 20;

export function IELTSPractice() {
  const { isAuthenticated, user } = useAuth();
  const [sourceType, setSourceType] = useState<"text" | "video">("video");
  const [text, setText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [transcriptTicket, setTranscriptTicket] = useState<string | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(180);
  const [source, setSource] = useState<IELTSSource | null>(null);
  const [skills, setSkills] = useState<"reading" | "listening" | "both">("both");
  const [count, setCount] = useState<5 | 10>(5);
  const [testSet, setTestSet] = useState<IELTSTestSet | null>(null);
  const [history, setHistory] = useState<IELTSTestSet[]>([]);
  const [attemptHistory, setAttemptHistory] = useState<IELTSAttempt[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [attemptOffset, setAttemptOffset] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [hasMoreAttempts, setHasMoreAttempts] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [loadingMoreAttempts, setLoadingMoreAttempts] = useState(false);
  const [attempt, setAttempt] = useState<IELTSAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [readingText, setReadingText] = useState<string | null>(null);
  const [readingSegments, setReadingSegments] = useState<TranscriptSegment[]>([]);
  const [view, setView] = useState<"questions" | "passage">("questions");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const playerRef = useRef<YouTubeController | null>(null);
  const passageRef = useRef<HTMLDivElement | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const busyRef = useRef(false);
  const generationKeyRef = useRef<{ scope: string; key: string } | null>(null);
  const onPlayerReady = useCallback((controller: YouTubeController) => { playerRef.current = controller; }, []);
  const onPlayerError = useCallback((message: string) => setPlayerError(message), []);
  const onTimeUpdate = useCallback(() => {}, []);

  useEffect(() => {
    let live = true;
    void Promise.all([getIELTSTestSets(20, 0), getIELTSAttempts(20, 0)]).then(([sets, attempts]) => {
      if (live) {
        setHistory(sets.items); setHistoryOffset(sets.items.length); setHasMoreHistory(sets.has_more);
        setAttemptHistory(attempts.items); setAttemptOffset(attempts.items.length); setHasMoreAttempts(attempts.has_more);
      }
    }).catch(() => {});
    return () => { live = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    const prefill = consumeIELTSPracticePrefill();
    if (!prefill) return;
    // Consume same-tab transfer once, and leave source loading as an explicit learner action.
    /* eslint-disable react-hooks/set-state-in-effect -- external sessionStorage state must seed the client form after mount. */
    if (prefill.kind === "video") {
      setSourceType("video"); setVideoUrl(prefill.video_url); setTranscriptTicket(prefill.transcript_ticket);
      setSkills("both"); setStart(0); setEnd(180);
      setPrefillNotice("Video and captions came from Video Practice. Choose a clip, then load it to prepare the test.");
    } else {
      setSourceType("text"); setText(prefill.text); setTranscriptTicket(null); setSkills("reading");
      setPrefillNotice("The source passage came from your reading article. Review its length, then load it to prepare a Reading test.");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!attempt || attempt.status !== "draft") return;
    // Chờ người học gõ xong rồi lưu một bản nháp; không gọi AI trên mỗi ký tự.
    draftTimerRef.current = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        await saveIELTSAnswers(attempt.id, answers);
      }).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Your draft could not be saved.");
      });
    }, 750);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [answers, attempt]);

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "This request could not be completed."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function loadMoreSets() {
    if (loadingMoreHistory || !hasMoreHistory) return;
    setLoadingMoreHistory(true);
    setError(null);
    try {
      const page = await getIELTSTestSets(HISTORY_PAGE_SIZE, historyOffset);
      setHistory((current) => mergeById(current, page.items));
      setHistoryOffset(page.offset + page.items.length);
      setHasMoreHistory(page.has_more);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "More practice sets could not be loaded.");
    } finally {
      setLoadingMoreHistory(false);
    }
  }

  async function loadMoreAttempts() {
    if (loadingMoreAttempts || !hasMoreAttempts) return;
    setLoadingMoreAttempts(true);
    setError(null);
    try {
      const page = await getIELTSAttempts(HISTORY_PAGE_SIZE, attemptOffset);
      setAttemptHistory((current) => mergeById(current, page.items));
      setAttemptOffset(page.offset + page.items.length);
      setHasMoreAttempts(page.has_more);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "More practice attempts could not be loaded.");
    } finally {
      setLoadingMoreAttempts(false);
    }
  }

  function changeType(value: "text" | "video") {
    setSourceType(value);
    setSkills(value === "video" ? "both" : "reading");
    setSource(null);
    setTranscriptTicket(null);
    setPrefillNotice(null);
    generationKeyRef.current = null;
    setTestSet(null);
    setAttempt(null);
  }

  async function loadSource() {
    await run(async () => {
      const result = await createIELTSSource(sourceType === "text"
        ? { source_type: "text", text }
        : { source_type: "video", video_url: videoUrl, start_seconds: start, end_seconds: end,
            ...(transcriptTicket ? { transcript_ticket: transcriptTicket } : {}) });
      setSource(result);
      generationKeyRef.current = null;
      setTestSet(null);
      setAttempt(null);
    });
  }

  async function generate() {
    if (!source) return;
    await run(async () => {
      const scope = `${source.id}:${skills}:${count}`;
      if (generationKeyRef.current?.scope !== scope) generationKeyRef.current = { scope, key: crypto.randomUUID() };
      let result: IELTSTestSet;
      try {
        result = await createIELTSTestSet(source.id, skills, count, generationKeyRef.current.key);
      } catch (cause) {
        // Definitive provider/server failures leave a failed row for this key; a new click must create a retry, not replay it.
        if (cause instanceof ApiRequestError && [429, 500, 502, 503, 504].includes(cause.status)) generationKeyRef.current = null;
        throw cause;
      }
      setTestSet(result);
      if (!history.some((item) => item.id === result.id)) {
        setHistoryOffset((current) => current + 1);
      }
      setHistory((current) => [result, ...current.filter((item) => item.id !== result.id)]);
    });
  }

  async function trySample() {
    await run(async () => {
      const result = await createIELTSSample();
      setTestSet(result);
      setSource(result.source);
      setAttempt(null);
      if (!history.some((item) => item.id === result.id)) {
        setHistoryOffset((current) => current + 1);
      }
      setHistory((current) => [result, ...current.filter((item) => item.id !== result.id)]);
    });
  }

  async function openTest(item: IELTSTestSet) {
    await run(async () => {
      const result = await getIELTSTestSet(item.id);
      setTestSet(result);
      setSource(result.source);
      setAttempt(null);
      setReadingText(null);
      setReadingSegments([]);
      setEvidence("");
    });
  }

  async function removeTest() {
    if (!testSet || !window.confirm("Delete this practice set and its attempts?")) return;
    await run(async () => {
      await deleteIELTSTestSet(testSet.id);
      if (history.some((item) => item.id === testSet.id)) setHistoryOffset((current) => Math.max(0, current - 1));
      setHistory((current) => current.filter((item) => item.id !== testSet.id));
      setAttemptHistory((current) => current.filter((item) => item.test_set_id !== testSet.id));
      setTestSet(null);
      setAttempt(null);
      setSource(null);
    });
  }

  async function begin(skill: IELTSSkill, oldAttempt?: IELTSAttempt) {
    if (!testSet) return;
    await run(async () => {
      const passage = skill === "reading" ? await getIELTSReading(testSet.id) : null;
      const next = oldAttempt ? await getIELTSAttempt(oldAttempt.id) : await startIELTSAttempt(testSet.id, skill);
      setReadingText(passage?.text ?? null);
      setReadingSegments(passage?.segments ?? []);
      setAttempt(next);
      if (!attemptHistory.some((item) => item.id === next.id)) {
        setAttemptOffset((current) => current + 1);
      }
      setAttemptHistory((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setAnswers(next.answers);
      setView("questions");
      setEvidence("");
      if (skill === "reading") setTestSet((current) => current ? { ...current, source: { ...current.source, reading_opened: true } } : current);
    });
  }

  async function submit() {
    if (!attempt) return;
    await run(async () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      await saveQueueRef.current;
      await saveIELTSAnswers(attempt.id, answers);
      const completed = await submitIELTSAttempt(attempt.id);
      setAttempt(completed);
      setAttemptHistory((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
    });
  }

  function showEvidence(quote: string) {
    setEvidence(quote);
    setView("passage");
    window.setTimeout(() => passageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  const questions = attempt ? testSet?.questions[attempt.skill] ?? [] : [];
  const videoSource = testSet?.source.source_type === "video" ? testSet.source : null;
  const readingParagraphs = readingSegments.length
    ? Array.from({ length: Math.ceil(readingSegments.length / 5) }, (_, index) =>
        readingSegments.slice(index * 5, (index + 1) * 5).map((segment) => segment.text).join(" "))
    : (readingText ?? "Loading passage…").split(/\n\s*\n/);
  const textWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const textSourceValid = textWordCount >= 150 && textWordCount <= 2000;
  const videoRangeValid = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end - start >= 60 && end - start <= 480;

  return <div className={styles.page}>
    <header className={styles.heading}>
      <span className={styles.kicker}>LISTEN · READ · UNDERSTAND</span>
      <h2>Build an IELTS-style practice test</h2>
      <p>Turn your own English passage or YouTube clip into focused questions with detailed explanations.</p>
    </header>

    {prefillNotice && <p className={styles.notice} role="status">{prefillNotice}</p>}

    {!testSet && <section className={styles.card} aria-label="Create a practice source">
      <div className={styles.choiceRow}>
        <button type="button" className={sourceType === "video" ? styles.selected : ""} onClick={() => changeType("video")}>YouTube video</button>
        <button type="button" className={sourceType === "text" ? styles.selected : ""} onClick={() => changeType("text")}>Paste passage</button>
      </div>
      {sourceType === "video" ? <>
        <label className={styles.field}>YouTube link<input type="url" value={videoUrl} onChange={(event) => { setVideoUrl(event.target.value); setTranscriptTicket(null); }} placeholder="https://www.youtube.com/watch?v=..." /></label>
        <div className={styles.timeFields}><label className={styles.field}>Start (seconds)<input type="number" min="0" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label>
        <label className={styles.field}>End (seconds)<input type="number" min="60" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div>
        <p className={styles.helper}>Choose 1–8 minutes of a public video with English captions. Video creates Listening from the audio and Reading from its transcript.{transcriptTicket ? " Reusing the captions already loaded in Video Practice." : ""}</p>
      </> : <><label className={styles.field}>English passage<textarea rows={8} maxLength={16000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste 150–2,000 English words here…" /></label>
        <p className={styles.helper}>{textWordCount} words · Enter 150–2,000 words. A pasted passage creates Reading only.</p></>}
      {sourceType === "video" && !videoRangeValid && <p className={styles.error} role="alert">Choose a video segment between 1 and 8 minutes.</p>}
      {sourceType === "text" && textWordCount > 0 && !textSourceValid && <p className={styles.error} role="alert">The passage must contain between 150 and 2,000 words.</p>}
      <div className={styles.sourceActions}><button className={styles.primary} type="button" disabled={busy || (sourceType === "text" ? !textSourceValid : !videoUrl.trim() || !videoRangeValid)} onClick={() => void loadSource()}>{busy ? "Loading source…" : "Load source"}</button><button className={styles.secondary} type="button" disabled={busy} onClick={() => void trySample()}>Try a sample Reading test</button></div>
      {source && <div className={styles.sourceReady} role="status"><strong>Source ready</strong><span>{source.word_count} words · {source.source_type === "video" ? "Listening + Reading" : "Reading"}</span></div>}
      {source && <div className={styles.generation}>
        {source.source_type === "video" && <label className={styles.field}>Generate<select value={skills} onChange={(event) => setSkills(event.target.value as "reading" | "listening" | "both")}><option value="both">Listening and Reading</option><option value="listening">Listening only</option><option value="reading">Reading only</option></select></label>}
        <label className={styles.field}>Questions per skill<select value={count} onChange={(event) => setCount(Number(event.target.value) as 5 | 10)}><option value={5}>5 questions</option><option value={10} disabled={source.word_count < 350}>10 questions</option></select></label>
        <p className={styles.helper}>The selected passage is sent to the AI provider to create questions and saved with your test history. Video captions are loaded from the transcript provider. Guest practice stays separate from user accounts.</p>
        <button className={styles.primary} type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Creating and checking questions…" : "Generate tests"}</button>
      </div>}
    </section>}

    {error && <p className={styles.error} role="alert">{error}</p>}
    {testSet && <section className={styles.card} aria-label="Practice test">
      <div className={styles.testHeader}><div><span className={styles.kicker}>YOUR PRACTICE SET</span><h3>{testSet.source.title}</h3><p>{testSet.source.word_count} words · {testSet.count_per_skill} questions per skill</p></div><div className={styles.testActions}><button type="button" className={styles.secondary} onClick={() => { setTestSet(null); setSource(null); setAttempt(null); }}>New source</button><button type="button" className={styles.secondary} disabled={busy} onClick={() => void removeTest()}>Delete set</button></div></div>
      {testSet.status !== "ready" ? <p className={styles.helper}>{testSet.status === "generating" ? "Test generation is in progress. Open this set from history to check its status." : "This test could not be generated. Try another source."}</p> : <>
        <div className={styles.skillCards}>{(["listening", "reading"] as const).filter((skill) => testSet.questions[skill]?.length).map((skill) => <button type="button" key={skill} className={attempt?.skill === skill ? styles.skillActive : styles.skillCard} onClick={() => void begin(skill)} disabled={busy}>
          <span aria-hidden="true">{skill === "listening" ? "♫" : "▤"}</span><strong>{skill === "listening" ? "Listening" : "Reading"}</strong><small>{testSet.questions[skill]?.length} questions · Start or try again</small>
        </button>)}</div>
        {attempt?.skill === "listening" && videoSource?.video_id && <div className={styles.stickyVideo}>
          <YouTubePlayer key={videoSource.video_id} videoId={videoSource.video_id} onReady={onPlayerReady} onError={onPlayerError} onTimeUpdate={onTimeUpdate} />
          <p className={styles.videoCaption}>Listen to {formatTime(videoSource.start_seconds ?? 0)}–{formatTime(videoSource.end_seconds ?? 0)}. The transcript appears after submission or in Reading.</p>
          <button type="button" className={styles.secondary} onClick={() => playerRef.current?.playSegment(videoSource.start_seconds ?? 0, (videoSource.end_seconds ?? 180) - (videoSource.start_seconds ?? 0))}>Play selected clip</button>
          {playerError && <p className={styles.error} role="alert">{playerError}</p>}
        </div>}
        {attempt?.skill === "listening" && testSet.source.reading_opened && <p className={styles.notice}>You have opened the transcript for this video. Your Listening score is practice after reading.</p>}
        {attempt?.skill === "reading" && <div className={styles.mobileSwitch}><button type="button" aria-pressed={view === "questions"} onClick={() => setView("questions")}>Questions</button><button type="button" aria-pressed={view === "passage"} onClick={() => setView("passage")}>Passage</button></div>}
        {attempt && <div className={attempt.skill === "reading" ? styles.readingLayout : styles.listeningLayout}>
          {attempt.skill === "reading" && <div ref={passageRef} className={`${styles.passage} ${view !== "passage" ? styles.mobileHiddenPassage : ""}`} lang="en" aria-label="Reading passage">
            <span className={styles.kicker}>SOURCE PASSAGE</span>
            {readingParagraphs.map((paragraph, index) => <p key={index}>{highlighted(paragraph, evidence)}</p>)}
          </div>}
          <div className={`${styles.questionList} ${attempt.skill === "reading" && view !== "questions" ? styles.mobileHiddenQuestions : ""}`}>
            <div className={styles.progress}><span>{attempt.status === "submitted" ? `Score ${attempt.score}/${attempt.total} · ${attempt.total - (attempt.score ?? 0)} missed` : `${Object.values(answers).filter(Boolean).length}/${questions.length} answered`}</span><span>{attempt.skill === "reading" ? "Reading" : "Listening"}</span></div>
            {questions.map((question: IELTSQuestion, index) => {
              const review = attempt.review?.find((item) => item.id === question.id);
              return <div className={styles.question} key={question.id}>
                <div className={styles.questionHeading}><span className={styles.number}>{index + 1}</span><h4>{question.prompt}</h4></div>
                {question.type === "completion" ? <label className={styles.field}>Your answer · max {question.max_words} words<input type="text" value={answers[question.id] ?? ""} disabled={attempt.status === "submitted"} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} /></label>
                  : <div className={styles.options}>{(question.type === "multiple_choice" ? question.options : ["TRUE", "FALSE", "NOT GIVEN"].map((value) => ({ id: value, text: value }))).map((option) => <label className={styles.option} key={option.id} data-selected={answers[question.id] === option.id}>
                    <input type="radio" name={`ielts-${attempt.id}-${question.id}`} value={option.id} checked={answers[question.id] === option.id} disabled={attempt.status === "submitted"} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} />{option.text}</label>)}</div>}
                {review && <div className={review.correct ? styles.correct : styles.incorrect}>
                  <strong>{review.correct ? "Correct" : answers[question.id] ? "Needs review" : "Not answered"}</strong>
                  {!review.correct && answers[question.id] && <p><b>Your answer:</b> <del>{question.options.find((option) => option.id === answers[question.id])?.text ?? answers[question.id]}</del></p>}
                  <p><b>Accepted answer:</b> <ins>{question.options.find((option) => option.id === review.answer)?.text ?? review.answer}</ins></p><p>{review.explanation_en}</p><p lang="vi">{review.explanation_vi}</p>
                  {question.type === "multiple_choice" && Object.entries(review.distractor_explanations).map(([key, reason]) => <p key={key}><b>{key}:</b> {reason}</p>)}
                  {review.evidence_quote && <><blockquote>{review.evidence_quote}</blockquote>{attempt.skill === "listening" && review.evidence_start !== null && review.evidence_duration !== null
                    ? <button type="button" className={styles.evidenceButton} onClick={() => playerRef.current?.playSegment(review.evidence_start!, review.evidence_duration!)}>Replay evidence</button>
                    : <button type="button" className={styles.evidenceButton} onClick={() => showEvidence(review.evidence_quote)}>Show in passage</button>}</>}
                </div>}
              </div>;
            })}
            {attempt.status === "draft" && <button type="button" className={styles.primary} disabled={busy} onClick={() => void submit()}>{busy ? "Submitting…" : `Submit ${attempt.skill} answers`}</button>}
            {attempt.status === "submitted" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void begin(attempt.skill)}>Try this test again</button>}
          </div>
        </div>}
      </>}
    </section>}
    {history.length > 0 && <section className={styles.history}><h3>Practice sets</h3><div>{history.map((item) => <button type="button" key={item.id} onClick={() => void openTest(item)} disabled={busy}><strong>{item.source.title}</strong><span>{item.skills} · {item.status} · {item.source.word_count} words</span></button>)}</div>{hasMoreHistory && <button type="button" className={styles.secondary} disabled={loadingMoreHistory} onClick={() => void loadMoreSets()}>{loadingMoreHistory ? "Loading…" : "Load more practice sets"}</button>}</section>}
    {attemptHistory.length > 0 && <section className={styles.history}><h3>Your attempts</h3><div>{attemptHistory.map((item) => <button type="button" key={item.id} disabled={busy} onClick={() => void run(async () => {
      const related = await getIELTSTestSet(item.test_set_id);
      setTestSet(related);
      setSource(related.source);
      const passage = item.skill === "reading" ? await getIELTSReading(related.id) : null;
      const saved = await getIELTSAttempt(item.id);
      setAttempt(saved);
      setAnswers(saved.answers);
      setReadingText(passage?.text ?? null);
      setReadingSegments(passage?.segments ?? []);
      setView("questions");
    })}><strong>{item.skill === "reading" ? "Reading" : "Listening"} · {item.status}</strong><span>{item.status === "submitted" ? `Score ${item.score}/${item.total}` : `${Object.keys(item.answers).length}/${item.total} answered`}</span></button>)}</div>{hasMoreAttempts && <button type="button" className={styles.secondary} disabled={loadingMoreAttempts} onClick={() => void loadMoreAttempts()}>{loadingMoreAttempts ? "Loading…" : "Load more attempts"}</button>}</section>}
    {!isAuthenticated && <p className={styles.helper}>Guest AI generation is limited to one trial. Sign in to keep your history tied to your account. Only administrators have unlimited app trials.</p>}
    {isAuthenticated && !user?.is_superuser && <p className={styles.helper}>Your account includes one AI test generation trial. Only administrators have unlimited app trials.</p>}
  </div>;
}
