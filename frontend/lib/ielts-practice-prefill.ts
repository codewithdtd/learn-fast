export const IELTS_PREFILL_SESSION_KEY = "learn-fast:ielts-practice-prefill";

export type IELTSPracticePrefill =
  | { kind: "video"; video_url: string; transcript_ticket: string }
  | { kind: "text"; text: string };

export function saveIELTSPracticePrefill(value: IELTSPracticePrefill): boolean {
  try {
    sessionStorage.setItem(IELTS_PREFILL_SESSION_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function consumeIELTSPracticePrefill(): IELTSPracticePrefill | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(IELTS_PREFILL_SESSION_KEY);
    sessionStorage.removeItem(IELTS_PREFILL_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw || raw.length > 120_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("kind" in value)) return null;
    if (value.kind === "video" && "video_url" in value && "transcript_ticket" in value
      && typeof value.video_url === "string" && value.video_url.length <= 2048
      && typeof value.transcript_ticket === "string" && value.transcript_ticket.length <= 100_000) {
      return { kind: "video", video_url: value.video_url, transcript_ticket: value.transcript_ticket };
    }
    if (value.kind === "text" && "text" in value && typeof value.text === "string" && value.text.length <= 16_000) {
      return { kind: "text", text: value.text };
    }
    return null;
  } catch {
    return null;
  }
}
