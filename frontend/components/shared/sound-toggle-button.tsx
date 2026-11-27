"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import {
  getExerciseSoundEnabled,
  getExerciseSoundServerSnapshot,
  setExerciseSoundEnabled,
  subscribeToExerciseSoundPreference,
  getExerciseSpeechEnabled,
  getExerciseSpeechServerSnapshot,
  setExerciseSpeechEnabled,
  subscribeToExerciseSpeechPreference,
  playSuccessSound,
} from "@/lib/sound-effects";
import { speakEnglish } from "@/lib/speech";

interface AudioToggleProps {
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

/**
 * Nút bật/tắt tiếng chuông "ting ting" khích lệ khi làm đúng câu bài tập.
 * Đồng bộ an toàn với localStorage và SSR qua useSyncExternalStore.
 */
export function SoundToggleButton({
  size = "md",
  className = "",
  showLabel = true,
}: AudioToggleProps) {
  const isEnabled = useSyncExternalStore(
    subscribeToExerciseSoundPreference,
    getExerciseSoundEnabled,
    getExerciseSoundServerSnapshot,
  );

  function handleToggle() {
    const nextState = !isEnabled;
    setExerciseSoundEnabled(nextState);
    if (nextState) {
      // Phát thử một nốt chuông "ting" ngắn khi bật lại
      playSuccessSound();
    }
  }

  const iconDimension = size === "sm" ? 13 : 15;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-2 py-1 text-xs font-medium text-foreground transition-all hover:bg-surface-low hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground ${
        !isEnabled ? "opacity-75 text-muted bg-surface/50" : ""
      } ${className}`}
      data-muted={!isEnabled}
      aria-label={
        isEnabled
          ? "Notification chime: Enabled (Click to mute)"
          : "Notification chime: Muted (Click to enable)"
      }
      title={
        isEnabled
          ? "Chime sound on correct answer: Enabled (Click to mute)"
          : "Chime sound on correct answer: Muted (Click to enable)"
      }
    >
      {isEnabled ? (
        <Bell className="text-primary shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      ) : (
        <BellOff className="text-muted shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      )}
      {showLabel && <span>{isEnabled ? "Chime ON" : "Chime OFF"}</span>}
    </button>
  );
}

/**
 * Nút bật/tắt tự động đọc từ / cụm từ tiếng Anh sau khi làm bài tập đúng.
 * Cho phép người học tắt giọng đọc phát âm nhưng vẫn giữ nguyên tiếng chuông "ting ting".
 */
export function SpeechToggleButton({
  size = "md",
  className = "",
  showLabel = true,
}: AudioToggleProps) {
  const isEnabled = useSyncExternalStore(
    subscribeToExerciseSpeechPreference,
    getExerciseSpeechEnabled,
    getExerciseSpeechServerSnapshot,
  );

  function handleToggle() {
    const nextState = !isEnabled;
    setExerciseSpeechEnabled(nextState);
    if (nextState) {
      // Phát âm thử một mẫu ngắn khi bật lại
      speakEnglish("Ready");
    }
  }

  const iconDimension = size === "sm" ? 13 : 15;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-2 py-1 text-xs font-medium text-foreground transition-all hover:bg-surface-low hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground ${
        !isEnabled ? "opacity-75 text-muted bg-surface/50" : ""
      } ${className}`}
      data-muted={!isEnabled}
      aria-label={
        isEnabled
          ? "Vocabulary pronunciation: Enabled (Click to disable)"
          : "Vocabulary pronunciation: Disabled (Click to enable)"
      }
      title={
        isEnabled
          ? "Auto-pronounce English vocabulary on correct answer: Enabled (Click to disable)"
          : "Auto-pronounce English vocabulary on correct answer: Disabled (Click to enable)"
      }
    >
      {isEnabled ? (
        <Volume2 className="text-primary shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      ) : (
        <VolumeX className="text-muted shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      )}
      {showLabel && <span>{isEnabled ? "Speech ON" : "Speech OFF"}</span>}
    </button>
  );
}

/**
 * Bộ điều khiển âm thanh tổng hợp cho bài tập: gồm Chuông Ting Ting và Phát âm đọc từ
 */
export function ExerciseAudioControls({
  size = "md",
  showLabel = true,
}: {
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <SoundToggleButton size={size} showLabel={showLabel} />
      <SpeechToggleButton size={size} showLabel={showLabel} />
    </div>
  );
}
