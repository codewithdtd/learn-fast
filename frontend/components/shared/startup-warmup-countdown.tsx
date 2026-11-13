"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./startup-warmup-countdown.module.css";
import { pingBackendHealth } from "@/services/api";

export type StartupWarmupProps = {
  /** Initial estimated countdown in seconds (default: 45s) */
  initialSeconds?: number;
  /** Callback fired as soon as the service responds ready */
  onReady?: () => void;
  /** Usage context: "auth" | "dashboard" | "general" */
  context?: "auth" | "dashboard" | "general";
  /** Compact mode for inline widget embed */
  compact?: boolean;
};

type EnglishTip = {
  tag: string;
  phrase: string;
  meaning: string;
  example: string;
};

// Curated bite-sized English tips and idioms to read while waiting
const ENGLISH_TIPS: EnglishTip[] = [
  {
    tag: "Idiom of the Day",
    phrase: "Hit the ground running",
    meaning: "To start something with great energy, enthusiasm, and full speed.",
    example: '“I\'m ready to hit the ground running with 20 new vocabulary cards today!”',
  },
  {
    tag: "Spaced Repetition Secret",
    phrase: "The Spacing Effect",
    meaning: "Reviewing words right before you forget them boosts long-term retention up to 3x more than cramming.",
    example: "Learn-Fast automatically computes the optimal review interval for each card.",
  },
  {
    tag: "Common Idiom",
    phrase: "Burn the midnight oil",
    meaning: "To stay up late studying diligently or working on a challenging topic.",
    example: '“She burned the midnight oil preparing for her language assessment.”',
  },
  {
    tag: "Vocabulary Power",
    phrase: "Learn in Collocations",
    meaning: "Never memorize isolated single words. Always link a new word to a natural verb or everyday sentence.",
    example: "Instead of just 'decision', learn 'make a crucial decision'.",
  },
  {
    tag: "Common Idiom",
    phrase: "A piece of cake",
    meaning: "Something very easy to do without requiring much effort.",
    example: '“Once you master the root words, guessing new vocabulary is a piece of cake.”',
  },
  {
    tag: "Daily Habit",
    phrase: "The 10-Minute Golden Rule",
    meaning: "Practicing flashcards for 10 minutes every morning is far more effective than 2 hours on the weekend.",
    example: "Keeping your daily streak alive builds automatic language reflexes.",
  },
  {
    tag: "Common Idiom",
    phrase: "Learn the ropes",
    meaning: "To learn the basic skills and workflow of a new system or craft.",
    example: '“It only takes a couple of sessions to learn the ropes of this SRS app.”',
  },
  {
    tag: "Fluency Method",
    phrase: "Shadowing Technique",
    meaning: "Speaking words aloud and mimicking native audio in real time trains both your ears and pronunciation reflexes.",
    example: "Use the Video Practice and AI Speaking features to shadow native speakers.",
  },
];

