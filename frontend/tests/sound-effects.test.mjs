import assert from "node:assert/strict";
import test from "node:test";
import {
  getExerciseSoundEnabled,
  getExerciseSoundServerSnapshot,
  setExerciseSoundEnabled,
  subscribeToExerciseSoundPreference,
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
