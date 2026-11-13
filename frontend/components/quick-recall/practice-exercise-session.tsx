"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
  Layers,
  RotateCcw,
  Volume2,
  AlertCircle,
  Play,
  HelpCircle,
} from "lucide-react";

import { AudioPronounceButton } from "@/components/shared/audio-pronounce-button";
import { SoundToggleButton } from "@/components/shared/sound-toggle-button";
import { playJourneyCompletionSound } from "@/lib/journey-sounds";
import { getExerciseSoundEnabled, playSuccessSound } from "@/lib/sound-effects";
import { speakEnglish, stopSpeech } from "@/lib/speech";
import {
  buildExerciseQuestions,
  createExercisePool,
  getExerciseEnglishSentence,
  gradeExerciseAnswer,
  summarizeExercise,
  type ExerciseCount,
  type ExerciseMode,
  type ExerciseQuestion,
  type ExerciseResponse,
  type ExerciseSettings,
} from "@/lib/practice-exercises";
import type { RecallDirection, RecallFilter } from "@/lib/quick-recall";
import type { FlashcardListItem, SheetDetail } from "@/services/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import styles from "./practice-exercises.module.css";

const modes: {
  value: ExerciseMode;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
}[] = [
  {
    value: "multiple_choice",
    title: "Multiple Choice",
    description: "Recognize the correct translation from a set of 4 options.",
    icon: CheckCircle2,
  },
  {
    value: "translation",
    title: "Type Translation",
    description: "Recall the answer and type it from memory.",
    icon: Sparkles,
  },
  {
    value: "cloze",
    title: "Fill in the Blank",
    description: "Complete an English sentence with the missing phrase.",
    icon: Layers,
  },
];

type Round = { id: number; settings: ExerciseSettings; questions: ExerciseQuestion[] };

/**
 * Human-crafted Practice Exercise Session
 * Fast, distraction-free recall training with 8-state button discipline,
 * audio pronunciation, smooth keyboard navigation, and overrule capabilities.
 */
