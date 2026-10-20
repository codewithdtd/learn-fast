import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExerciseQuestions,
  createExercisePool,
  gradeExerciseAnswer,
  normalizeExerciseAnswer,
  summarizeExercise,
} from "../lib/practice-exercises.ts";

const settings = { mode: "translation", direction: "en_to_vi", filter: "all", count: "all" };
const card = (id, phrase, meaning, extra = {}) => ({
  id, position: id, phrase, meaning, example_en: null, example_vi: null,
  is_weak: false, is_bookmarked: false, ...extra,
});
const cards = [card(1, "hello", "xin chào"), card(2, "bye", "tạm biệt"), card(3, "thanks", "cảm ơn")];

test("grading ignores formatting, preserves Vietnamese accents, and rejects synonyms or empty input", () => {
  const question = createExercisePool(cards, settings)[0];
  assert.equal(normalizeExerciseAnswer("  XIN,  CHÀO! "), "xin chào");
  assert.equal(gradeExerciseAnswer(question, " XIN  CHÀO! ").is_correct, true);
  assert.equal(gradeExerciseAnswer(question, "xin chao").is_correct, false);
  assert.equal(gradeExerciseAnswer(question, "chào bạn").is_correct, false);
  assert.equal(gradeExerciseAnswer(question, "...").is_correct, false);
});

test("reverse translation expects the English phrase", () => {
  const [question] = buildExerciseQuestions([cards[0]], { ...settings, direction: "vi_to_en" });
  assert.equal(question.prompt, "xin chào");
  assert.equal(gradeExerciseAnswer(question, "HELLO!").is_correct, true);
});

test("multiple choice has one normalized correct answer and at most four distinct options", () => {
  const source = [...cards, card(4, "good morning", "chào buổi sáng"),
    card(5, "good night", "chúc ngủ ngon"), card(6, "greetings", "XIN CHÀO!")];
  const questions = buildExerciseQuestions(source, { ...settings, mode: "multiple_choice" }, () => 0.2);
  assert.equal(questions.length, 6);
  for (const question of questions) {
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(normalizeExerciseAnswer)).size, 4);
    assert.equal(question.options.filter((option) => gradeExerciseAnswer(question, option).is_correct).length, 1);
  }
});

test("short sheets use fewer choices and disable multiple choice without distinct answers", () => {
  const options = { ...settings, mode: "multiple_choice" };
  assert.equal(createExercisePool([cards[0]], options).length, 0);
  assert.equal(createExercisePool([cards[0], card(4, "greetings", "Xin chào!")], options).length, 0);
  assert.equal(buildExerciseQuestions(cards.slice(0, 2), options)[0].options.length, 2);
});

test("ambiguous translation prompts are excluded and equivalent duplicates produce one question", () => {
  const source = [card(1, "bank", "ngân hàng"), card(2, "bank", "bờ sông"),
    card(3, "hello", "xin chào"), card(4, "HELLO!", "Xin chào.")];
  assert.deepEqual(createExercisePool(source, settings).map((question) => question.cardId), [3]);
});

test("cloze masks full phrase occurrences without matching parts of unrelated words", () => {
  const source = [
    card(1, "take off", "cất cánh", { example_en: "Planes take off here, and TAKE OFF there." }),
    card(2, "take", "lấy", { example_en: "A mistake is common." }),
    card(3, "fly", "bay"),
    card(4, "hello", "xin chào", { example_en: "Hello!" }),
    card(5, "...", "dấu câu", { example_en: "Use ... in this example." }),
  ];
  const questions = createExercisePool(source, { ...settings, mode: "cloze" });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].prompt, "Planes ____ here, and ____ there.");
  assert.equal(questions[0].hint, "cất cánh");
  assert.equal(gradeExerciseAnswer(questions[0], "Take off").is_correct, true);
});

test("cloze handles regex punctuation in phrases, adjacent matches and flexible whitespace", () => {
  const source = [card(1, "C++", "ngôn ngữ", { example_en: "Use C++ and c++ here." }),
    card(2, "hello", "xin chào", { example_en: "Say hello hello now." }),
    card(3, "take off", "cất cánh", { example_en: "Planes take   off daily." })];
  const questions = createExercisePool(source, { ...settings, mode: "cloze" });
  assert.equal(questions[0].prompt, "Use ____ and ____ here.");
  assert.equal(questions[1].prompt, "Say ____ ____ now.");
  assert.equal(gradeExerciseAnswer(questions[2], "take off").is_correct, true);
});

test("filters select question cards while distractors still come from the full sheet", () => {
  const source = [card(1, "hello", "xin chào", { is_weak: true }), ...cards.slice(1)];
  const questions = buildExerciseQuestions(source, { ...settings, mode: "multiple_choice", filter: "weak" });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].options.length, 3);
  assert.equal(createExercisePool(source, { ...settings, filter: "bookmarked" }).length, 0);
});

test("question limits cap at eligible cards and generation never mutates source data", () => {
  const source = Object.freeze(Array.from({ length: 25 }, (_, index) =>
    Object.freeze(card(index + 1, `phrase ${index + 1}`, `meaning ${index + 1}`))));
  const before = JSON.stringify(source);
  assert.equal(buildExerciseQuestions(source, { ...settings, count: "10" }).length, 10);
  assert.equal(buildExerciseQuestions(source, { ...settings, count: "20" }).length, 20);
  assert.equal(buildExerciseQuestions(source, settings).length, 25);
  assert.equal(buildExerciseQuestions(cards, { ...settings, count: "20" }).length, 3);
  const questions = buildExerciseQuestions(source, { ...settings, count: "10" }, () => 0);
  assert.equal(new Set(questions.map((question) => question.cardId)).size, 10);
  assert.equal(JSON.stringify(source), before);
});

test("summary scores actual answers rather than requested card count", () => {
  const [question] = createExercisePool(cards, settings);
  const responses = [gradeExerciseAnswer(question, "xin chào"), gradeExerciseAnswer(question, "wrong")];
  assert.deepEqual(summarizeExercise(responses), { correct: 1, total: 2, percentage: 50 });
  assert.deepEqual(summarizeExercise([]), { correct: 0, total: 0, percentage: 0 });
});
