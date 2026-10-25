export function normalizeDictationAnswer(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitTranscriptText(text: string): Array<{ value: string; isWord: boolean }> {
  const values = text.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) ?? [text];
  return values.map((value) => ({ value, isWord: /^[\p{L}\p{M}]/u.test(value) }));
}

export type DictationGapPart = { value: string; gapIndex: number | null };
export type DictationGapPrompt = { parts: DictationGapPart[]; answers: string[] };

export function createDictationGapPrompt(text: string, random: () => number = Math.random): DictationGapPrompt {
  const tokens = splitTranscriptText(text);
  const wordTokenIndexes = tokens.flatMap((token, index) => token.isWord ? [index] : []);
  if (wordTokenIndexes.length === 0) {
    return { parts: tokens.map(({ value }) => ({ value, gapIndex: null })), answers: [] };
  }

  const maxGaps = Math.min(3, wordTokenIndexes.length);
  const gapCount = 1 + Math.floor(Math.min(Math.max(random(), 0), 0.999999) * maxGaps);
  const shuffledIndexes = [...wordTokenIndexes];
  for (let index = shuffledIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.min(Math.max(random(), 0), 0.999999) * (index + 1));
    [shuffledIndexes[index], shuffledIndexes[swapIndex]] = [shuffledIndexes[swapIndex], shuffledIndexes[index]];
  }

  const chosenIndexes = new Set(shuffledIndexes.slice(0, gapCount));
  const answers: string[] = [];
  const parts = tokens.map(({ value }, tokenIndex) => {
    if (!chosenIndexes.has(tokenIndex)) return { value, gapIndex: null };
    const gapIndex = answers.push(value) - 1;
    return { value: "", gapIndex };
  });
  return { parts, answers };
}

export function evaluateDictationGaps(expected: string[], actual: string[]): boolean[] {
  return expected.map((answer, index) => normalizeDictationAnswer(actual[index] ?? "") === normalizeDictationAnswer(answer));
}

export function reachedTranscriptSegmentEnd(currentTime: number, endSeconds: number): boolean {
  return Number.isFinite(currentTime) && Number.isFinite(endSeconds) && currentTime >= endSeconds;
}

export function hasUserSeekedForward(currentTime: number, previousTime: number | null): boolean {
  return previousTime !== null
    && Number.isFinite(currentTime)
    && Number.isFinite(previousTime)
    && currentTime - previousTime > 1.5;
}

export function isTranscriptSegmentPlaybackStarted(currentTime: number, startSeconds: number, endSeconds: number): boolean {
  return Number.isFinite(currentTime)
    && Number.isFinite(startSeconds)
    && Number.isFinite(endSeconds)
    && currentTime >= Math.max(0, startSeconds - 0.25)
    && currentTime <= endSeconds;
}

export function getTranscriptSegmentPlaybackDuration(
  startSeconds: number,
  durationSeconds: number,
  nextSegmentStartSeconds?: number,
): number {
  if (nextSegmentStartSeconds === undefined || nextSegmentStartSeconds <= startSeconds) return durationSeconds;
  return Math.min(durationSeconds, nextSegmentStartSeconds - startSeconds);
}

export function findTranscriptSegmentIndex(
  segments: ReadonlyArray<{ start: number }>,
  currentTime: number,
): number {
  if (!Number.isFinite(currentTime)) return -1;
  let activeIndex = -1;
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index].start > currentTime) break;
    activeIndex = index;
  }
  return activeIndex;
}
