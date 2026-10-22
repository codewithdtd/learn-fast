"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/layout/app-shell";
import {
  buildExerciseQuestions, createExercisePool, gradeExerciseAnswer, summarizeExercise,
  type ExerciseCount, type ExerciseMode, type ExerciseQuestion, type ExerciseResponse, type ExerciseSettings,
} from "@/lib/practice-exercises";
import type { RecallDirection, RecallFilter } from "@/lib/quick-recall";
import type { FlashcardListItem, SheetDetail } from "@/services/api";
import styles from "./practice-exercises.module.css";

const modes: { value: ExerciseMode; title: string; description: string; icon: "check" | "study" | "books" }[] = [
  { value: "multiple_choice", title: "Multiple choice", description: "Recognize the correct translation from a set of answers.", icon: "check" },
  { value: "translation", title: "Type the translation", description: "Recall the answer and write it from memory.", icon: "study" },
  { value: "cloze", title: "Fill in the blank", description: "Complete an English example with the missing phrase.", icon: "books" },
];

type Round = { id: number; settings: ExerciseSettings; questions: ExerciseQuestion[] };

export function PracticeExerciseSession({ sheet, cards, backHref }: { sheet: SheetDetail; cards: FlashcardListItem[]; backHref?: string }) {
  const [settings, setSettings] = useState<ExerciseSettings>(() => {
    const initial: ExerciseSettings = { mode: "multiple_choice", direction: "en_to_vi", filter: "all", count: "10" };
    return createExercisePool(cards, initial).length ? initial : { ...initial, mode: "translation" };
  });
  const [round, setRound] = useState<Round | null>(null);
  const nextRoundId = useRef(0);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const pool = createExercisePool(cards, settings);
  const actualCount = settings.count === "all" ? pool.length : Math.min(Number(settings.count), pool.length);

  useEffect(() => { if (!round) pageHeadingRef.current?.focus(); }, [round]);

  function startRound(configuration: ExerciseSettings) {
    // Generate once per attempt so the same visible question stays attached to
    // its answer while the learner types, submits, and reviews feedback.
    const questions = buildExerciseQuestions(cards, configuration);
    if (!questions.length) return;
    nextRoundId.current += 1;
    setRound({ id: nextRoundId.current, settings: { ...configuration }, questions });
  }

  return <section className={styles.root}>
    <header className={styles.header}>
      <Link href={backHref ?? `/sheets/${sheet.id}`} className={styles.back}><Icon name="back" size={18} /> Back to {sheet.name}</Link>
      <p className={styles.eyebrow}>Put your vocabulary to work</p>
      <h1 ref={pageHeadingRef} tabIndex={-1}>Practice Exercises</h1>
      <p>Find out what you remember, one question at a time.</p>
    </header>

    {round ? <ExerciseRound key={round.id} round={round}
      onRestart={() => startRound(round.settings)} onConfigure={() => setRound(null)} /> : <>
      <form className={styles.setup} onSubmit={(event) => { event.preventDefault(); startRound(settings); }}>
        <fieldset className={styles.modeGroup}>
          <legend>How would you like to practice?</legend>
          <div className={styles.modeGrid}>
            {modes.map((mode) => {
              const available = createExercisePool(cards, { ...settings, mode: mode.value }).length;
              return <label key={mode.value} className={styles.modeOption} data-selected={settings.mode === mode.value} data-disabled={available === 0}>
                <span className={styles.modeTop}><Icon name={mode.icon} size={23} />
                  <input type="radio" name="exercise-mode" value={mode.value} checked={settings.mode === mode.value}
                    disabled={available === 0} onChange={() => setSettings({ ...settings, mode: mode.value })} />
                </span>
                <strong>{mode.title}</strong>
                <span>{mode.description}</span>
                <small>{available ? `${available} eligible card${available === 1 ? "" : "s"}`
                  : mode.value === "cloze" ? "Needs an example containing the full phrase."
                    : mode.value === "multiple_choice" ? "Needs distinct answers and unambiguous prompts."
                      : "No matching cards with an unambiguous translation."}</small>
              </label>;
            })}
          </div>
        </fieldset>

        <div className={styles.controls}>
          <label>Card set
            <select value={settings.filter} onChange={(event) => setSettings({ ...settings, filter: event.target.value as RecallFilter })}>
              <option value="all">All cards</option><option value="weak">Weak cards</option><option value="bookmarked">Bookmarked cards</option>
            </select>
          </label>
          <label>Translation direction
            <select value={settings.mode === "cloze" ? "english_example" : settings.direction} disabled={settings.mode === "cloze"}
              aria-describedby={settings.mode === "cloze" ? "cloze-direction-note" : undefined}
              onChange={(event) => setSettings({ ...settings, direction: event.target.value as RecallDirection })}>
              {settings.mode === "cloze" ? <option value="english_example">English example</option> : <>
                <option value="en_to_vi">English → Vietnamese</option><option value="vi_to_en">Vietnamese → English</option>
              </>}
            </select>
          </label>
          <label>Number of questions
            <select value={settings.count} onChange={(event) => setSettings({ ...settings, count: event.target.value as ExerciseCount })}>
              <option value="10">10 questions</option><option value="20">20 questions</option><option value="all">All eligible cards</option>
            </select>
          </label>
        </div>
        {settings.mode === "cloze" && <p className={styles.hint} id="cloze-direction-note">Fill in the missing English phrase. Only cards with a matching English example are included.</p>}
        {settings.mode === "translation" && <p className={styles.hint}>Use the translation on your flashcard. Capitalization, punctuation and extra spaces are ignored; Vietnamese accents still matter.</p>}

        <div className={styles.startRow}>
          <div><strong>{actualCount ? `${actualCount} question${actualCount === 1 ? "" : "s"} in this round` : "No eligible questions"}</strong>
            <p>{actualCount ? "Questions are shuffled for each new round." : "Choose another exercise or card set to start."}</p>
          </div>
          <button className={styles.primary} type="submit" disabled={actualCount === 0}>Start practice <Icon name="arrow" size={18} /></button>
        </div>
      </form>
      {cards.length === 0 && <p className={styles.empty}>This sheet has no flashcards yet. Add vocabulary before starting an exercise.</p>}
      <p className={styles.temporary}>Practice scores are temporary and reset when you leave this page.</p>
    </>}
  </section>;
}

