import assert from "node:assert/strict";
import test from "node:test";
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
} from "../lib/sound-effects.ts";

test("getExerciseSoundServerSnapshot returns true for SSR hydration consistency", () => {
  assert.equal(getExerciseSoundServerSnapshot(), true);
});

test("exercise sound preference defaults to true and can be toggled", () => {
  setExerciseSoundEnabled(true);
  assert.equal(getExerciseSoundEnabled(), true);

  setExerciseSoundEnabled(false);
  assert.equal(getExerciseSoundEnabled(), false);

  // Restore to true
  setExerciseSoundEnabled(true);
  assert.equal(getExerciseSoundEnabled(), true);
});

test("subscribeToExerciseSoundPreference notifies listeners on preference changes", () => {
  let callCount = 0;
  const unsubscribe = subscribeToExerciseSoundPreference(() => {
    callCount += 1;
  });

  setExerciseSoundEnabled(false);
  assert.equal(callCount, 1);

  setExerciseSoundEnabled(true);
  assert.equal(callCount, 2);

  unsubscribe();
  setExerciseSoundEnabled(false);
  // After unsubscribe, callCount should remain unchanged
  assert.equal(callCount, 2);

  // Restore default
  setExerciseSoundEnabled(true);
});

test("playSuccessSound executes safely in any environment without throwing", () => {
  assert.doesNotThrow(() => {
    playSuccessSound();
  });
});

test("exercise speech preference defaults to true and can be toggled independently", () => {
  assert.equal(getExerciseSpeechServerSnapshot(), true);
  setExerciseSpeechEnabled(true);
  assert.equal(getExerciseSpeechEnabled(), true);

  // Turn speech OFF while sound (ting chime) stays ON
  setExerciseSpeechEnabled(false);
  assert.equal(getExerciseSpeechEnabled(), false);
  assert.equal(getExerciseSoundEnabled(), true); // Ting chime still ON!

  // Restore to true
  setExerciseSpeechEnabled(true);
  assert.equal(getExerciseSpeechEnabled(), true);
});

test("subscribeToExerciseSpeechPreference notifies listeners on speech preference changes", () => {
  let callCount = 0;
  const unsubscribe = subscribeToExerciseSpeechPreference(() => {
    callCount += 1;
  });

  setExerciseSpeechEnabled(false);
  assert.equal(callCount, 1);

  setExerciseSpeechEnabled(true);
  assert.equal(callCount, 2);

  unsubscribe();
  setExerciseSpeechEnabled(false);
  assert.equal(callCount, 2);

  // Restore default
  setExerciseSpeechEnabled(true);
});


