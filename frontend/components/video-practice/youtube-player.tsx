"use client";

import { useEffect, useRef } from "react";
import { hasUserSeekedForward, isTranscriptSegmentPlaybackStarted, reachedTranscriptSegmentEnd } from "@/lib/video-practice";
import styles from "./video-practice.module.css";

type YouTubePlayerHandle = {
  loadVideoById: (options: { videoId: string; startSeconds: number }) => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  isMuted: () => boolean;
  unMute: () => void;
  destroy: () => void;
};

type PlayerEvent = { target: YouTubePlayerHandle };
type PlayerStateEvent = { data: number; target: YouTubePlayerHandle };
type PlayerErrorEvent = { data: number };
type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: PlayerEvent) => void;
        onStateChange: (event: PlayerStateEvent) => void;
        onError: (event: PlayerErrorEvent) => void;
      };
    },
  ) => YouTubePlayerHandle;
};
type WindowWithYouTube = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

export type YouTubeController = {
  playSegment: (start: number, duration: number) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
};

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const youtubeWindow = window as WindowWithYouTube;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    let timeout = 0;
    const previousCallback = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      window.clearTimeout(timeout);
      if (youtubeWindow.YT?.Player) resolve(youtubeWindow.YT);
      else reject(new Error("The YouTube player could not be initialized."));
    };

    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    script.onerror = () => reject(new Error("The YouTube player could not be loaded."));
    timeout = window.setTimeout(() => reject(new Error("The YouTube player took too long to load.")), 15000);
  }).catch((error: unknown) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

export function YouTubePlayer({
  videoId,
  onReady,
  onError,
  onTimeUpdate,
}: {
  videoId: string;
  onReady: (controller: YouTubeController) => void;
  onError: (message: string) => void;
  onTimeUpdate: (currentTime: number) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    let active = true;
    let player: YouTubePlayerHandle | null = null;
    let activeSegment: { start: number; end: number } | null = null;
    let segmentPlaybackStarted = false;
    let lastSegmentTime: number | null = null;
    let stopPollingTimer: number | null = null;
    const clearStopPolling = () => {
      if (stopPollingTimer !== null) {
        window.clearInterval(stopPollingTimer);
        stopPollingTimer = null;
      }
    };
    void loadYouTubeApi().then((youtube) => {
      if (!active || !mountRef.current) return;
      player = new youtube.Player(mountRef.current, {
        videoId,
        playerVars: { playsinline: 1, controls: 1, disablekb: 0, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            const readyPlayer = event.target;
            if (!active) return;
            onReady({
              playSegment: (start, duration) => {
                clearStopPolling();
                activeSegment = { start, end: start + duration };
                segmentPlaybackStarted = false;
                lastSegmentTime = null;
                // Track the live playback clock because YouTube's endSeconds can stop late on caption boundaries.
                readyPlayer.pauseVideo();
                readyPlayer.loadVideoById({ videoId, startSeconds: start });
              },
              setVolume: (volume) => {
                readyPlayer.setVolume(volume);
                if (volume > 0 && readyPlayer.isMuted()) readyPlayer.unMute();
              },
              getVolume: () => readyPlayer.getVolume(),
            });
          },
          onStateChange: (event) => {
            if (!active) return;
            if (event.data === 1 && stopPollingTimer === null) {
              stopPollingTimer = window.setInterval(() => {
                if (!active) return;
                const currentTime = event.target.getCurrentTime();
                if (activeSegment) {
                  if (!segmentPlaybackStarted) {
                    segmentPlaybackStarted = isTranscriptSegmentPlaybackStarted(currentTime, activeSegment.start, activeSegment.end);
                    if (!segmentPlaybackStarted) {
                      if (currentTime > activeSegment.end + 0.5) {
                        activeSegment = null;
                        onTimeUpdateRef.current(currentTime);
                      }
                      lastSegmentTime = currentTime;
                      return;
                    }
                  }
                  if (!reachedTranscriptSegmentEnd(currentTime, activeSegment.end)) {
                    lastSegmentTime = currentTime;
                    return;
                  }
                  // A large clock jump means the learner used YouTube's seek bar; honor that action instead of pausing at the old caption boundary.
                  if (hasUserSeekedForward(currentTime, lastSegmentTime)) {
                    activeSegment = null;
                    segmentPlaybackStarted = false;
                    lastSegmentTime = null;
                    onTimeUpdateRef.current(currentTime);
                    return;
                  }
                  activeSegment = null;
                  lastSegmentTime = null;
                  clearStopPolling();
                  event.target.pauseVideo();
                  return;
                }
                lastSegmentTime = null;
                onTimeUpdateRef.current(currentTime);
              }, 50);
            } else if (event.data === 0) {
              onTimeUpdateRef.current(event.target.getCurrentTime());
              activeSegment = null;
              clearStopPolling();
            } else if (event.data === 2) {
              clearStopPolling();
            }
          },
          onError: (event) => {
            activeSegment = null;
            clearStopPolling();
            const message = event.data === 101 || event.data === 150
              ? "This video owner does not allow playback in embedded players."
              : "The YouTube video could not be played.";
            onError(message);
          },
        },
      });
    }).catch((error: unknown) => {
      if (active) onError(error instanceof Error ? error.message : "The YouTube player could not be loaded.");
    });

    return () => {
      active = false;
      activeSegment = null;
      clearStopPolling();
      player?.destroy();
    };
  }, [videoId, onError, onReady]);

  return <div className={styles.videoPlayerFrame}><div ref={mountRef} className={styles.videoPlayerMount} /></div>;
}
