/**
 * Sound Effects Engine for Exercise Feedback
 * 
 * Provides client-side, zero-asset, ultra-low latency auditory feedback
 * using the browser's native Web Audio API (AudioContext).
 * 
 * Features:
 * - Uplifting, crystal-clear 2-tone "ting" chime (G5 -> E6) for correct answers.
 * - Gentle exponential decay envelope mimicking natural acoustic bells.
 * - Zero external media files to load: 100% offline, instantaneous response (< 5ms).
 * - User preference toggle (stored in localStorage) with SSR-safe synchronization.
 * - Mobile & iOS WebKit compliant with automatic AudioContext resume.
 */

const EXERCISE_SOUND_STORAGE_KEY = "learn-fast-exercise-sound";

let sharedAudioContext: AudioContext | null = null;
let lastSoundPlayTime = 0;
let fallbackSoundEnabled = true;
const soundPreferenceListeners = new Set<() => void>();

/**
 * Returns the singleton AudioContext instance safely in the browser.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    sharedAudioContext ??= new AudioContextConstructor();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * SSR safe snapshot of sound preference (defaults to true on server).
 */
export function getExerciseSoundServerSnapshot(): boolean {
  return true;
}

/**
 * Retrieves the current user preference for exercise sound effects.
 * Defaults to true if unconfigured.
 */
export function getExerciseSoundEnabled(): boolean {
  if (typeof window === "undefined") return fallbackSoundEnabled;
  try {
    const stored = window.localStorage.getItem(EXERCISE_SOUND_STORAGE_KEY);
    if (stored === "off") return false;
    if (stored === "on") return true;
    return fallbackSoundEnabled;
  } catch {
    return fallbackSoundEnabled;
  }
}

/**
 * Updates the user preference for exercise sound effects and notifies listeners.
 */
export function setExerciseSoundEnabled(enabled: boolean): void {
  fallbackSoundEnabled = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(EXERCISE_SOUND_STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Storage might be restricted in private browsing
    }
  }
  soundPreferenceListeners.forEach((listener) => listener());
}

/**
 * Subscribes to sound preference changes across tabs or UI controls.
 */
export function subscribeToExerciseSoundPreference(listener: () => void): () => void {
  soundPreferenceListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === EXERCISE_SOUND_STORAGE_KEY || event.key === null) {
      listener();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    soundPreferenceListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

/**
 * Plays a cheerful, crystal-clear "ting" chime to reward correct answers.
 * 
 * Musical structure:
 * - Note 1: G5 (783.99 Hz) short anticipation note (duration: 0.07s)
 * - Note 2: E6 (1318.51 Hz) bright, crystalline bell chime with an exponential decay envelope (duration: 0.38s)
 * - Secondary harmonic: E7 (2637.02 Hz) subtle shimmer overtone at 20% gain for acoustic sparkle.
 */
export function playSuccessSound(): void {
  if (!getExerciseSoundEnabled()) return;

  const now = performance.now();
  // Prevent duplicate sounds when multiple events fire in rapid succession (< 150ms)
  if (lastSoundPlayTime > 0 && now - lastSoundPlayTime < 150) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    lastSoundPlayTime = now;

    // Wake up suspended audio context from browser autoplay policies
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }

    const t0 = ctx.currentTime + 0.005;

    // --- Note 1: Warm preparation note (G5 - 783.99 Hz) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, t0);
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(0.065, t0 + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.075);
    osc1.onended = () => {
      osc1.disconnect();
      gain1.disconnect();
    };

    // --- Note 2: Main bright "Ting" chime (E6 - 1318.51 Hz) ---
    const t1 = t0 + 0.07;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.51, t1);
    gain2.gain.setValueAtTime(0.0001, t1);
    gain2.gain.linearRampToValueAtTime(0.12, t1 + 0.008);
    // Exponential decay creates a natural bell resonance fading over ~0.35s
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.36);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.38);
    osc2.onended = () => {
      osc2.disconnect();
      gain2.disconnect();
    };

    // --- Secondary shimmer overtone (E7 - 2637.02 Hz) for crystalline sparkle ---
    const oscSparkle = ctx.createOscillator();
    const gainSparkle = ctx.createGain();
    oscSparkle.type = "sine";
    oscSparkle.frequency.setValueAtTime(2637.02, t1);
    gainSparkle.gain.setValueAtTime(0.0001, t1);
    gainSparkle.gain.linearRampToValueAtTime(0.025, t1 + 0.006);
    gainSparkle.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.22);
    oscSparkle.connect(gainSparkle);
    gainSparkle.connect(ctx.destination);
    oscSparkle.start(t1);
    oscSparkle.stop(t1 + 0.24);
    oscSparkle.onended = () => {
      oscSparkle.disconnect();
      gainSparkle.disconnect();
    };
  } catch {
    // Graceful degradation: sound failure must never break core learning functionality
  }
}

