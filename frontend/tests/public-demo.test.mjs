import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CARDS, DEMO_SHEET, DEMO_VIEWS } from "../lib/demo-data.ts";
import { buildExerciseQuestions, gradeExerciseAnswer } from "../lib/practice-exercises.ts";

test("the public preview contains one self-contained sample sheet", () => {
  assert.equal(DEMO_SHEET.id, 0);
  assert.equal(DEMO_SHEET.workbook.id, 0);
  assert.equal(DEMO_SHEET.card_count, DEMO_CARDS.length);
  assert.equal(new Set(DEMO_CARDS.map((card) => card.id)).size, DEMO_CARDS.length);
  assert.ok(DEMO_CARDS.every((card) => card.phrase && card.meaning && card.example_en && card.example_vi));
  assert.deepEqual(DEMO_VIEWS, ["overview", "flashcards", "table", "exercises", "calendar", "import", "ai"]);
});

test("every exercise is usable from the fixed sample without changing its data", () => {
  const original = JSON.stringify(DEMO_CARDS);
  for (const mode of ["multiple_choice", "translation", "cloze"]) {
    const questions = buildExerciseQuestions(DEMO_CARDS, { mode, direction: "en_to_vi", filter: "all", count: "10" });
    assert.equal(questions.length, DEMO_CARDS.length);
    for (const question of questions) assert.equal(gradeExerciseAnswer(question, question.answer).is_correct, true);
  }
  assert.equal(JSON.stringify(DEMO_CARDS), original);
});
