/**
 * Web Speech & Pronunciation Audio Engine for Learn-Fast
 * 
 * Supports:
 * 1. Web Speech Synthesis (SpeechSynthesisUtterance) on Desktop & Android with neural voices.
 * 2. iOS Safari Silent Mode Bypass: WebKit by default silences Web Speech when the iPhone's
 *    hardware mute switch / Focus mode is active. This engine unlocks the media pipeline
 *    via navigator.audioSession.type = 'playback', silent audio priming, and high-quality
 *    MP3 audio streaming (AVAudioSessionCategoryPlayback), guaranteeing clear pronunciation
 *    even when the physical silent switch is toggled ON.
 */

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

let availableVoices: SpeechSynthesisVoice[] = [];
let isListeningForVoices = false;
let isAudioUnlocked = false;
let currentPlayingAudio: HTMLAudioElement | null = null;
let currentPlayingEndCallback: (() => void) | null = null;

// Base64-encoded 0.1-second silent WAV audio data URI
// Playing this tiny silent buffer inside a user gesture primes WebKit's AVAudioSession to category 'playback'
const SILENT_WAV_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

/**
 * Detects if the client is running on an Apple iOS / iPadOS device.
 * iPadOS 13+ identifies as 'MacIntel' with multi-touch points (> 1).
 */
export function isIOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
}

/**
 * Checks if Speech Synthesis or HTML5 Audio is supported in the current environment.
 */
export function isSpeechSupported(): boolean {
  return (
    (typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window) ||
    typeof Audio !== "undefined"
  );
}

/**
 * Sets WebKit / Safari navigator.audioSession.type to 'playback' (iOS 16.4+).
 * This routes browser audio to AVAudioSessionCategoryPlayback, ignoring the hardware silent switch.
 */
export function setupAudioSessionPlayback(): void {
  if (typeof navigator !== "undefined" && "audioSession" in navigator) {
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== "playback") {
        nav.audioSession.type = "playback";
      }
    } catch {
      // Audio session type might be restricted outside user gestures on some versions
    }
  }
}

/**
 * Unlocks iOS Safari audio hardware routing.
 * When an iPhone has the physical silent switch turned ON (red indicator), WebKit strictly mutes Ambient audio.
 * By priming a tiny silent HTML5 audio buffer inside a user gesture with 'playback' audio session,
 * WebKit shifts the session category to Playback, allowing pronunciation to play out loud through the speakers.
 */
export function unlockIOSAudio(): void {
  if (typeof window === "undefined") return;

  setupAudioSessionPlayback();

  if (isAudioUnlocked) return;

  try {
    const silentAudio = new Audio(SILENT_WAV_URI);
    // Non-zero volume ensures WebKit doesn't optimize out the audio session category transition
    silentAudio.volume = 0.05;
    const playPromise = silentAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isAudioUnlocked = true;
          silentAudio.pause();
          silentAudio.remove();
        })
        .catch(() => {
          // Will be primed on subsequent user gesture
        });
    }
  } catch {
    // Ignore restricted environments
  }

  // Wake up window.speechSynthesis if it entered a paused or stalled state (known Safari bug)
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // Ignore
    }
  }
}

// Auto-register first user interaction listeners to unlock audio session as early as possible
if (typeof window !== "undefined") {
  const unlockEvents: Array<keyof WindowEventMap> = ["touchstart", "touchend", "click", "keydown"];
  const handleFirstInteraction = () => {
    unlockIOSAudio();
    unlockEvents.forEach((ev) => window.removeEventListener(ev, handleFirstInteraction, true));
  };
  unlockEvents.forEach((ev) => {
    window.addEventListener(ev, handleFirstInteraction, { capture: true, once: true, passive: true });
  });
}

/**
 * Generates an audio URL for English pronunciation.
 * Single words / short phrases (≤ 3 words) use Youdao American English MP3 audio.
 * Sentences use Google TTS MP3 audio.
 */
export function getPronunciationAudioUrl(text: string): string {
  const clean = text.trim();
  const wordCount = clean.split(/\s+/).length;
  if (wordCount <= 3 && clean.length <= 40) {
    return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=2`;
  }
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(clean)}`;
}

/**
 * Finds the most natural English voice available in the client system.
 * Prioritizes natural/online voices from Google, Microsoft, Apple.
 */
function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices.length > 0) {
    availableVoices = currentVoices;
  }
  if (!isListeningForVoices) {
    // iOS Safari can populate its voice list after the page starts, so keep the cache fresh.
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      availableVoices = window.speechSynthesis.getVoices();
    });
    isListeningForVoices = true;
  }

  const voices = currentVoices.length > 0 ? currentVoices : availableVoices;
  if (voices.length === 0) return null;

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
  return (
    voices.find((v) => v.lang.startsWith("en")) ||
    voices.find((v) => v.default) ||
    voices[0] ||
    null
  );
}

