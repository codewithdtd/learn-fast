"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { isSpeechSupported, speakEnglish } from "@/lib/speech";
import {
  createDictationGapPrompt,
  evaluateDictationGaps,
  findTranscriptSegmentIndex,
  getTranscriptSegmentPlaybackDuration,
  normalizeDictationAnswer,
  splitTranscriptText,
  type DictationGapPrompt,
} from "@/lib/video-practice";
import {
  ApiRequestError,
  createFlashcardInSheet,
  getWorkbook,
  getWorkbooks,
  getVideoTranscript,
  lookupVideoWord,
  type TranscriptSegment,
  type VideoTranscript,
  type WordLookup,
  type WorkbookDetail,
  type WorkbookListItem,
} from "@/services/api";
import { YouTubePlayer, type YouTubeController } from "./youtube-player";
import styles from "./video-practice.module.css";

type PracticeMode = "shadowing" | "dictation";
type DictationMode = "full_sentence" | "fill_gaps";
type SelectedWord = { term: string; context: string; canSaveToSheet: boolean };

export function VideoPractice() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.is_superuser === true;
  const [videoUrl, setVideoUrl] = useState("");
  const [language, setLanguage] = useState("en");
  const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
  const [mode, setMode] = useState<PracticeMode>("shadowing");
  const [dictationMode, setDictationMode] = useState<DictationMode>("full_sentence");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerController, setPlayerController] = useState<YouTubeController | null>(null);
  const [playerVolume, setPlayerVolume] = useState(100);
  const playerAnchorRef = useRef<HTMLDivElement | null>(null);
  const [isPlayerFloating, setIsPlayerFloating] = useState(false);
  const [activeSegment, setActiveSegment] = useState(-1);
  const segmentElementsRef = useRef(new Map<number, HTMLDivElement>());
  const [dictationAnswers, setDictationAnswers] = useState<Record<number, string>>({});
  const [dictationGapPrompts, setDictationGapPrompts] = useState<Record<number, DictationGapPrompt>>({});
  const [dictationGapAnswers, setDictationGapAnswers] = useState<Record<number, string[]>>({});
  const [dictationGapResults, setDictationGapResults] = useState<Record<number, boolean[]>>({});
  const [dictationResults, setDictationResults] = useState<Record<number, boolean>>({});
  const [firstTryResults, setFirstTryResults] = useState<Record<number, boolean>>({});
  const [selectedWord, setSelectedWord] = useState<SelectedWord | null>(null);
  const [lookup, setLookup] = useState<WordLookup | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupCache, setLookupCache] = useState<Map<string, WordLookup>>(() => new Map());
  const lookupRequestId = useRef(0);
  const [workbooks, setWorkbooks] = useState<WorkbookListItem[]>([]);
  const [workbooksError, setWorkbooksError] = useState<string | null>(null);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState("");
  const [workbook, setWorkbook] = useState<WorkbookDetail | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState("");
  const [savePhrase, setSavePhrase] = useState("");
  const [saveMeaning, setSaveMeaning] = useState("");
  const [savingWord, setSavingWord] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const activeVideoId = transcript?.video_id;
  const activeSegments = transcript?.segments;

  const handlePlayerReady = useCallback((controller: YouTubeController) => {
    setPlayerController(controller);
    setPlayerVolume(controller.getVolume());
    setPlayerReady(true);
    setPlayerError(null);
  }, []);
  const handlePlayerError = useCallback((message: string) => {
    setPlayerReady(false);
    setPlayerError(message);
  }, []);
  const handlePlayerTimeUpdate = useCallback((currentTime: number) => {
    if (!activeSegments) return;
    const nextIndex = findTranscriptSegmentIndex(activeSegments, currentTime);
    if (nextIndex >= 0) {
      setActiveSegment((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
    }
  }, [activeSegments]);

  useEffect(() => {
    if (mode !== "shadowing" || activeSegment < 0) return;
    segmentElementsRef.current.get(activeSegment)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [activeSegment, mode]);

  useEffect(() => {
    const anchor = playerAnchorRef.current;
    if (!activeVideoId || !anchor || typeof IntersectionObserver === "undefined") {
      setIsPlayerFloating(false);
      return;
    }
    const mobileHeader = document.querySelector<HTMLElement>(".mobile-header");
    const headerHeight = Math.ceil(mobileHeader?.getBoundingClientRect().height ?? 0);
    // Exclude the sticky header so the iframe docks before its controls move underneath it.
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setIsPlayerFloating(!entry.isIntersecting || entry.boundingClientRect.top < headerHeight);
    }, { threshold: [0, 1], rootMargin: `-${headerHeight}px 0px 0px 0px` });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [activeVideoId]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void getWorkbooks().then((items) => {
      if (!active) return;
      setWorkbooksError(null);
      setWorkbooks(items);
      setSelectedWorkbookId((current) => current || String(items[0]?.id ?? ""));
    }).catch(() => {
      if (active) setWorkbooksError("Your workbooks could not be loaded. You can still practice and look up words.");
    });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedWorkbookId) return;
    let active = true;
    void getWorkbook(selectedWorkbookId).then((item) => {
      if (!active) return;
      setWorkbooksError(null);
      setWorkbook(item);
      setSelectedSheetId(String(item.sheets[0]?.id ?? ""));
    }).catch(() => {
      if (active) setWorkbooksError("Sheets could not be loaded. Please choose the workbook again.");
    });
    return () => { active = false; };
  }, [isAdmin, selectedWorkbookId]);

  useEffect(() => () => {
    // Lookup results live only in this mounted practice session and are discarded when the page is left.
    lookupRequestId.current += 1;
  }, []);

  async function loadTranscript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingTranscript(true);
    setTranscriptError(null);
    setPlayerError(null);
    setTranscript(null);
    setPlayerController(null);
    setPlayerReady(false);
    setActiveSegment(-1);
    resetDictation();
    closeLookup();
    try {
      const result = await getVideoTranscript(videoUrl.trim(), language);
      setTranscript(result);
      resetDictation(result.segments);
    } catch (cause) {
      setTranscriptError(cause instanceof Error ? cause.message : "Transcript could not be loaded. Please try again.");
    } finally {
      setLoadingTranscript(false);
    }
  }

  function resetDictation(segments: TranscriptSegment[] | undefined = transcript?.segments) {
    setDictationAnswers({});
    setDictationGapAnswers({});
    setDictationGapResults({});
    setDictationResults({});
    setFirstTryResults({});
    if (segments) {
      setDictationGapPrompts(Object.fromEntries(segments.map((segment, index) => [index, createDictationGapPrompt(segment.text)])));
    }
  }

  function changeDictationMode(nextMode: DictationMode) {
    setDictationMode(nextMode);
    setDictationAnswers({});
    setDictationGapAnswers({});
    setDictationGapResults({});
    setDictationResults({});
    setFirstTryResults({});
  }

  function playSegment(index: number, segment: TranscriptSegment) {
    if (!playerController) return;
    setActiveSegment(index);
    const nextSegmentStart = transcript?.segments[index + 1]?.start;
    // Caption providers can overlap adjacent timestamps, so stop at the earlier boundary to avoid playing the next line.
    const duration = getTranscriptSegmentPlaybackDuration(segment.start, segment.duration, nextSegmentStart);
    playerController.playSegment(segment.start, duration);
  }

  function handleSegmentCardClick(event: MouseEvent<HTMLDivElement>, index: number, segment: TranscriptSegment) {
    // Interactive controls inside a row keep their own action instead of starting playback as a side effect.
    if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) return;
    playSegment(index, segment);
  }

  async function selectWord(term: string, context: string, canSaveToSheet = true) {
    const normalizedTerm = term.trim().toLocaleLowerCase("en");
    if (!normalizedTerm) return;
    const requestId = ++lookupRequestId.current;
    setSelectedWord({ term, context, canSaveToSheet });
    setLookupError(null);
    setSaveError(null);
    setSaveMessage(null);
    const cached = lookupCache.get(normalizedTerm);
    if (cached) {
      setLookup(cached);
      setSavePhrase(term);
      setSaveMeaning(cached.translation_vi ?? cached.definitions[0]?.definition ?? "");
      return;
    }
    setLookup(null);
    setLoadingLookup(true);
    try {
      const result = await lookupVideoWord(term, context);
      if (requestId !== lookupRequestId.current) return;
      setLookup(result);
      setLookupCache((current) => new Map(current).set(normalizedTerm, result));
      setSavePhrase(term);
      setSaveMeaning(result.translation_vi ?? result.definitions[0]?.definition ?? "");
    } catch (cause) {
      if (requestId === lookupRequestId.current) {
        setLookupError(cause instanceof Error ? cause.message : "This text could not be looked up.");
      }
    } finally {
      if (requestId === lookupRequestId.current) setLoadingLookup(false);
    }
  }

  function closeLookup() {
    lookupRequestId.current += 1;
    setSelectedWord(null);
    setLookup(null);
    setLoadingLookup(false);
    setLookupError(null);
    setSaveError(null);
    setSaveMessage(null);
  }

  function playPronunciation() {
    if (!lookup) return;
    if (lookup.audio_url && typeof Audio !== "undefined") {
      const audio = new Audio(lookup.audio_url);
      void audio.play().catch(() => {
        if (isSpeechSupported()) speakEnglish(selectedWord?.term ?? lookup.term);
        else setLookupError("Pronunciation is not supported by this browser or device.");
      });
      return;
    }
    if (isSpeechSupported()) speakEnglish(selectedWord?.term ?? lookup.term);
    else setLookupError("Pronunciation is not supported by this browser or device.");
  }

  async function saveWord() {
    if (!selectedWord || !selectedSheetId || !savePhrase.trim() || !saveMeaning.trim()) return;
    setSavingWord(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await createFlashcardInSheet(selectedSheetId, {
        phrase: savePhrase.trim(),
        meaning: saveMeaning.trim(),
      });
      setSaveMessage("Word added to the selected sheet.");
    } catch (cause) {
      const message = cause instanceof ApiRequestError && cause.status === 409
        ? "This word already exists in the selected sheet."
        : cause instanceof Error ? cause.message : "The word could not be added. Please try again.";
      setSaveError(message);
    } finally {
      setSavingWord(false);
    }
  }

  function checkDictation(index: number) {
    if (!transcript) return;
    const segment = transcript.segments[index];
    if (!segment) return;
    let correct: boolean;
    if (dictationMode === "fill_gaps") {
      const prompt = dictationGapPrompts[index];
      if (!prompt?.answers.length) return;
      const results = evaluateDictationGaps(prompt.answers, dictationGapAnswers[index] ?? []);
      setDictationGapResults((current) => ({ ...current, [index]: results }));
      correct = results.every(Boolean);
    } else {
      correct = normalizeDictationAnswer(dictationAnswers[index] ?? "") === normalizeDictationAnswer(segment.text);
    }
    setDictationResults((current) => ({ ...current, [index]: correct }));
    // Keep the score based on the first submission so retries help learning without inflating accuracy.
    setFirstTryResults((current) => current[index] === undefined ? { ...current, [index]: correct } : current);
  }

  if (!transcript) {
    return <section className={styles.root} aria-labelledby="video-practice-title">
      <header className={styles.intro}>
        <p className={styles.eyebrow}>LISTEN · REPEAT · REMEMBER</p>
        <h2 id="video-practice-title">YouTube video practice</h2>
        <p>Paste an English YouTube link to shadow lines from its transcript or practise dictation one line at a time.</p>
      </header>
      <form className={styles.linkForm} onSubmit={(event) => void loadTranscript(event)}>
        <label className={styles.field}>YouTube video link
          <input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required maxLength={2048} />
        </label>
        <label className={styles.field}>Caption language
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option>
          </select>
        </label>
        <button className={styles.primary} type="submit" disabled={loadingTranscript || !videoUrl.trim()} aria-busy={loadingTranscript}>
          {loadingTranscript ? "Getting transcript…" : "Load video"}
        </button>
      </form>
      <p className={styles.note}>Transcript captions are provided by an external service. Videos without accessible captions cannot be used yet. The transcript and your dictation stay in this page only.</p>
      {transcriptError && <p className={styles.error} role="alert">{transcriptError}</p>}
    </section>;
  }

  const firstTryCorrectCount = Object.values(firstTryResults).filter(Boolean).length;
  const eligibleDictationCount = dictationMode === "fill_gaps"
    ? transcript.segments.filter((_, index) => (dictationGapPrompts[index]?.answers.length ?? 0) > 0).length
    : transcript.segments.length;
  const dictationComplete = eligibleDictationCount > 0 && Object.keys(firstTryResults).length >= eligibleDictationCount;

  return <section className={styles.root} aria-labelledby="video-practice-title">
    <header className={styles.intro}>
      <p className={styles.eyebrow}>LISTEN · REPEAT · REMEMBER</p>
      <h2 id="video-practice-title">YouTube video practice</h2>
      <p>Your transcript and answers are temporary and will clear when you leave this page.</p>
    </header>
    <div className={styles.modeSwitch} role="group" aria-label="Choose a practice mode">
      <button type="button" className={styles.modeButton} aria-pressed={mode === "shadowing"} onClick={() => setMode("shadowing")}>Shadowing</button>
      <button type="button" className={styles.modeButton} aria-pressed={mode === "dictation"} onClick={() => setMode("dictation")}>Dictation</button>
    </div>

    <div className={styles.workspace}>
      <div className={styles.playerColumn} data-floating={isPlayerFloating}>
        <div className={styles.playerSlot} ref={playerAnchorRef}>
          <YouTubePlayer key={transcript.video_id} videoId={transcript.video_id} onReady={handlePlayerReady} onError={handlePlayerError} onTimeUpdate={handlePlayerTimeUpdate} />
        </div>
        <div className={styles.playerControls}>
          <label className={styles.volumeControl}>
            <SpeakerIcon />
            <span className={styles.screenReaderOnly}>Video volume</span>
            <input type="range" min="0" max="100" step="5" value={playerVolume} aria-label="Video volume" onChange={(event) => {
              const volume = event.currentTarget.valueAsNumber;
              setPlayerVolume(volume);
              playerController?.setVolume(volume);
            }} />
            <output>{playerVolume}%</output>
          </label>
        </div>
        <div className={styles.videoMeta}>
          <h3>{transcript.title || "YouTube video"}</h3>
          {transcript.author_name && <p>{transcript.author_name}</p>}
          <p>{transcript.segments.length} lines · {transcript.caption_type === "auto" ? "Auto-generated captions" : "Captions"}</p>
        </div>
        <p className={styles.captionNotice}>The active transcript line follows playback. On mobile, the player stays pinned at the top while you scroll.</p>
        {playerError && <p className={styles.error} role="alert">{playerError} <a href={videoUrl} target="_blank" rel="noreferrer">Open video on YouTube</a></p>}
      </div>

      <div className={styles.transcriptColumn}>
        {mode === "shadowing" ? <>
          <p className={styles.eyebrow}>SHADOWING · TAP A LINE TO PLAY</p>
          <p className={styles.captionNotice}>Each selected line plays once. The transcript highlights and follows the video as it plays.</p>
          <div className={styles.segmentList} aria-label="Timestamped transcript">
            {transcript.segments.map((segment, index) => <div ref={(element) => {
              if (element) segmentElementsRef.current.set(index, element);
              else segmentElementsRef.current.delete(index);
            }} className={styles.segment} data-active={activeSegment === index} key={`${segment.start}-${index}`} role="group" aria-label={`Transcript line ${index + 1}`} onClick={(event) => handleSegmentCardClick(event, index, segment)}>
              <div className={styles.segmentLine}>
                <span className={styles.timestamp}>{formatTimestamp(segment.start)}</span>
                <p className={styles.segmentText}><TranscriptWords text={segment.text} onSelectWord={(term) => void selectWord(term, segment.text)} /></p>
                <button type="button" className={styles.translateButton} onClick={() => void selectWord(segment.text, segment.text, false)} aria-label="Translate line" title="Translate line"><TranslateIcon /></button>
              </div>
            </div>)}
          </div>
        </> : <>
          <div className={styles.dictationHeading}>
            <div><p className={styles.eyebrow}>DICTATION · {transcript.segments.length} LINES</p><h3>Choose how to practise</h3></div>
            {dictationComplete && <button type="button" className={styles.secondary} onClick={() => resetDictation()}>Try again</button>}
          </div>
          <div className={styles.dictationModeSwitch} role="group" aria-label="Choose a dictation exercise">
            <button type="button" className={styles.modeButton} aria-pressed={dictationMode === "full_sentence"} onClick={() => changeDictationMode("full_sentence")}>Full sentence</button>
            <button type="button" className={styles.modeButton} aria-pressed={dictationMode === "fill_gaps"} onClick={() => changeDictationMode("fill_gaps")}>Fill the gaps</button>
          </div>
          <p className={styles.captionNotice}>{dictationMode === "full_sentence" ? "Listen to each line and type the whole sentence." : "Listen and fill 1–3 randomly hidden words in each line."}</p>
          {dictationComplete && <div className={styles.dictationSummary}>
            <strong>First-try accuracy: {firstTryCorrectCount} / {eligibleDictationCount}</strong>
            <span>Your result is temporary and was not saved.</span>
          </div>}
          <div className={styles.dictationList} aria-label="Dictation lines">
            {transcript.segments.map((segment, index) => <article className={styles.dictationCard} key={`${segment.start}-${index}`}>
              <div className={styles.dictationTop}>
                <h3>Line {index + 1} <span className={styles.timestamp}>{formatTimestamp(segment.start)}</span></h3>
                <button type="button" className={styles.playButton} disabled={!playerReady} onClick={() => playSegment(index, segment)} aria-label={`Play dictation line ${index + 1}`}><span aria-hidden="true">▶</span></button>
              </div>
              {dictationMode === "full_sentence" ? <>
                <label className={styles.field} htmlFor={`dictation-answer-${index}`}>Your answer</label>
                <textarea id={`dictation-answer-${index}`} className={styles.answerInput} value={dictationAnswers[index] ?? ""} onChange={(event) => {
                  setDictationAnswers((current) => ({ ...current, [index]: event.target.value }));
                  setDictationResults((current) => { const next = { ...current }; delete next[index]; return next; });
                }} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") checkDictation(index); }} placeholder="Type the sentence you hear…" />
              </> : <div className={styles.gapSentence} aria-label={`Fill the gaps in line ${index + 1}`}>
                {(dictationGapPrompts[index]?.parts ?? []).map((part, partIndex) => part.gapIndex === null
                  ? <span key={`${part.value}-${partIndex}`}>{part.value}</span>
                  : <label className={styles.gapInput} key={`gap-${part.gapIndex}`}>
                    <span className={styles.screenReaderOnly}>Missing word {part.gapIndex + 1}</span>
                    <input
                      type="text"
                      autoComplete="off"
                      value={dictationGapAnswers[index]?.[part.gapIndex] ?? ""}
                      data-correct={dictationGapResults[index]?.[part.gapIndex] === undefined ? "unchecked" : String(dictationGapResults[index][part.gapIndex])}
                      aria-invalid={dictationGapResults[index]?.[part.gapIndex] === false}
                      aria-label={`Missing word ${part.gapIndex + 1} in line ${index + 1}`}
                      placeholder="…"
                      onChange={(event) => {
                        setDictationGapAnswers((current) => {
                          const answers = [...(current[index] ?? Array.from({ length: dictationGapPrompts[index]?.answers.length ?? 0 }, () => ""))];
                          answers[part.gapIndex!] = event.target.value;
                          return { ...current, [index]: answers };
                        });
                        setDictationGapResults((current) => { const next = { ...current }; delete next[index]; return next; });
                        setDictationResults((current) => { const next = { ...current }; delete next[index]; return next; });
                      }}
                      onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") checkDictation(index); }}
                    />
                    {dictationResults[index] !== undefined && <span className={styles.gapExpected}>{dictationGapPrompts[index]?.answers[part.gapIndex]}</span>}
                  </label>)}
              </div>}
              {dictationMode === "fill_gaps" && !dictationGapPrompts[index]?.answers.length && <p className={styles.captionNotice}>This line has no words to hide. Switch to Full sentence for this transcript.</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={dictationMode === "full_sentence"
                  ? !dictationAnswers[index]?.trim()
                  : !dictationGapPrompts[index]?.answers.length || !dictationGapPrompts[index]?.answers.every((_, gapIndex) => dictationGapAnswers[index]?.[gapIndex]?.trim())} onClick={() => checkDictation(index)}>Check</button>
              </div>
              {dictationResults[index] !== undefined && <>
                <p className={styles.feedback} data-correct={dictationResults[index]} role="status">{dictationResults[index] ? "Correct — nice listening." : dictationMode === "fill_gaps" ? "Some gaps are incorrect. Review the marked answers." : "Not quite. Compare your answer with the transcript:"}</p>
                {dictationMode === "full_sentence" && <p className={styles.segmentText}><TranscriptWords text={segment.text} onSelectWord={(term) => void selectWord(term, segment.text)} /></p>}
                <button type="button" className={styles.translateButton} onClick={() => void selectWord(segment.text, segment.text, false)} aria-label="Translate line" title="Translate line"><TranslateIcon /></button>
              </>}
            </article>)}
          </div>
          <p className={styles.captionNotice}>Capitalization, spaces, and punctuation are ignored. Use <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to check the focused line.</p>
        </>}

        {selectedWord && <section className={styles.lookupCard} aria-labelledby="word-lookup-title">
          <div className={styles.lookupHeader}>
            <div><p className={styles.eyebrow}>WORD OR PHRASE LOOKUP</p><h3 id="word-lookup-title">{selectedWord.term}{lookup?.phonetic ? ` · ${lookup.phonetic}` : ""}</h3></div>
            <button type="button" className={styles.secondary} onClick={closeLookup} aria-label="Close word lookup">Close</button>
          </div>
          {loadingLookup && <p className={styles.loading} role="status">Looking up this text…</p>}
          {lookupError && <p className={styles.error} role="alert">{lookupError}</p>}
          {lookup && <>
            {lookup.translation_vi && <p lang="vi"><strong>Vietnamese:</strong> {lookup.translation_vi}</p>}
            {lookup.definitions.length > 0 && <ol className={styles.lookupDetails}>{lookup.definitions.map((item, index) => <li key={`${item.part_of_speech}-${index}`}><strong>{item.part_of_speech && `${item.part_of_speech}: `}</strong>{item.definition}{item.example && <small>{item.example}</small>}</li>)}</ol>}
            <div className={styles.lookupActions}>
              {lookup.audio_url || isSpeechSupported() ? <button type="button" className={styles.iconButton} onClick={playPronunciation} aria-label={`Play pronunciation for ${selectedWord.term}`} title="Play pronunciation"><SpeakerIcon /></button> : <p className={styles.note}>Pronunciation is not supported on this device.</p>}
              {isAdmin && selectedWord.canSaveToSheet ? <div className={styles.savedWordFields}>
                {workbooksError && <p role="alert" className={styles.error}>{workbooksError}</p>}
                <label>Workbook<select value={selectedWorkbookId} onChange={(event) => { setWorkbook(null); setSelectedSheetId(""); setSelectedWorkbookId(event.target.value); }} disabled={savingWord || !workbooks.length}>
                  {workbooks.length ? workbooks.map((item) => <option value={item.id} key={item.id}>{item.name}</option>) : <option value="">No workbooks available</option>}
                </select></label>
                <label>Sheet<select value={selectedSheetId} onChange={(event) => setSelectedSheetId(event.target.value)} disabled={savingWord || !workbook?.sheets.length}>
                  {workbook?.sheets.length ? workbook.sheets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>) : <option value="">No sheets available</option>}
                </select></label>
                <label>Word<input value={savePhrase} maxLength={200} onChange={(event) => setSavePhrase(event.target.value)} /></label>
                <label>Meaning<input value={saveMeaning} maxLength={600} onChange={(event) => setSaveMeaning(event.target.value)} /></label>
                <button type="button" className={styles.primary} disabled={savingWord || !selectedSheetId || !savePhrase.trim() || !saveMeaning.trim()} aria-busy={savingWord} onClick={() => void saveWord()}>{savingWord ? "Adding word…" : "Add to sheet"}</button>
              </div> : isAdmin ? selectedWord.canSaveToSheet ? null : <p className={styles.note}>Only individual words can be added to a sheet. This transcript line will not be saved.</p> : <p className={styles.note}>{isAuthenticated ? "Administrator access is required to add words to shared sheets." : "Sign in as an administrator to add words to a shared sheet."}</p>}
            </div>
          </>}
          {saveMessage && <p className={styles.success} role="status">{saveMessage}</p>}
          {saveError && <p className={styles.error} role="alert">{saveError}</p>}
        </section>}
      </div>
    </div>
    <button type="button" className={styles.secondary} onClick={() => { setTranscript(null); setPlayerController(null); setPlayerReady(false); closeLookup(); resetDictation(); }}>Load another video</button>
  </section>;
}

function TranscriptWords({ text, onSelectWord }: { text: string; onSelectWord: (word: string) => void }) {
  return <>{splitTranscriptText(text).map(({ value, isWord }, index) => isWord
    ? <button type="button" className={styles.wordButton} key={`${value}-${index}`} onClick={(event) => { event.stopPropagation(); onSelectWord(value); }} aria-label={`Look up ${value}`}>{value}</button>
    : <span key={`${value}-${index}`}>{value}</span>)}</>;
}

function SpeakerIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M16 9.5a4 4 0 0 1 0 5" /><path d="M18.5 7a7.5 7.5 0 0 1 0 10" />
  </svg>;
}

function TranslateIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3.2a2 2 0 0 1-2-1.8v-7a2 2 0 0 1 1-2Z" />
    <path d="M7 10h5M9.5 8.5v1.7c0 1.8-1.1 3.3-2.5 4M8 11.5c.4 1 1.2 1.8 2.3 2.3M8.5 13l2.8-3" />
    <path d="M18 11h1.5a1.5 1.5 0 0 1 1.5 1.5v6l-2-1.5h-1" />
  </svg>;
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