export function StartupWarmupCountdown({
  initialSeconds = 45,
  onReady,
  context = "general",
  compact = false,
}: StartupWarmupProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [isAwake, setIsAwake] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [tipIndex, setTipIndex] = useState<number>(0);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const isPingingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Manage countdown timer ticking every second
  useEffect(() => {
    if (isAwake) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAwake]);

  // 2. Rotate learning tips every 6 seconds
  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ENGLISH_TIPS.length);
    }, 6000);
    return () => clearInterval(tipTimer);
  }, []);

  // 3. Health probe to detect when learning services are ready
  const probeServer = useCallback(async () => {
    if (isPingingRef.current || isAwake) return;
    isPingingRef.current = true;
    setIsPinging(true);
    try {
      const ok = await pingBackendHealth(65000);
      if (ok && isMountedRef.current) {
        setIsAwake(true);
        setTimeout(() => {
          if (onReadyRef.current) {
            onReadyRef.current();
          }
        }, 650);
      }
    } finally {
      isPingingRef.current = false;
      if (isMountedRef.current) {
        setIsPinging(false);
      }
    }
  }, [isAwake]);

  // 4. Start probe immediately upon mount
  useEffect(() => {
    if (isAwake) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runProbeCycle = async () => {
      if (isAwake || !isMountedRef.current) return;
      await probeServer();
      if (!isAwake && isMountedRef.current) {
        timer = setTimeout(runProbeCycle, 2500);
      }
    };

    void runProbeCycle();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAwake, probeServer]);

  // Progress Bar percentage calculation
  const progressPercent = isAwake
    ? 100
    : Math.min(95, Math.max(5, Math.round(((initialSeconds - secondsLeft) / initialSeconds) * 100)));

  // Clean, professional English stage messages
  const getStageMessage = () => {
    if (isAwake) return "✨ Ready! Entering your study space...";
    if (secondsLeft === 0) return "⏳ Finalizing connection, almost there...";
    const elapsed = initialSeconds - secondsLeft;
    if (elapsed < 8) return "☕ Waking up application services...";
    if (elapsed < 20) return "🍃 Connecting to learning services...";
    if (elapsed < 32) return "📦 Syncing study library & preferences...";
    if (elapsed < 42) return "🌱 Setting up your personalized dashboard...";
    return "🚀 Final step: Getting ready in a moment...";
  };

  const currentTip = ENGLISH_TIPS[tipIndex];

  const handleNextTip = () => {
    setTipIndex((prev) => (prev + 1) % ENGLISH_TIPS.length);
  };

  const handlePrevTip = () => {
    setTipIndex((prev) => (prev - 1 + ENGLISH_TIPS.length) % ENGLISH_TIPS.length);
  };

  return (
    <aside className={styles.warmupContainer} aria-live="polite" aria-busy={!isAwake}>
      <div className={styles.card}>
        {/* Header */}
        {!compact && (
          <header className={styles.headerWrap}>
            <div className={styles.mascotBadge} aria-hidden="true">
              {isAwake ? "🎉" : "☕"}
            </div>
            <h2 className={styles.title}>
              {isAwake ? "Workspace Ready!" : "Preparing Your Study Space"}
            </h2>
            <p className={styles.subtitle}>
              {isAwake
                ? "Your learning data is ready. Have a productive study session!"
                : context === "auth"
                ? "Connecting to secure services to sign you in. Please hold on a moment."
                : "Just a moment while we get everything ready for you (~30–45s)."}
            </p>
          </header>
        )}

        {/* Countdown display or ready banner */}
        {isAwake ? (
          <div className={styles.readyBanner}>
            <span>🚀</span>
            <span>Connected! Launching your workspace...</span>
          </div>
        ) : (
          <div className={styles.timerWrap}>
            <div className={styles.timerRow}>
              <span className={styles.countdownNumber}>{secondsLeft}</span>
              <span className={styles.countdownUnit}>seconds remaining</span>
            </div>

            {/* Smooth progress bar */}
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={styles.progressBar}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stage status indicator */}
            <div className={styles.stageStatus}>
              <span className={styles.pulsingDot} aria-hidden="true" />
              <span>{getStageMessage()}</span>
            </div>
          </div>
        )}

        {/* Quick Learning Corner */}
        <section className={styles.learningCorner} aria-label="Quick Learning Corner">
          <div className={styles.cornerHeader}>
            <span className={styles.cornerTag}>
              <span>💡</span>
              <span>{currentTip.tag}</span>
            </span>
            <div className={styles.cornerNav}>
              <button
                type="button"
                className={styles.navButton}
                onClick={handlePrevTip}
                aria-label="Previous tip"
                title="Previous tip"
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={handleNextTip}
                aria-label="Next tip"
                title="Next tip"
              >
                ›
              </button>
            </div>
          </div>
          <div className={styles.tipContent} key={tipIndex}>
            <p className={styles.tipPhrase}>{currentTip.phrase}</p>
            <p className={styles.tipMeaning}>{currentTip.meaning}</p>
            <p className={styles.tipExample}>{currentTip.example}</p>
          </div>
        </section>

        {/* Action buttons */}
        <footer className={styles.actionsRow}>
          <button
            type="button"
            className={styles.pingButton}
            onClick={() => void probeServer()}
            disabled={isPinging || isAwake}
          >
            {isPinging ? "🔄 Connecting..." : "⚡ Connect now"}
          </button>
          {secondsLeft === 0 && !isAwake && (
            <button
              type="button"
              className={styles.pingButton}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
            >
              🔄 Reload page
            </button>
          )}
        </footer>
      </div>
    </aside>
  );
}
