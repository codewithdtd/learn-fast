import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSwipeDrag,
  SWIPE_COMMIT_THRESHOLD,
  SWIPE_INTENT_THRESHOLD,
  MAX_ROTATION_DEG,
  DAMPING_LIMIT,
} from "../lib/flashcard-gesture.ts";

test("identifies horizontal swipe intent over vertical scrolling", () => {
  // Pure vertical movement: scrolling intent, not swipe
  const verticalScroll = computeSwipeDrag(2, 40);
  assert.equal(verticalScroll.isIntent, false);

  // Tiny jitter under intent threshold
  const jitter = computeSwipeDrag(5, 2);
  assert.equal(jitter.isIntent, false);

  // Clear horizontal drag
  const horizontalDrag = computeSwipeDrag(25, 4);
  assert.equal(horizontalDrag.isIntent, true);
  assert.equal(horizontalDrag.resultType, "remembered");

  // Clear left drag
  const leftDrag = computeSwipeDrag(-30, 6);
  assert.equal(leftDrag.isIntent, true);
  assert.equal(leftDrag.resultType, "again");
});

test("applies elastic damping when dragged past damping limit", () => {
  // Within linear range (under 150px)
  const linear = computeSwipeDrag(100, 0);
  assert.equal(linear.offset, 100);

  // Beyond damping limit: offset should be dampened, not abrupt stop
  const draggedFar = computeSwipeDrag(250, 0);
  assert.ok(draggedFar.offset > DAMPING_LIMIT);
  assert.ok(draggedFar.offset < 250); // Less than raw 250 due to damping factor (0.35)
  assert.equal(draggedFar.offset, 150 + (250 - 150) * 0.35); // Exactly 185
});

test("caps rotation to MAX_ROTATION_DEG in both directions", () => {
  const farRight = computeSwipeDrag(400, 0);
  assert.equal(farRight.rotation, MAX_ROTATION_DEG);

  const farLeft = computeSwipeDrag(-400, 0);
  assert.equal(farLeft.rotation, -MAX_ROTATION_DEG);
});

test("interpolates preview progress smoothly from 0 to 1", () => {
  // Below preview start (15px)
  const start = computeSwipeDrag(10, 0);
  assert.equal(start.previewProgress, 0);

  // Halfway between 15px and 65px
  const mid = computeSwipeDrag(40, 0);
  assert.ok(mid.previewProgress > 0.4 && mid.previewProgress < 0.6);

  // At or beyond full preview (65px)
  const full = computeSwipeDrag(70, 0);
  assert.equal(full.previewProgress, 1);
});

test("correctly flags commit threshold for SRS answer", () => {
  // Just below commit threshold
  const almost = computeSwipeDrag(SWIPE_COMMIT_THRESHOLD - 5, 0);
  assert.equal(almost.isCommitted, false);

  // At commit threshold
  const committedRight = computeSwipeDrag(SWIPE_COMMIT_THRESHOLD, 0);
  assert.equal(committedRight.isCommitted, true);
  assert.equal(committedRight.resultType, "remembered");

  // Committed left
  const committedLeft = computeSwipeDrag(-SWIPE_COMMIT_THRESHOLD, 0);
  assert.equal(committedLeft.isCommitted, true);
  assert.equal(committedLeft.resultType, "again");
});
