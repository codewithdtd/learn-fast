export type ReadingWord = { text: string; start: number; end: number };

export function getReadingWordAtOffset(text: string, offset: number): ReadingWord | null {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) return null;
  // Include contractions and hyphenated words; DOM Range offsets use UTF-16 code units.
  const words = /[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g;
  for (const match of text.matchAll(words)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (offset >= start && (offset < end || (offset === end && offset === text.length))) return { text: match[0], start, end };
  }
  return null;
}
