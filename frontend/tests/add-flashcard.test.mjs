import test from "node:test";
import assert from "node:assert/strict";

function validateFlashcardInput({ phrase, meaning, example_en, example_vi }) {
  const cleanPhrase = phrase?.trim();
  const cleanMeaning = meaning?.trim();

  if (!cleanPhrase) {
    return { valid: false, error: "Phrase is required" };
  }
  if (!cleanMeaning) {
    return { valid: false, error: "Meaning is required" };
  }

  return {
    valid: true,
    payload: {
      phrase: cleanPhrase,
      meaning: cleanMeaning,
      example_en: example_en?.trim() || undefined,
      example_vi: example_vi?.trim() || undefined,
    },
  };
}

function canUserManageSheet({ user, isAuthenticated, sheetWorkbookUserId }) {
  if (!isAuthenticated || !user) return false;
  if (user.is_superuser) return true;
  if (user.id != null && sheetWorkbookUserId != null && user.id === sheetWorkbookUserId) {
    return true;
  }
  return false;
}

test("validateFlashcardInput trims whitespace and structures payload cleanly", () => {
  const result = validateFlashcardInput({
    phrase: "  serendipity  ",
    meaning: "  sự tình cờ may mắn  ",
    example_en: "  A happy accident.  ",
    example_vi: "  Một sự tình cờ vui vẻ.  ",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.payload, {
    phrase: "serendipity",
    meaning: "sự tình cờ may mắn",
    example_en: "A happy accident.",
    example_vi: "Một sự tình cờ vui vẻ.",
  });
});

test("validateFlashcardInput converts empty examples to undefined", () => {
  const result = validateFlashcardInput({
    phrase: "look forward to",
    meaning: "mong đợi",
    example_en: "   ",
    example_vi: "",
  });

  assert.equal(result.valid, true);
  assert.equal(result.payload.example_en, undefined);
  assert.equal(result.payload.example_vi, undefined);
});

test("validateFlashcardInput rejects empty phrase or whitespace-only meaning", () => {
  assert.equal(validateFlashcardInput({ phrase: "   ", meaning: "valid" }).valid, false);
  assert.equal(validateFlashcardInput({ phrase: "valid", meaning: "   " }).valid, false);
});

test("canUserManageSheet permits superuser and sheet owner, rejects guest and strangers", () => {
  // Guest
  assert.equal(canUserManageSheet({ user: null, isAuthenticated: false, sheetWorkbookUserId: 1 }), false);

  // Superuser on any sheet
  assert.equal(
    canUserManageSheet({
      user: { id: 99, is_superuser: true },
      isAuthenticated: true,
      sheetWorkbookUserId: 1,
    }),
    true
  );

  // Owner of their workbook's sheet
  assert.equal(
    canUserManageSheet({
      user: { id: 5, is_superuser: false },
      isAuthenticated: true,
      sheetWorkbookUserId: 5,
    }),
    true
  );

  // Stranger on another user's private sheet
  assert.equal(
    canUserManageSheet({
      user: { id: 7, is_superuser: false },
      isAuthenticated: true,
      sheetWorkbookUserId: 5,
    }),
    false
  );
});
