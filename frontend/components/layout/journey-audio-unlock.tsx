"use client";

import { useEffect } from "react";
import { unlockJourneyCompletionAudio } from "@/lib/journey-sounds";

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest("button, a[href], input, textarea, select, [role='button'], [role='tab'], [role='switch'], [role='radio'], [role='checkbox']");
  return control instanceof HTMLElement && !control.matches(":disabled, [aria-disabled='true']");
}

export function JourneyAudioUnlock() {
  useEffect(() => {
    // Silently unlock audio after a real control gesture so a later async completion can play its chime.
    function handlePointerDown(event: PointerEvent) {
      if (event.isPrimary && event.button === 0 && isInteractiveTarget(event.target)) unlockJourneyCompletionAudio();
    }

    function handleKeyboard(event: KeyboardEvent) {
      const studyRatingShortcut = ["1", "2", "3", "4"].includes(event.key)
        && document.querySelector(".study-session-content") !== null;
      if (!event.repeat && (
        (event.key === "Enter" || event.key === " ") && isInteractiveTarget(event.target)
        || studyRatingShortcut
      )) {
        unlockJourneyCompletionAudio();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyboard, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyboard, true);
    };
  }, []);

  return null;
}
