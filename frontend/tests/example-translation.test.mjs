import test from "node:test";
import assert from "node:assert/strict";

import {
  createExercisePool,
  gradeExerciseAnswer,
  getExerciseEnglishSentence,
} from "../lib/practice-exercises.ts";

const mockCards = [
  {
    id: 1,
    phrase: "look forward to",
    meaning: "mong chờ",
    example_en: "I look forward to hearing from you.",
    example_vi: "Tôi rất mong chờ tin từ bạn.",
    is_weak: false,
    is_bookmarked: false,
  },
  {
    id: 2,
    phrase: "catch up",
    meaning: "bắt kịp / hàn huyên",
    example_en: "Let's catch up soon.",
    example_vi: "Hôm nào hàn huyên sớm nhé.",
    is_weak: true,
    is_bookmarked: false,
  },
  {
    id: 3,
    phrase: "no example",
    meaning: "không có ví dụ",
    example_en: null,
    example_vi: null,
    is_weak: false,
    is_bookmarked: false,
  },
  {
    id: 4,
    phrase: "en only",
    meaning: "chỉ có tiếng Anh",
    example_en: "English only here.",
    example_vi: null,
    is_weak: false,
    is_bookmarked: false,
  },
];

test("createExercisePool with example_translation filters cards with both English and Vietnamese examples", () => {
  const poolEnToVi = createExercisePool(mockCards, {
    mode: "example_translation",
    direction: "en_to_vi",
    filter: "all",
  });

  assert.equal(poolEnToVi.length, 2);
  assert.equal(poolEnToVi[0].prompt, "I look forward to hearing from you.");
  assert.equal(poolEnToVi[0].answer, "Tôi rất mong chờ tin từ bạn.");
  assert.equal(poolEnToVi[0].is_example, true);
  assert.equal(poolEnToVi[0].hint, null);
  assert.equal(poolEnToVi[0].meaning, "mong chờ");

  const poolViToEn = createExercisePool(mockCards, {
    mode: "example_translation",
    direction: "vi_to_en",
    filter: "all",
  });

  assert.equal(poolViToEn.length, 2);
  assert.equal(poolViToEn[0].prompt, "Tôi rất mong chờ tin từ bạn.");
  assert.equal(poolViToEn[0].answer, "I look forward to hearing from you.");
  assert.equal(poolViToEn[0].hint, null);
  assert.equal(poolViToEn[0].meaning, "mong chờ");
});

test("gradeExerciseAnswer accurately grades example translation in EN -> VI and VI -> EN", () => {
  const questionEnToVi = {
    cardId: 1,
    prompt: "I look forward to hearing from you.",
    answer: "Tôi rất mong chờ tin từ bạn.",
    hint: "look forward to",
    options: [],
    phrase: "look forward to",
    example_en: "I look forward to hearing from you.",
    example_vi: "Tôi rất mong chờ tin từ bạn.",
    is_example: true,
  };

  // Direct match
  const resExact = gradeExerciseAnswer(questionEnToVi, "Tôi rất mong chờ tin từ bạn.", {
    mode: "example_translation",
    direction: "en_to_vi",
  });
  assert.equal(resExact.is_correct, true);

  // High word coverage in Vietnamese
  const resCoverage = gradeExerciseAnswer(questionEnToVi, "mong chờ tin từ bạn", {
    mode: "example_translation",
    direction: "en_to_vi",
  });
  assert.equal(resCoverage.is_correct, true);

  // VI -> EN direction with contractions and punctuation
  const questionViToEn = {
    cardId: 2,
    prompt: "Hôm nào hàn huyên sớm nhé.",
    answer: "Let's catch up soon.",
    hint: "catch up",
    options: [],
    phrase: "catch up",
    example_en: "Let's catch up soon.",
    example_vi: "Hôm nào hàn huyên sớm nhé.",
    is_example: true,
  };

  const resViToEn = gradeExerciseAnswer(questionViToEn, "lets catch up soon", {
    mode: "example_translation",
    direction: "vi_to_en",
  });
  assert.equal(resViToEn.is_correct, true);
});

test("getExerciseEnglishSentence returns example_en for example_translation", () => {
  const question = {
    cardId: 1,
    prompt: "Tôi rất mong chờ tin từ bạn.",
    answer: "I look forward to hearing from you.",
    hint: "look forward to",
    options: [],
    phrase: "look forward to",
    example_en: "I look forward to hearing from you.",
    example_vi: "Tôi rất mong chờ tin từ bạn.",
    is_example: true,
  };

  const speechSentence = getExerciseEnglishSentence(question, {
    mode: "example_translation",
    direction: "vi_to_en",
  });

  assert.equal(speechSentence, "I look forward to hearing from you.");
});
