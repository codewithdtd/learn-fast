import type { WritingFeedback, WritingIssue, WritingStrength } from "@/types/writing";

export type FeedbackSegment =
  | { kind: "text"; text: string; key: string }
  | { kind: "issue"; text: string; issue: WritingIssue; key: string }
  | { kind: "strength"; text: string; strength: WritingStrength; key: string }
  | { kind: "insertion"; issue: WritingIssue; key: string };

export function splitAnnotatedText(text: string, feedback: WritingFeedback): FeedbackSegment[] {
  const characters = Array.from(text);
  const marks = [
    ...feedback.issues.map((issue) => ({ kind: "issue" as const, start: issue.start, end: issue.end, issue })),
    ...feedback.strengths.map((strength) => ({ kind: "strength" as const, start: strength.start, end: strength.end, strength })),
  ].sort((left, right) => left.start - right.start || left.end - right.end);
  const result: FeedbackSegment[] = [];
  let cursor = 0;
  let index = 0;
  while (index < marks.length) {
    const mark = marks[index];
    if (mark.start > cursor) {
      result.push({ kind: "text", text: characters.slice(cursor, mark.start).join(""), key: `text-${index}` });
      cursor = mark.start;
    }
    if (mark.kind === "issue" && mark.start === mark.end) {
      result.push({ kind: "insertion", issue: mark.issue, key: mark.issue.id });
      index += 1;
      continue;
    }
    if (mark.start < cursor) {
      index += 1;
      continue;
    }
    const textPart = characters.slice(mark.start, mark.end).join("");
    if (mark.kind === "issue") {
      result.push({ kind: "issue", text: textPart, issue: mark.issue, key: mark.issue.id });
    } else {
      result.push({ kind: "strength", text: textPart, strength: mark.strength, key: `strength-${index}` });
    }
    cursor = mark.end;
    index += 1;
  }
  if (cursor < characters.length) {
    result.push({ kind: "text", text: characters.slice(cursor).join(""), key: "text-tail" });
  }
  return result;
}
