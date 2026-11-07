"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getExerciseSoundEnabled,
  getExerciseSoundServerSnapshot,
  setExerciseSoundEnabled,
  subscribeToExerciseSoundPreference,
  playSuccessSound,
} from "@/lib/sound-effects";

interface SoundToggleButtonProps {
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

/**
 * Sound effect toggle button for exercises.
 * Synchronizes with localStorage and system preference via useSyncExternalStore.
 */
export function SoundToggleButton({
  size = "md",
  className = "",
  showLabel = true,
}: SoundToggleButtonProps) {
  const isEnabled = useSyncExternalStore(
    subscribeToExerciseSoundPreference,
    getExerciseSoundEnabled,
    getExerciseSoundServerSnapshot,
  );

  function handleToggle() {
    const nextState = !isEnabled;
    setExerciseSoundEnabled(nextState);
    if (nextState) {
      // Play a brief sample chime when user turns sound on
      playSuccessSound();
    }
  }

  const iconDimension = size === "sm" ? 14 : 16;

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-outline bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:bg-surface-low hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground ${
        !isEnabled ? "opacity-75 text-muted" : ""
      } ${className}`}
      data-muted={!isEnabled}
      aria-label={
        isEnabled
          ? "Sound effects: Enabled (Click to mute)"
          : "Sound effects: Muted (Click to enable)"
      }
      title={
        isEnabled
          ? "Sound effects: Enabled (Click to mute)"
          : "Sound effects: Muted (Click to enable)"
      }
    >
      {isEnabled ? (
        <Volume2 className="text-primary shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      ) : (
        <VolumeX className="text-muted shrink-0" style={{ width: iconDimension, height: iconDimension }} />
      )}
      {showLabel && (
        <span>{isEnabled ? "Sound ON" : "Sound OFF"}</span>
      )}
    </button>
  );
}