export function PracticeExerciseSession({
  sheet,
  cards,
  backHref,
}: {
  sheet: SheetDetail;
  cards: FlashcardListItem[];
  backHref?: string;
}) {
  const [settings, setSettings] = useState<ExerciseSettings>(() => {
    const initial: ExerciseSettings = {
      mode: "multiple_choice",
      direction: "en_to_vi",
      filter: "all",
      count: "10",
    };
    return createExercisePool(cards, initial).length
      ? initial
      : { ...initial, mode: "translation" };
  });
  const [round, setRound] = useState<Round | null>(null);
  const nextRoundId = useRef(0);
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const pool = createExercisePool(cards, settings);
  const actualCount =
    settings.count === "all" ? pool.length : Math.min(Number(settings.count), pool.length);

  useEffect(() => {
    if (!round) pageHeadingRef.current?.focus();
  }, [round]);

  function startRound(configuration: ExerciseSettings) {
    // Generate once per attempt so the same visible question stays attached to
    // its answer while the learner types, submits, and reviews feedback.
    const questions = buildExerciseQuestions(cards, configuration);
    if (!questions.length) return;
    nextRoundId.current += 1;
    setRound({ id: nextRoundId.current, settings: { ...configuration }, questions });
  }

  return (
    <section className={styles.root}>
      {/* Header with Breadcrumb, Sound Controls, and Kicker */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link
            href={backHref ?? `/sheets/${sheet.id}`}
            className={styles.back}
          >
            <ArrowLeft className="h-4 w-4" /> Back to {sheet.name}
          </Link>
          <SoundToggleButton size="md" />
        </div>
        <p className={styles.eyebrow}>Active Recall & Comprehension</p>
        <h1 ref={pageHeadingRef} tabIndex={-1}>
          Practice Exercises
        </h1>
        <p>Strengthen memory retention with quizzes, typing, and fill-in-the-blank.</p>
      </header>

      {round ? (
        <ExerciseRound
          key={round.id}
          sheetId={sheet.id}
          round={round}
          onRestart={() => startRound(round.settings)}
          onConfigure={() => setRound(null)}
        />
      ) : (
        <>
          <form
            className={styles.setup}
            onSubmit={(event) => {
              event.preventDefault();
              startRound(settings);
            }}
          >
            {/* Mode Selector */}
            <fieldset className={styles.modeGroup}>
              <legend>How would you like to practice?</legend>
              <div className={styles.modeGrid}>
                {modes.map((mode) => {
                  const available = createExercisePool(cards, {
                    ...settings,
                    mode: mode.value,
                  }).length;
                  const IconComp = mode.icon;
                  return (
                    <label
                      key={mode.value}
                      className={styles.modeOption}
                      data-selected={settings.mode === mode.value}
                      data-disabled={available === 0}
                    >
                      <span className={styles.modeTop}>
                        <IconComp className="h-5 w-5 text-primary" />
                        <input
                          type="radio"
                          name="exercise-mode"
                          value={mode.value}
                          checked={settings.mode === mode.value}
                          disabled={available === 0}
                          onChange={() => setSettings({ ...settings, mode: mode.value })}
                        />
                      </span>
                      <strong>{mode.title}</strong>
                      <span>{mode.description}</span>
                      <small>
                        {available
                          ? `${available} eligible card${available === 1 ? "" : "s"}`
                          : mode.value === "cloze"
                            ? "Needs an example sentence containing the phrase."
                            : mode.value === "multiple_choice"
                              ? "Needs distinct answers to generate distractors."
                              : "No matching cards with unambiguous translation."}
                      </small>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Controls Row */}
            <div className={styles.controls}>
              <label>
                Card set
                <select
                  value={settings.filter}
                  onChange={(event) =>
                    setSettings({ ...settings, filter: event.target.value as RecallFilter })
                  }
                >
                  <option value="all">All cards</option>
                  <option value="weak">Weak cards only</option>
                  <option value="bookmarked">Bookmarked cards only</option>
                </select>
              </label>

              <label>
                Translation direction
                <select
                  value={settings.mode === "cloze" ? "english_example" : settings.direction}
                  disabled={settings.mode === "cloze"}
                  aria-describedby={settings.mode === "cloze" ? "cloze-direction-note" : undefined}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      direction: event.target.value as RecallDirection,
                    })
                  }
                >
                  {settings.mode === "cloze" ? (
                    <option value="english_example">English sentence</option>
                  ) : (
                    <>
                      <option value="en_to_vi">English → Vietnamese</option>
                      <option value="vi_to_en">Vietnamese → English</option>
                    </>
                  )}
                </select>
              </label>

              <label>
                Question count
                <select
                  value={settings.count}
                  onChange={(event) =>
                    setSettings({ ...settings, count: event.target.value as ExerciseCount })
                  }
                >
                  <option value="10">10 questions</option>
                  <option value="20">20 questions</option>
                  <option value="all">All eligible cards</option>
                </select>
              </label>
            </div>

            {settings.mode === "cloze" && (
              <p className={styles.hint} id="cloze-direction-note">
                Fill in the missing English phrase. Only cards with an English example are included.
              </p>
            )}
            {settings.mode === "translation" && (
              <p className={styles.hint}>
                {settings.direction === "en_to_vi"
                  ? "For English to Vietnamese, at least 60% of the words must match the card meaning. Punctuation and spaces are tolerated; Vietnamese accents are preserved."
                  : "For Vietnamese to English, match the flashcard phrase. Punctuation and capitalization are flexible."}
              </p>
            )}

            {/* Start Button Row */}
            <div className={styles.startRow}>
              <div>
                <strong>
                  {actualCount
                    ? `${actualCount} question${actualCount === 1 ? "" : "s"} in this round`
                    : "No eligible questions"}
                </strong>
                <p>
                  {actualCount
                    ? "Questions are shuffled each round for optimal memory testing."
                    : "Choose another mode or card set to start."}
                </p>
              </div>

              <Button
                size="lg"
                type="submit"
                disabled={actualCount === 0}
                leftIcon={<Play className="h-4 w-4 fill-current" />}
              >
                Start Practice
              </Button>
            </div>
          </form>

          {cards.length === 0 && (
            <p className={styles.empty}>
              This sheet has no flashcards yet. Add vocabulary before starting an exercise.
            </p>
          )}
          <p className={styles.temporary}>
            Practice scores are temporary and do not alter your SRS schedule.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Single Exercise Round execution
 */
function ExerciseRound({
  round,
  sheetId,
  onRestart,
  onConfigure,
}: {
  round: Round;
  sheetId: number;
  onRestart: () => void;
  onConfigure: () => void;
}) {
  const [responses, setResponses] = useState<ExerciseResponse[]>([]);
  const [remainingQuestions, setRemainingQuestions] = useState(round.questions);
  const [draft, setDraft] = useState("");
  const [response, setResponse] = useState<ExerciseResponse | null>(null);
  const [wasOverridden, setWasOverridden] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const speechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = remainingQuestions[0];
  const hasAnswered = Boolean(response);
  const isMultipleChoice = round.settings.mode === "multiple_choice";
  const mode = modes.find((item) => item.value === round.settings.mode);

  const totalQuestions = round.questions.length;
  const answeredCount = totalQuestions - remainingQuestions.length;

  // Dọn dẹp tiến trình phát âm thanh và hẹn giờ khi rời khỏi component hoặc kết thúc bài tập
  useEffect(() => {
    return () => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      stopSpeech();
    };
  }, []);

  /**
   * Điều phối âm thanh khi người học hoàn thành câu trả lời đúng:
   * 1. Phát chuông "ting" tức thì qua Web Audio API.
   * 2. Sau khoảng nghỉ 300ms, tự động đọc câu tiếng Anh (nếu người học đang bật âm thanh).
   */
  function triggerCorrectAnswerAudio(currentQ: ExerciseQuestion) {
    playSuccessSound();

    if (getExerciseSoundEnabled()) {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
      }
      const sentence = getExerciseEnglishSentence(currentQ, round.settings);
      if (sentence) {
        speechTimerRef.current = setTimeout(() => {
          speakEnglish(sentence);
        }, 300);
      }
    }
  }

  useEffect(() => {
    if (isComplete || !question) return;
    if (hasAnswered) submitRef.current?.focus();
    else if (isMultipleChoice) headingRef.current?.focus();
    else inputRef.current?.focus();
  }, [question, hasAnswered, isMultipleChoice, isComplete]);

  function handleOverrideAsCorrect() {
    if (!response || !question) return;
    setWasOverridden(true);
    const updated: ExerciseResponse = {
      ...response,
      is_correct: true,
      confidence_rating: 3,
    };
    setResponse(updated);

    // Phát âm thanh chuông "ting" và tự động phát âm câu tiếng Anh
    triggerCorrectAnswerAudio(question);

    // Cập nhật câu trả lời này thành đúng trong danh sách responses để tính điểm chính xác
    setResponses((current) => {
      const exists = current.some((item) => item.question.cardId === question.cardId);
      if (exists) {
        return current.map((item) =>
          item.question.cardId === question.cardId ? updated : item,
        );
      }
      return [...current, updated];
    });

    // Tự động focus nút Next / Hoàn thành để người học có thể bấm Enter tiếp tục ngay
    setTimeout(() => {
      submitRef.current?.focus();
    }, 50);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question) return;

    if (response) {
      // Dừng ngay giọng đọc của câu cũ khi bấm tiếp tục sang câu tiếp theo
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
      stopSpeech();

      const retryTranslation = round.settings.mode === "translation" && !response.is_correct;
      if (retryTranslation) {
        // Câu sai phải quay lại sau các câu còn lại để người học truy hồi lại đáp án;
        // vì vậy nó chỉ rời hàng đợi khi được chấm đúng.
        setRemainingQuestions((current) => [...current.slice(1), question]);
      } else {
        const nextQuestions = remainingQuestions.slice(1);
        setRemainingQuestions(nextQuestions);
        if (nextQuestions.length === 0) setIsComplete(true);
      }
      setResponse(null);
      setDraft("");
      setWasOverridden(false);
      return;
    }

    if (!draft.trim()) return;
    const graded = gradeExerciseAnswer(question, draft, round.settings);
    // Giữ kết quả đầu tiên cho điểm số; các lần thử sau chỉ quyết định câu đã
    // được gỡ khỏi hàng đợi hay còn phải luyện lại.
    setResponses((current) =>
      current.some((item) => item.question.cardId === question.cardId)
        ? current
        : [...current, graded],
    );
    setResponse(graded);
    setWasOverridden(false);

    // Business logic: Phát chuông "ting" và tự động đọc câu tiếng Anh khích lệ khi làm đúng
    if (graded.is_correct) {
      triggerCorrectAnswerAudio(question);
    }
  }

  if (isComplete) {
    return (
      <ExerciseResults
        completionId={`exercise-${sheetId}-${round.id}`}
        responses={responses}
        retryUntilCorrect={round.settings.mode === "translation"}
        onRestart={onRestart}
        onConfigure={onConfigure}
      />
    );
  }

  if (!question) return null;

  return (
    <div className={styles.round}>
      {/* Progress Meta */}
      <div className={styles.roundMeta}>
        <div className={styles.roundModeWrap}>
          <span className="font-semibold text-foreground">{mode?.title}</span>
          <SoundToggleButton size="sm" showLabel={false} />
        </div>
        <span>
          Question <strong>{answeredCount + 1}</strong> of {totalQuestions}
        </span>
      </div>

      <progress
        className={styles.progress}
        value={answeredCount}
        max={totalQuestions}
        aria-label="Practice progress"
      />

      <form className={styles.questionCard} onSubmit={submit}>
        <p className={styles.eyebrow}>
          {round.settings.mode === "cloze"
            ? "Complete the English sentence"
            : round.settings.direction === "en_to_vi"
              ? "Translate into Vietnamese"
              : "Translate into English"}
        </p>

        {/* Question Prompt with Instant Audio Button */}
        <div className={styles.questionPromptWrap}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.question}>
            {question.prompt}
          </h2>
          {/* Audio Button for English prompt (en_to_vi or cloze) */}
          {(round.settings.direction === "en_to_vi" || round.settings.mode === "cloze") && (
            <AudioPronounceButton
              text={
                round.settings.mode === "cloze"
                  ? (question.example_en ?? question.phrase ?? question.prompt)
                  : question.prompt
              }
              size="md"
              title="Listen to pronunciation"
            />
          )}
        </div>

        {question.hint && (
          <p className={styles.meaning}>
            <strong>Meaning:</strong> {question.hint}
          </p>
        )}

        {/* Multiple Choice Answers */}
        {isMultipleChoice ? (
          <fieldset className={styles.answers} disabled={hasAnswered}>
            <legend className={styles.answerLabel}>Choose the correct translation</legend>
            <div className="grid gap-2.5">
              {question.options.map((option, optionIndex) => {
                const state = response
                  ? gradeExerciseAnswer(question, option, round.settings).is_correct
                    ? "correct"
                    : draft === option
                      ? "incorrect"
                      : "idle"
                  : "idle";

                return (
                  <label
                    key={option}
                    className={styles.answerOption}
                    data-selected={draft === option}
                    data-state={state}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={option}
                      checked={draft === option}
                      onChange={() => setDraft(option)}
                    />
                    <span className={styles.optionNumber} aria-hidden="true">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className="flex-1 font-medium">{option}</span>
                    {state === "correct" && (
                      <span className={styles.optionStatus}>✓ Correct</span>
                    )}
                    {state === "incorrect" && (
                      <span className={styles.optionStatus}>✕ Your answer</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <label className={styles.textAnswer}>
            {round.settings.mode === "cloze" ? "Missing English phrase" : "Your translation"}
            <input
              ref={inputRef}
              type="text"
              value={draft}
              disabled={hasAnswered}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={
                round.settings.mode === "cloze"
                  ? "Type the missing phrase"
                  : "Type your answer"
              }
              aria-invalid={response ? !response.is_correct : undefined}
              aria-describedby={response ? "exercise-feedback" : "exercise-answer-help"}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing) {
                  event.preventDefault();
                }
              }}
            />
          </label>
        )}

        {!response && !isMultipleChoice && (
          <p className={styles.hint} id="exercise-answer-help">
            {round.settings.mode === "translation" && round.settings.direction === "en_to_vi"
              ? "Over 60% of the words must match the card meaning. Punctuation and spaces are ignored; accents matter."
              : round.settings.mode === "cloze"
                ? "Type the missing phrase exactly as it appears in the example."
                : "Match the English phrase on your flashcard."}
          </p>
        )}

        {/* Feedback Section */}
        {response && (
          <div
            className={styles.feedback}
            data-correct={response.is_correct}
            id="exercise-feedback"
            role="status"
          >
            {response.is_correct ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-error" />
            )}
            <div className="flex-1">
              <strong>
                {wasOverridden
                  ? "Recorded as correct!"
                  : response.is_correct
                    ? "Correct!"
                    : "Not quite. Here is the expected answer:"}
              </strong>

              <div className={styles.feedbackAnswerRow}>
                <p className="font-semibold text-foreground">{question.answer}</p>
                {/* Nút phát âm câu / cụm từ tiếng Anh chuẩn */}
                <AudioPronounceButton
                  text={getExerciseEnglishSentence(question, round.settings)}
                  size="sm"
                  title="Listen to English pronunciation"
                />
              </div>

              {/* Hiển thị câu ví dụ tiếng Anh nếu có để người học xem và nghe lại ngữ cảnh hoàn chỉnh */}
              {question.example_en && question.example_en !== question.answer && (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-outline/60 bg-surface/80 px-3 py-2 text-xs text-foreground/80">
                  <span className="italic leading-relaxed">&ldquo;{question.example_en}&rdquo;</span>
                  <AudioPronounceButton
                    text={question.example_en}
                    size="sm"
                    title="Listen to example sentence"
                  />
                </div>
              )}

              {!response.is_correct && round.settings.mode === "translation" && (
                <p className="text-xs text-muted">
                  This question will return later in this round until answered correctly.
                </p>
              )}

              {/* Overrule Button: "Tôi đã trả lời đúng" */}
              {!response.is_correct && !isMultipleChoice && (
                <div className={styles.overrideWrap}>
                  <button
                    type="button"
                    className={styles.overrideButton}
                    onClick={handleOverrideAsCorrect}
                    title="Mark my answer as correct if you used a synonym or abbreviation"
                  >
                    <Check className="h-4 w-4" /> Tôi đã trả lời đúng
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Button & Keyboard Hint */}
        <div className={styles.questionActions}>
          <Button
            ref={submitRef}
            size="lg"
            type="submit"
            disabled={!hasAnswered && !draft.trim()}
            rightIcon={
              hasAnswered ? (
                <ArrowRight className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )
            }
          >
            {hasAnswered
              ? response?.is_correct === true && remainingQuestions.length === 1
                ? "See results"
                : "Next question"
              : "Check answer"}
          </Button>
          <span className={styles.hint}>
            Press <kbd className="rounded border border-outline px-1.5 py-0.5 text-xs">Enter</kbd>{" "}
            to {hasAnswered ? "continue" : "check"}.
          </span>
        </div>
      </form>
    </div>
  );
}

/**
 * Exercise Results Summary Screen
 */
function ExerciseResults({
  completionId,
  responses,
  retryUntilCorrect,
  onRestart,
  onConfigure,
}: {
  completionId: string;
  responses: ExerciseResponse[];
  retryUntilCorrect: boolean;
  onRestart: () => void;
  onConfigure: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    playJourneyCompletionSound(completionId);
  }, [completionId]);

  const summary = summarizeExercise(responses);
  const incorrect = responses.filter((response) => !response.is_correct);

  return (
    <section className={styles.results}>
      <div className={styles.scoreCard}>
        <p className={styles.eyebrow}>Round Complete</p>
        <h2 ref={headingRef} tabIndex={-1}>
          Here is how you did
        </h2>
        <strong className={styles.score}>{summary.percentage}%</strong>
        <p>
          {summary.correct} of {summary.total} answers correct on the first attempt
        </p>

        <div className={styles.actions}>
          <Button
            variant="default"
            size="md"
            onClick={onRestart}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            Try Another Round
          </Button>
          <Button variant="secondary" size="md" onClick={onConfigure}>
            Change Exercise Mode
          </Button>
        </div>
      </div>

      {/* Review Incorrect Answers */}
      {incorrect.length ? (
        <section className={styles.review} aria-labelledby="exercise-review-heading">
          <h2 id="exercise-review-heading">
            {retryUntilCorrect ? "Questions that needed another try" : "Review Your Answers"}
          </h2>
          <p>
            {retryUntilCorrect
              ? "You answered each one correctly before finishing."
              : `${incorrect.length} question${incorrect.length === 1 ? "" : "s"} to review.`}
          </p>

          <ol className={styles.reviewList}>
            {incorrect.map((resp) => (
              <li key={resp.question.cardId}>
                <h3>{resp.question.prompt}</h3>
                <dl>
                  <div>
                    <dt>Your answer</dt>
                    <dd className={styles.incorrectAnswer}>{resp.answer}</dd>
                  </div>
                  <div>
                    <dt>Expected answer</dt>
                    <dd className={`${styles.correctAnswer} ${styles.correctAnswerWrap}`}>
                      <span>{resp.question.answer}</span>
                      {Boolean(resp.question.phrase) && (
                        <AudioPronounceButton
                          text={resp.question.phrase ?? resp.question.answer}
                          size="sm"
                          title="Listen to pronunciation"
                        />
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className={styles.perfect}>
          <CheckCircle2 className="h-6 w-6 text-green shrink-0" />
          <p>
            You answered every question correctly on the first try! Keep up the great practice.
          </p>
        </div>
      )}
    </section>
  );
}
