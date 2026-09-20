"use client";

import { useSyncExternalStore, useState } from "react";
import { isSpeechSupported, speakEnglish } from "@/lib/speech";

interface AudioPronounceButtonProps {
  text: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
  rate?: number;
}

// Subscribe helper for SSR/hydration compatibility
function subscribe() {
  return () => {};
}

export function AudioPronounceButton({
  text,
  size = "md",
  className = "",
  title = "Listen to pronunciation",
  rate = 0.9,
}: AudioPronounceButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const supported = useSyncExternalStore(
    subscribe,
    () => isSpeechSupported(),
    () => false // Server snapshot is always false
  );

  if (!supported || !text) {
    return null;
  }

  function handlePlay(e: React.MouseEvent) {
    e.stopPropagation(); // Crucial: avoid flipping flashcard or selecting row
    e.preventDefault();

    if (isPlaying) return;

    speakEnglish(text, {
      rate,
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }

  const iconDimension = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  return (
    <button
      type="button"
      className={`audio-pronounce-btn audio-pronounce-btn--${size} ${isPlaying ? "is-playing" : ""} ${className}`}
      onClick={handlePlay}
      aria-label={`${title}: ${text}`}
      title={`${title} (Speech)`}
    >
      <svg
        width={iconDimension}
        height={iconDimension}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="audio-pronounce-icon"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {isPlaying ? (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className="sound-wave-inner animate-pulse" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" className="sound-wave-outer animate-pulse" />
          </>
        ) : (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
    </button>
  );
}

