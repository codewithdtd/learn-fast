/**
 * Web Speech API Engine for English Vocabulary Pronunciation
 * 
 * Provides client-side, zero-dependency, free text-to-speech
 * using the browser's built-in window.speechSynthesis.
 */

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Checks if the Web Speech Synthesis API is supported in the current environment.
 */
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Finds the most natural English voice available in the client system.
 * Prioritizes natural/online voices from Google, Microsoft, Apple.
 */
function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. First priority: Natural / Premium / Neural English voices
  const premiumEnVoice = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Natural") ||
        v.name.includes("Neural") ||
        v.name.includes("Online") ||
        v.name.includes("Google") ||
        v.name.includes("Samantha"))
  );
  if (premiumEnVoice) return premiumEnVoice;

  // 2. Second priority: Standard en-US or en-GB voices
  const standardEnVoice = voices.find((v) => v.lang === "en-US" || v.lang === "en-GB");
  if (standardEnVoice) return standardEnVoice;

  // 3. Fallback: Any voice with language starting with 'en'
  return voices.find((v) => v.lang.startsWith("en")) || null;
}

/**
 * Pronounces an English phrase using SpeechSynthesis.
 * Automatically cancels any currently speaking utterance.
 */
export function speakEnglish(text: string, options: SpeechOptions = {}): void {
  if (!isSpeechSupported() || !text.trim()) {
    options.onEnd?.();
    return;
  }

  // Cancel any ongoing speech to avoid queued overlap
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = options.lang || "en-US";
  // Rate 0.9 provides clear, well-paced pronunciation for language learners
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1.0;

  // Assign voice if available
  const voice = getBestEnglishVoice();
  if (voice) {
    utterance.voice = voice;
  }

  if (options.onStart) {
    utterance.onstart = () => {
      options.onStart?.();
    };
  }

  utterance.onend = () => {
    options.onEnd?.();
  };

  utterance.onerror = (event) => {
    // Interrupted speech when cancelling is a normal user interaction, not a critical error
    if (event.error !== "canceled" && event.error !== "interrupted") {
      options.onError?.(event);
    }
    options.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Stops any current speech immediately.
 */
export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}
