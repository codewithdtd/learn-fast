import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { DEFAULT_THEME, THEMES, THEME_INIT_SCRIPT, THEME_STORAGE_KEY, isTheme } from "../lib/theme.ts";

function initializeTheme(storedTheme, shouldThrow = false) {
  const document = { documentElement: { dataset: {} } };
  const window = {
    localStorage: {
      getItem(key) {
        assert.equal(key, THEME_STORAGE_KEY);
        if (shouldThrow) throw new Error("Storage is unavailable");
        return storedTheme;
      },
    },
  };
  vm.runInNewContext(THEME_INIT_SCRIPT, { window, document });
  return document.documentElement.dataset.theme;
}

test("theme registry contains five valid display modes and keeps Playful as default", () => {
  assert.deepEqual(Array.from(THEMES), ["light", "dark", "retro", "playful", "journey"]);
  assert.equal(DEFAULT_THEME, "playful");
  assert.ok(isTheme("journey"));
  assert.equal(isTheme("unsupported"), false);
});

test("the pre-hydration initializer restores valid choices and falls back safely", () => {
  assert.equal(initializeTheme("journey"), "journey");
  assert.equal(initializeTheme("unsupported"), "playful");
  assert.equal(initializeTheme(null), "playful");
  assert.equal(initializeTheme(null, true), "playful");
});
