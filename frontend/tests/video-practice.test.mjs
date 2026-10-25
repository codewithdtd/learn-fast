import assert from "node:assert/strict";
import test from "node:test";
import {
  createDictationGapPrompt,
  evaluateDictationGaps,
  findTranscriptSegmentIndex,
  hasUserSeekedForward,
  isTranscriptSegmentPlaybackStarted,
  getTranscriptSegmentPlaybackDuration,
  normalizeDictationAnswer,
  reachedTranscriptSegmentEnd,
  splitTranscriptText,
} from "../lib/video-practice.ts";

test("dictation normalization ignores case, punctuation, and repeated whitespace", () => {
  assert.equal(normalizeDictationAnswer("  Good morning, world!  "), "good morning world");
  assert.equal(normalizeDictationAnswer("good   morning world"), "good morning world");
});

test("dictation normalization keeps Vietnamese diacritics significant", () => {
  assert.notEqual(normalizeDictationAnswer("một ngày"), normalizeDictationAnswer("mot ngay"));
});

test("transcript splitting preserves punctuation while marking words", () => {
  assert.deepEqual(splitTranscriptText("Don't wait!"), [
    { value: "Don't", isWord: true },
    { value: " ", isWord: false },
    { value: "wait", isWord: true },
    { value: "!", isWord: false },
  ]);
});

test("segment playback ends at the caption boundary", () => {
  assert.equal(reachedTranscriptSegmentEnd(12.49, 12.5), false);
  assert.equal(reachedTranscriptSegmentEnd(12.5, 12.5), true);
  assert.equal(reachedTranscriptSegmentEnd(12.8, 12.5), true);
  assert.equal(reachedTranscriptSegmentEnd(Number.NaN, 12.5), false);
});

test("segment stop watcher waits until the player reaches the requested timestamp", () => {
  assert.equal(isTranscriptSegmentPlaybackStarted(45, 10, 12), false);
  assert.equal(isTranscriptSegmentPlaybackStarted(9.75, 10, 12), true);
  assert.equal(isTranscriptSegmentPlaybackStarted(10, 10, 12), true);
  assert.equal(isTranscriptSegmentPlaybackStarted(12.1, 10, 12), false);
});

test("segment playback never overlaps the next caption timestamp", () => {
  assert.equal(getTranscriptSegmentPlaybackDuration(10, 4, 13), 3);
  assert.equal(getTranscriptSegmentPlaybackDuration(10, 2, 13), 2);
  assert.equal(getTranscriptSegmentPlaybackDuration(10, 2), 2);
  assert.equal(getTranscriptSegmentPlaybackDuration(10, 2, 9), 2);
});

test("transcript follows the most recent caption start without moving backward", () => {
  const segments = [{ start: 2 }, { start: 5 }, { start: 9 }];
  assert.equal(findTranscriptSegmentIndex(segments, 1.9), -1);
  assert.equal(findTranscriptSegmentIndex(segments, 2), 0);
  assert.equal(findTranscriptSegmentIndex(segments, 8.9), 1);
  assert.equal(findTranscriptSegmentIndex(segments, 9), 2);
  assert.equal(findTranscriptSegmentIndex(segments, Number.NaN), -1);
});

test("manual forward seeking overrides the selected-line stop boundary", () => {
  assert.equal(hasUserSeekedForward(13.2, 11.5), true);
  assert.equal(hasUserSeekedForward(12.9, 11.5), false);
  assert.equal(hasUserSeekedForward(12, null), false);
});

test("fill-the-gaps hides one to three different word positions", () => {
  const threeGaps = createDictationGapPrompt("The quick brown fox jumps.", () => 0.99);
  const oneGap = createDictationGapPrompt("Hello!", () => 0);
  const noGap = createDictationGapPrompt("...", () => 0);

  assert.equal(threeGaps.answers.length, 3);
  assert.equal(new Set(threeGaps.parts.flatMap((part) => part.gapIndex === null ? [] : [part.gapIndex])).size, 3);
  assert.equal(oneGap.answers.length, 1);
  assert.equal(noGap.answers.length, 0);
});

test("gap grading ignores capitalization and punctuation per blank", () => {
  assert.deepEqual(evaluateDictationGaps(["morning", "everyone"], ["Morning,", "every one"]), [true, false]);
  assert.deepEqual(evaluateDictationGaps(["hello"], []), [false]);
});
