const JOURNEY_SOUNDS_STORAGE_KEY = "learn-fast-journey-sounds";

let sharedAudioContext: AudioContext | null = null;
let lastCompletionSoundTime = 0;
let fallbackSoundEnabled = true;
const soundPreferenceListeners = new Set<() => void>();

export function subscribeToJourneySoundPreference(listener: () => void): () => void {
  soundPreferenceListeners.add(listener);
  function handleStorage(event: StorageEvent) {
    if (event.key === JOURNEY_SOUNDS_STORAGE_KEY || event.key === null) listener();
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    soundPreferenceListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getJourneySoundsServerSnapshot(): boolean {
  return true;
}

export function getJourneySoundsEnabled(): boolean {
  try {
    const storedPreference = window.localStorage.getItem(JOURNEY_SOUNDS_STORAGE_KEY);
    if (storedPreference === "off") return false;
    if (storedPreference === "on") return true;
    return fallbackSoundEnabled;
  } catch {
    return fallbackSoundEnabled;
  }
}

export function setJourneySoundsEnabled(enabled: boolean): void {
  fallbackSoundEnabled = enabled;
  try {
    window.localStorage.setItem(JOURNEY_SOUNDS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Sound remains available in this tab even when the browser blocks persistent storage.
  }
  soundPreferenceListeners.forEach((listener) => listener());
}

function getAudioContext(): AudioContext | null {
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

export function unlockJourneyCompletionAudio(): void {
  if (document.documentElement.dataset.theme !== "journey" || !getJourneySoundsEnabled()) return;
  const context = getAudioContext();
  if (context?.state === "suspended") void context.resume().catch(() => {});
}

export function playJourneyCompletionSound(completionId?: string): void {
  if (document.documentElement.dataset.theme !== "journey" || !getJourneySoundsEnabled()) return;

  const now = performance.now();
  if (lastCompletionSoundTime > 0 && now - lastCompletionSoundTime < 500) return;
  if (completionId && wasCompletionSoundPlayed(completionId)) return;

  try {
    const context = getAudioContext();
    if (!context) return;
    lastCompletionSoundTime = now;
    if (context.state === "suspended") void context.resume().catch(() => {});

    // The ascending, quiet chime is reserved for completed practice rounds; it never plays on ordinary taps.
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const startAt = context.currentTime + 0.005 + index * 0.065;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);
      volume.gain.setValueAtTime(0.0001, startAt);
      volume.gain.exponentialRampToValueAtTime(0.012, startAt + 0.012);
      volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.135);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.14);
      oscillator.onended = () => {
        oscillator.disconnect();
        volume.disconnect();
      };
    });
    if (completionId) markCompletionSoundPlayed(completionId);
  } catch {
    // Browsers may deny audio playback; visual and keyboard feedback must remain fully usable.
  }
}

function wasCompletionSoundPlayed(completionId: string): boolean {
  try {
    return window.sessionStorage.getItem("learn-fast-completion-sound:" + completionId) === "played";
  } catch {
    return false;
  }
}

function markCompletionSoundPlayed(completionId: string): void {
  try {
    window.sessionStorage.setItem("learn-fast-completion-sound:" + completionId, "played");
  } catch {
    // The short cooldown still prevents a duplicate chime if session storage is unavailable.
  }
}