function ExerciseRound({ round, onRestart, onConfigure }: { round: Round; onRestart: () => void; onConfigure: () => void }) {
  const [responses, setResponses] = useState<ExerciseResponse[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const question = round.questions[index];
  const response = responses[index];
  const hasAnswered = Boolean(response);
  const isMultipleChoice = round.settings.mode === "multiple_choice";
  const mode = modes.find((item) => item.value === round.settings.mode);

  useEffect(() => {
    if (isComplete) return;
    if (hasAnswered) submitRef.current?.focus();
    else if (isMultipleChoice) headingRef.current?.focus();
    else inputRef.current?.focus();
  }, [index, hasAnswered, isMultipleChoice, isComplete]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (response) {
      if (index + 1 === round.questions.length) setIsComplete(true);
      else { setIndex(index + 1); setDraft(""); }
      return;
    }
    if (!draft.trim()) return;
    const graded = gradeExerciseAnswer(question, draft);
    // A question is locked after the first submit. Repeated Enter/clicks never
    // add another answer or change the score for this question.
    setResponses((current) => current.length === index ? [...current, graded] : current);
  }

  if (isComplete) return <ExerciseResults responses={responses} onRestart={onRestart} onConfigure={onConfigure} />;

  return <div className={styles.round}>
    <div className={styles.roundMeta}><span>{mode?.title}</span><span>Question {index + 1} of {round.questions.length}</span></div>
    <progress className={styles.progress} value={responses.length} max={round.questions.length} aria-label="Answered questions" />
    <form className={styles.questionCard} onSubmit={submit}>
      <p className={styles.eyebrow}>{round.settings.mode === "cloze" ? "Complete the English example"
        : round.settings.direction === "en_to_vi" ? "Translate into Vietnamese" : "Translate into English"}</p>
      <h2 ref={headingRef} tabIndex={-1} className={styles.question}>{question.prompt}</h2>
      {question.hint && <p className={styles.meaning}><strong>Meaning:</strong> {question.hint}</p>}

      {isMultipleChoice ? <fieldset className={styles.answers} disabled={hasAnswered}>
        <legend className={styles.answerLabel}>Choose the correct translation</legend>
        {question.options.map((option, optionIndex) => {
          const state = response ? gradeExerciseAnswer(question, option).is_correct ? "correct" : draft === option ? "incorrect" : "idle" : "idle";
          return <label key={option} className={styles.answerOption} data-selected={draft === option} data-state={state}>
            <input type="radio" name="answer" value={option} checked={draft === option} onChange={() => setDraft(option)} />
            <span className={styles.optionNumber} aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span>
            <span>{option}</span>
            {state === "correct" && <span className={styles.optionStatus}>Correct answer</span>}
            {state === "incorrect" && <span className={styles.optionStatus}>Your answer</span>}
          </label>;
        })}
      </fieldset> : <label className={styles.textAnswer}>
        {round.settings.mode === "cloze" ? "Missing English phrase" : "Your translation"}
        <input ref={inputRef} type="text" value={draft} disabled={hasAnswered}
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder={round.settings.mode === "cloze" ? "Type the missing phrase" : "Type your answer"}
          aria-invalid={response ? !response.is_correct : undefined}
          aria-describedby={response ? "exercise-feedback" : "exercise-answer-help"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} />
      </label>}
      {!response && !isMultipleChoice && <p className={styles.hint} id="exercise-answer-help">{round.settings.mode !== "cloze" && round.settings.direction === "en_to_vi"
        ? "Match the answer on your flashcard. Vietnamese accents are required." : "Match the English phrase on your flashcard."}</p>}

      {response && <div className={styles.feedback} data-correct={response.is_correct} id="exercise-feedback" role="status">
        <Icon name={response.is_correct ? "check" : "refresh"} size={22} />
        <div><strong>{response.is_correct ? "Correct!" : "Not quite. Here is the expected answer:"}</strong>
          <p>{question.answer}</p>
        </div>
      </div>}

      <div className={styles.questionActions}>
        <button ref={submitRef} className={styles.primary} type="submit" disabled={!hasAnswered && !draft.trim()}>
          {hasAnswered ? index + 1 === round.questions.length ? "See results" : "Next question" : "Check answer"}
          <Icon name={hasAnswered ? "arrow" : "check"} size={18} />
        </button>
        <span className={styles.hint}>Press Enter to {hasAnswered ? "continue" : "check"}.</span>
      </div>
    </form>
    <p className={styles.temporary}>Practice scores are temporary and reset when you leave this page.</p>
  </div>;
}

function ExerciseResults({ responses, onRestart, onConfigure }: { responses: ExerciseResponse[]; onRestart: () => void; onConfigure: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const summary = summarizeExercise(responses);
  const incorrect = responses.filter((response) => !response.is_correct);

  return <section className={styles.results}>
    <div className={styles.scoreCard}>
      <p className={styles.eyebrow}>Round complete</p>
      <h2 ref={headingRef} tabIndex={-1}>Here is how you did</h2>
      <strong className={styles.score}>{summary.percentage}%</strong>
      <p>{summary.correct} of {summary.total} answers correct</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRestart}><Icon name="refresh" size={18} /> Try another round</button>
        <button type="button" className={styles.secondary} onClick={onConfigure}>Change exercise</button>
      </div>
    </div>
    {incorrect.length ? <section className={styles.review} aria-labelledby="exercise-review-heading">
      <h2 id="exercise-review-heading">Learn from your answers</h2>
      <p>{incorrect.length} question{incorrect.length === 1 ? "" : "s"} to revisit.</p>
      <ol className={styles.reviewList}>
        {incorrect.map((response) => <li key={response.question.cardId}>
          <h3>{response.question.prompt}</h3>
          <dl><div><dt>Your answer</dt><dd className={styles.incorrectAnswer}>{response.answer}</dd></div>
            <div><dt>Expected answer</dt><dd className={styles.correctAnswer}>{response.question.answer}</dd></div></dl>
        </li>)}
      </ol>
    </section> : <div className={styles.perfect}><Icon name="check" size={24} /><p>You answered every question correctly. Try a different exercise to challenge your recall.</p></div>}
    <p className={styles.temporary}>This score is for your current practice only. It is not saved when you leave.</p>
  </section>;
}