// Pre-load voices for Safari
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  availableVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    availableVoices = window.speechSynthesis.getVoices();
  });
  isListeningForVoices = true;
}

/**
 * Plays an audio stream via HTML5 Audio element.
 * Provides fallback to SpeechSynthesis if network or playback fails.
 */
function playAudioStream(
  url: string,
  options: SpeechOptions,
  onFallback: () => void
): void {
  stopSpeech();
  setupAudioSessionPlayback();

  try {
    const audio = new Audio(url);
    currentPlayingAudio = audio;
    if (options.rate && options.rate !== 1.0) {
      try {
        audio.playbackRate = options.rate;
      } catch {
        // Ignore playbackRate setting errors
      }
    }

    let hasStarted = false;
    currentPlayingEndCallback = () => {
      clearTimeout(fallbackTimeout);
      options.onEnd?.();
    };

    const fallbackTimeout = setTimeout(() => {
      if (!hasStarted) {
        if (currentPlayingAudio === audio) {
          currentPlayingAudio = null;
          currentPlayingEndCallback = null;
        }
        onFallback();
      }
    }, 2000);

    audio.onplay = () => {
      hasStarted = true;
      clearTimeout(fallbackTimeout);
      options.onStart?.();
    };

    audio.onended = () => {
      clearTimeout(fallbackTimeout);
      if (currentPlayingAudio === audio) {
        currentPlayingAudio = null;
        currentPlayingEndCallback = null;
      }
      options.onEnd?.();
    };

    audio.onerror = () => {
      clearTimeout(fallbackTimeout);
      if (currentPlayingAudio === audio) {
        currentPlayingAudio = null;
        currentPlayingEndCallback = null;
      }
      onFallback();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        clearTimeout(fallbackTimeout);
        if (currentPlayingAudio === audio) {
          currentPlayingAudio = null;
          currentPlayingEndCallback = null;
        }
        onFallback();
      });
    }
  } catch {
    onFallback();
  }
}

/**
 * Speaks text using the browser's native SpeechSynthesis API.
 */
function speakViaSynthesis(text: string, options: SpeechOptions): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = options.lang || "en-US";
  // Rate 0.9 provides clear, well-paced pronunciation for language learners
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1.0;

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
    if (event.error !== "canceled" && event.error !== "interrupted") {
      options.onError?.(event);
    }
    options.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Pronounces an English phrase with automatic device optimization:
 * - On iOS: uses HTML5 Audio stream (AVAudioSessionCategoryPlayback) so sound is NOT muted
 *   by the physical silent switch / mute toggle. Falls back to SpeechSynthesis if offline.
 * - On Desktop / Android: uses Web Speech Synthesis for instant, neural voice playback.
 */
export function speakEnglish(text: string, options: SpeechOptions = {}): void {
  if (!text.trim()) {
    options.onEnd?.();
    return;
  }

  // Prime the audio session on every interaction
  unlockIOSAudio();

  const isApple = isIOS();

  if (isApple) {
    // iOS Safari: Web Speech Synthesis is classified as Ambient by Apple and gets completely silenced
    // when the hardware silent switch is ON. HTML5 Audio in Playback mode bypasses this limitation.
    const streamUrl = getPronunciationAudioUrl(text);
    playAudioStream(streamUrl, options, () => {
      speakViaSynthesis(text, options);
    });
    return;
  }

  // Desktop Chrome, Edge, Firefox, Android
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    speakViaSynthesis(text, options);
  } else {
    const streamUrl = getPronunciationAudioUrl(text);
    playAudioStream(streamUrl, options, () => {
      options.onEnd?.();
    });
  }
}

/**
 * Stops any current speech or audio playback immediately.
 */
export function stopSpeech(): void {
  if (currentPlayingAudio) {
    try {
      currentPlayingAudio.pause();
      currentPlayingAudio.currentTime = 0;
      currentPlayingAudio = null;
    } catch {
      // Ignore
    }
    if (currentPlayingEndCallback) {
      const cb = currentPlayingEndCallback;
      currentPlayingEndCallback = null;
      cb();
    }
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}
