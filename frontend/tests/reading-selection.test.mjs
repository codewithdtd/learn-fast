import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/reading-selection.ts", import.meta.url), "utf8");
const compiled = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 });
const { getReadingWordAtOffset } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("finds a tapped English word without including surrounding punctuation", () => {
  assert.deepEqual(getReadingWordAtOffset("Hello, world!", 8), { text: "world", start: 7, end: 12 });
  assert.equal(getReadingWordAtOffset("Hello, world!", 6), null);
});

test("keeps contractions and hyphenated words together", () => {
  assert.deepEqual(getReadingWordAtOffset("Don't give up.", 3), { text: "Don't", start: 0, end: 5 });
  assert.deepEqual(getReadingWordAtOffset("well-known", 5), { text: "well-known", start: 0, end: 10 });
});

test("uses DOM UTF-16 offsets and ignores out-of-range or whitespace taps", () => {
  assert.deepEqual(getReadingWordAtOffset("😀 hello", 4), { text: "hello", start: 3, end: 8 });
  assert.equal(getReadingWordAtOffset("one two", 3), null);
  assert.equal(getReadingWordAtOffset("one two", 4)?.text, "two");
  assert.equal(getReadingWordAtOffset("one", 3)?.text, "one");
  assert.equal(getReadingWordAtOffset("one", -1), null);
});
