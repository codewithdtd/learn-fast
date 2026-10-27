import type {
  WritingAttempt,
  WritingAttemptList,
  WritingFeedback,
  WritingErrorHistory,
  ParagraphPracticeTask,
  GuestWritingTopic,
  WritingPrompt,
  WritingPromptList,
  WritingUsage,
} from "@/types/writing";
import type { SpeakingAttempt, SpeakingAttemptList, SpeakingFeedback, SpeakingPrompt, SpeakingPromptList, SpeakingUsage } from "@/types/speaking";

export type HealthResponse = {
  status: "ok";
  demo_mode?: boolean;
};

export async function getSystemHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/v1/health");
}


export type ImportedSheet = {
  id: number;
  name: string;
  position: number;
  card_count: number;
};

export type WorkbookImportResponse = {
  id: number;
  name: string;
  original_filename: string;
  sheet_count: number;
  total_cards: number;
  imported_at: string;
  sheets: ImportedSheet[];
};

export type ImportValidationError = {
  sheet_name: string;
  row_number: number | null;
  column: string | null;
  message: string;
};

export type SheetStatus = "not_started" | "learning" | "learned" | "due";
export type SheetPriority = "high" | "medium" | "low";

export type WorkbookListItem = {
  id: number;
  name: string;
  original_filename: string;
  sheet_count: number;
  total_cards: number;
  imported_at: string;
};

export type SheetSummary = {
  id: number;
  name: string;
  position: number;
  card_count: number;
  status: SheetStatus;
  priority: SheetPriority;
  next_review_at: string | null;
  is_ai_generated?: boolean;
};

export type WorkbookDetail = WorkbookListItem & {
  sheets: SheetSummary[];
};

export type SheetDetail = SheetSummary & {
  first_learned_at: string | null;
  last_reviewed_at: string | null;
  srs_level: number;
  interval_days: number;
  review_count: number;
  lapse_count: number;
  workbook: { id: number; name: string };
};

export type FlashcardListItem = {
  id: number;
  position: number;
  phrase: string;
  meaning: string;
  example_en: string | null;
  example_vi: string | null;
  is_weak: boolean;
  is_bookmarked: boolean;
};

export type TranscriptSegment = {
  start: number;
  duration: number;
  text: string;
};

export type VideoTranscript = {
  video_id: string;
  title: string | null;
  author_name: string | null;
  language_code: string | null;
  caption_type: string | null;
  segments: TranscriptSegment[];
};

export type WordDefinition = {
  part_of_speech: string | null;
  definition: string;
  example: string | null;
};

export type WordLookup = {
  term: string;
  translation_vi: string | null;
  phonetic: string | null;
  audio_url: string | null;
  definitions: WordDefinition[];
  translation_error?: string | null;
  translation_retry_after?: number | null;
};

export type ReadingCategory = { id: string; name: string };
export type ReadingSource = { id: string; name: string; categories: ReadingCategory[] };
export type ReadingArticle = {
  id: string;
  source_id: string;
  source_name: string;
  category: string;
  title: string;
  summary: string;
  url: string;
  published_at: string | null;
  image_url: string | null;
};
export type ReadingArticleList = { articles: ReadingArticle[]; unavailable_sources: string[] };
export type ReadingArticleContent = { article: ReadingArticle; paragraphs: string[]; available: boolean; message: string | null };
export type ReadingLookup = { text: string; translation_vi: string };
export type ReadingVocabularySheet = { id: number; name: string; workbook_id: number; workbook_name: string; card_count: number };
export type ReadingVocabularyCollection = { sheets: ReadingVocabularySheet[] };

export type StudySessionType =
  | "new_learning"
  | "srs_review"
  | "weak_cards"
  | "quick_recall";
export type StudyDirection = "en_to_vi" | "vi_to_en" | "mixed";
export type StudyAnswerDirection = Exclude<StudyDirection, "mixed">;
export type StudySessionStatus = "active" | "completed" | "abandoned";
export type StudyAnswerResult = "again" | "remembered";
export type StudyRoundScope = "all" | "forgotten";
export type StudyRoundStatus = "active" | "completed";
export type SrsRating = "forgot" | "hard" | "good" | "easy";

export type StudySessionCard = {
  id: number;
  flashcard_id: number;
  direction: StudyDirection | null;
  attempt_count: number;
  again_count: number;
  remembered: boolean;
  first_try_correct: boolean;
  last_answered_at: string | null;
  flashcard: FlashcardListItem;
};

export type StudySessionRoundCard = {
  id: number;
  session_card_id: number;
  position: number;
  result: StudyAnswerResult | null;
  answered_at: string | null;
  session_card: StudySessionCard;
};

export type StudySessionRoundSummary = {
  id: number;
  round_number: number;
  scope: StudyRoundScope;
  status: StudyRoundStatus;
  total_cards: number;
  remembered_count: number;
  again_count: number;
  recall_percentage: number | null;
  completed_at: string | null;
};

export type StudySessionRound = StudySessionRoundSummary & {
  started_at: string;
  source_round_id: number | null;
  round_cards: StudySessionRoundCard[];
};

export type StudySession = {
  id: number;
  sheet_id: number;
  session_type: StudySessionType;
  direction: StudyDirection;
  status: StudySessionStatus;
  started_at: string;
  completed_at: string | null;
  total_cards: number;
  total_attempts: number;
  first_try_correct: number;
  again_count: number;
  mastery_score: number | null;
  sheet_rating: SrsRating | null;
  session_cards: StudySessionCard[];
  active_round: StudySessionRound | null;
  round_summaries: StudySessionRoundSummary[];
};

export type StudySessionRatingResponse = {
  session: StudySession;
  sheet: SheetDetail;
};

export type DashboardSheetItem = SheetSummary & {
  workbook_id: number;
  workbook_name: string;
};

export type DashboardActiveSessionItem = {
  id: number;
  sheet: DashboardSheetItem;
  session_type: StudySessionType;
  direction: StudyDirection;
  started_at: string;
  total_cards: number;
};

export type DashboardRecentSessionItem = {
  id: number;
  sheet_id: number;
  sheet_name: string;
  workbook_id: number;
  workbook_name: string;
  session_type: StudySessionType;
  completed_at: string;
  total_cards: number;
  total_attempts: number;
  mastery_score: number | null;
};

export type DashboardSummary = {
  generated_at: string;
  due_sheets: DashboardSheetItem[];
  active_sessions: DashboardActiveSessionItem[];
  new_sheets: DashboardSheetItem[];
  weak_card_count: number;
  recent_sessions: DashboardRecentSessionItem[];
};

export type StudySessionCreateInput = {
  sheet_id: number;
  session_type: StudySessionType;
  direction: StudyDirection;
};

export type StudySessionAnswerInput = {
  direction: StudyAnswerDirection;
  result: StudyAnswerResult;
};

export type StudySessionAnswerResponse = {
  session_id: number;
  card_id: number;
  direction: StudyAnswerDirection;
  result: StudyAnswerResult;
  attempt_count: number;
  again_count: number;
  remembered: boolean;
  first_try_correct: boolean;
  total_attempts: number;
  session_again_count: number;
  session_first_try_correct: number;
  remaining_cards: number;
};

export type QuickRecallResult = "remembered" | "need_review";

export type QuickRecallCardResultInput = {
  flashcard_id: number;
  result: QuickRecallResult;
};

export type QuickRecallCompletion = {
  sheet_id: number;
  total_cards: number;
  remembered_count: number;
  need_review_count: number;
  recall_percentage: number;
  completed_at: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class WorkbookImportError extends Error {
  constructor(
    message: string,
    readonly validationErrors: ImportValidationError[] = [],
  ) {
    super(message);
    this.name = "WorkbookImportError";
  }
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("status" in body) ||
    body.status !== "ok"
  ) {
    throw new Error("Health check returned an unexpected response");
  }

  return body as HealthResponse;
}

export async function importWorkbook(
  file: File,
): Promise<WorkbookImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl}/api/v1/workbooks/import`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw await toWorkbookImportError(response);
  }

  return (await response.json()) as WorkbookImportResponse;
}

export async function getWorkbooks(): Promise<WorkbookListItem[]> {
  return requestJson<WorkbookListItem[]>("/api/v1/workbooks");
}

export async function createWorkbook(name: string): Promise<WorkbookDetail> {
  return requestJson<WorkbookDetail>("/api/v1/workbooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function getWorkbook(id: string): Promise<WorkbookDetail> {
  return requestJson<WorkbookDetail>(`/api/v1/workbooks/${encodeURIComponent(id)}`);
}

export async function updateWorkbookName(
  id: string,
  name: string,
): Promise<WorkbookDetail> {
  return requestJson<WorkbookDetail>(
    `/api/v1/workbooks/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
}

export async function moveSheetsToWorkbook(
  sourceWorkbookId: number,
  targetWorkbookId: number,
  sheetIds: number[],
): Promise<{ moved_count: number; source_workbook_id: number; target_workbook_id: number }> {
  return requestJson<{
    moved_count: number;
    source_workbook_id: number;
    target_workbook_id: number;
  }>(`/api/v1/workbooks/${sourceWorkbookId}/sheets/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_workbook_id: targetWorkbookId, sheet_ids: sheetIds }),
  });
}

export async function deleteWorkbook(id: string): Promise<void> {
  await requestNoContent(`/api/v1/workbooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function createSheet(workbookId: number, name: string): Promise<WorkbookDetail> {
  return requestJson<WorkbookDetail>(`/api/v1/workbooks/${workbookId}/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteSheet(id: number): Promise<void> {
  await requestNoContent(`/api/v1/sheets/${id}`, { method: "DELETE" });
}

export async function getSheet(id: string): Promise<SheetDetail> {
  return requestJson<SheetDetail>(`/api/v1/sheets/${encodeURIComponent(id)}`);
}

export async function getDueSheets(): Promise<SheetSummary[]> {
  return requestJson<SheetSummary[]>("/api/v1/sheets/due");
}

export async function getNotStartedSheets(): Promise<SheetSummary[]> {
  return requestJson<SheetSummary[]>("/api/v1/sheets/not-started");
}

export async function getDashboard(): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>("/api/v1/dashboard");
}

export async function getSheetCards(id: string): Promise<FlashcardListItem[]> {
  return requestJson<FlashcardListItem[]>(
    `/api/v1/sheets/${encodeURIComponent(id)}/cards`,
  );
}

export async function getVideoTranscript(videoUrl: string, language = "en"): Promise<VideoTranscript> {
  return requestJson<VideoTranscript>("/api/v1/video-practice/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: videoUrl, language }),
  });
}

export async function lookupVideoWord(term: string, context: string): Promise<WordLookup> {
  return requestJson<WordLookup>("/api/v1/video-practice/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term, context }),
  });
}

export async function getReadingSources(): Promise<ReadingSource[]> {
  return requestJson<ReadingSource[]>("/api/v1/reading/sources");
}

export async function getReadingArticles(source = "all", category = "all"): Promise<ReadingArticleList> {
  const query = new URLSearchParams({ source, category });
  return requestJson<ReadingArticleList>(`/api/v1/reading/articles?${query.toString()}`);
}

export async function getReadingArticleContent(article: ReadingArticle): Promise<ReadingArticleContent> {
  const query = new URLSearchParams({ source: article.source_id, url: article.url, title: article.title });
  return requestJson<ReadingArticleContent>(`/api/v1/reading/articles/content?${query.toString()}`);
}

export async function lookupReadingText(text: string): Promise<ReadingLookup> {
  return requestJson<ReadingLookup>("/api/v1/reading/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function getReadingVocabularySheets(): Promise<ReadingVocabularyCollection> {
  return requestJson<ReadingVocabularyCollection>("/api/v1/reading/vocabulary-sheets");
}

export async function createReadingVocabularySheet(): Promise<ReadingVocabularySheet> {
  return requestJson<ReadingVocabularySheet>("/api/v1/reading/vocabulary-sheets", { method: "POST" });
}

export async function addReadingVocabularyCard(
  sheetId: number,
  card: { phrase: string; meaning: string },
): Promise<FlashcardListItem> {
  return requestJson<FlashcardListItem>(`/api/v1/reading/vocabulary-sheets/${encodeURIComponent(sheetId)}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });
}

export async function createFlashcardInSheet(
  sheetId: string,
  input: { phrase: string; meaning: string; example_en?: string },
): Promise<FlashcardListItem> {
  return requestJson<FlashcardListItem>(`/api/v1/sheets/${encodeURIComponent(sheetId)}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateSheetPriority(
  id: string,
  priority: SheetPriority,
): Promise<SheetDetail> {
  return requestJson<SheetDetail>(`/api/v1/sheets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
}

export async function updateSheetName(
  id: string,
  name: string,
): Promise<SheetDetail> {
  return requestJson<SheetDetail>(`/api/v1/sheets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function updateFlashcardWeak(
  id: string,
  isWeak: boolean,
): Promise<FlashcardListItem> {
  return requestJson<FlashcardListItem>(
    `/api/v1/flashcards/${encodeURIComponent(id)}/weak`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_weak: isWeak }),
    },
  );
}

export async function updateFlashcardBookmark(
  id: string,
  isBookmarked: boolean,
): Promise<FlashcardListItem> {
  return requestJson<FlashcardListItem>(
    `/api/v1/flashcards/${encodeURIComponent(id)}/bookmark`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_bookmarked: isBookmarked }),
    },
  );
}

export async function updateFlashcardContent(
  id: string,
  content: Pick<FlashcardListItem, "phrase" | "meaning">,
): Promise<FlashcardListItem> {
  return requestJson<FlashcardListItem>(`/api/v1/flashcards/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
}

export async function deleteFlashcard(id: string): Promise<void> {
  await requestNoContent(`/api/v1/flashcards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function completeQuickRecall(
  sheetId: string,
  results: QuickRecallCardResultInput[],
): Promise<QuickRecallCompletion> {
  return requestJson<QuickRecallCompletion>(
    `/api/v1/sheets/${encodeURIComponent(sheetId)}/quick-recall/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    },
  );
}

export async function createStudySession(
  input: StudySessionCreateInput,
): Promise<StudySession> {
  return requestJson<StudySession>("/api/v1/study-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getStudySession(sessionId: string): Promise<StudySession> {
  return requestJson<StudySession>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function answerStudySessionCard(
  sessionId: string,
  cardId: number,
  input: StudySessionAnswerInput,
): Promise<StudySessionAnswerResponse> {
  return requestJson<StudySessionAnswerResponse>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/cards/${cardId}/answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function answerStudySessionRoundCard(
  sessionId: string,
  roundId: number,
  cardId: number,
  input: StudySessionAnswerInput,
): Promise<StudySession> {
  return requestJson<StudySession>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/rounds/${roundId}/cards/${cardId}/answer`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function completeStudySessionRound(
  sessionId: string,
  roundId: number,
): Promise<StudySession> {
  return requestJson<StudySession>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/rounds/${roundId}/complete`,
    { method: "POST" },
  );
}

export async function createStudySessionRound(
  sessionId: string,
  scope: StudyRoundScope,
): Promise<StudySession> {
  return requestJson<StudySession>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/rounds`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    },
  );
}

export async function completeStudySession(sessionId: string): Promise<StudySession> {
  return requestJson<StudySession>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: "POST" },
  );
}

export async function rateStudySession(
  sessionId: string,
  rating: SrsRating,
): Promise<StudySessionRatingResponse> {
  return requestJson<StudySessionRatingResponse>(
    `/api/v1/study-sessions/${encodeURIComponent(sessionId)}/rating`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    },
  );
}

export type CalendarDaySessionItem = {
  id: number;
  sheet_id: number;
  sheet_name: string;
  workbook_name: string;
  session_type: StudySessionType;
  completed_at: string;
  total_cards: number;
  total_attempts: number;
  mastery_score: number | null;
};

export type CalendarDayDueSheetItem = {
  id: number;
  name: string;
  workbook_id: number;
  workbook_name: string;
  card_count: number;
  priority: SheetPriority;
  status: SheetStatus;
  next_review_at: string | null;
};

export type CalendarDaySummary = {
  date: string;
  is_today: boolean;
  is_future: boolean;
  has_studied: boolean;
  sessions_count: number;
  cards_reviewed: number;
  due_sheets_count: number;
};

export type CalendarMonthSummary = {
  year: number;
  month: number;
  current_streak: number;
  longest_streak: number;
  total_study_days_this_month: number;
  total_cards_this_month: number;
  today_has_studied: boolean;
  today_due_count: number;
  days: CalendarDaySummary[];
};

export type CalendarDayDetail = {
  date: string;
  is_today: boolean;
  has_studied: boolean;
  total_cards_reviewed: number;
  completed_sessions: CalendarDaySessionItem[];
  due_sheets: CalendarDayDueSheetItem[];
};

export type NotificationType = "srs_due" | "daily_checkin" | "streak_milestone" | "system";

export type NotificationItem = {
  id: number;
  notification_type: NotificationType;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  scheduled_for: string;
  created_at: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unread_count: number;
  total_count: number;
};

export type MarkReadResponse = {
  success: boolean;
  updated_count: number;
};

export async function getCalendarMonth(year: number, month: number): Promise<CalendarMonthSummary> {
  return requestJson<CalendarMonthSummary>(`/api/v1/calendar/month?year=${year}&month=${month}`);
}

export async function getCalendarDayDetail(dateStr: string): Promise<CalendarDayDetail> {
  return requestJson<CalendarDayDetail>(`/api/v1/calendar/day?date=${encodeURIComponent(dateStr)}`);
}

export type UserRead = {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: UserRead;
};

export type RegisterRequest = {
  email: string;
  username: string;
  password: string;
  full_name?: string;
};

export type LoginRequest = {
  username_or_email: string;
  password: string;
};

export type PasswordChangeRequest = {
  old_password: string;
  new_password: string;
};

export const AUTH_TOKEN_KEY = "learn_fast_token";
const GUEST_TRIAL_TOKEN_KEY = "learn_fast_guest_ai_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getGuestTrialToken(): string | null {
  if (typeof window === "undefined") return null;
  const existing = localStorage.getItem(GUEST_TRIAL_TOKEN_KEY);
  if (existing) return existing;
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(GUEST_TRIAL_TOKEN_KEY, token);
  return token;
}

function guestTrialHeaders(): Record<string, string> {
  const token = getGuestTrialToken();
  return token ? { "X-Guest-Token": token } : {};
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function registerAccount(data: RegisterRequest): Promise<UserRead> {
  return requestJson<UserRead>("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function loginAccount(data: LoginRequest): Promise<TokenResponse> {
  const res = await requestJson<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.access_token) {
    setStoredAuthToken(res.access_token);
  }
  return res;
}

export async function getCurrentUser(): Promise<UserRead> {
  return requestJson<UserRead>("/api/v1/auth/me");
}

export async function changeUserPassword(data: PasswordChangeRequest): Promise<{ message: string }> {
  return requestJson<{ message: string }>("/api/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function logoutAccount(): void {
  setStoredAuthToken(null);
}

export async function getNotifications(unreadOnly = false, limit = 30): Promise<NotificationListResponse> {
  return requestJson<NotificationListResponse>(`/api/v1/notifications?unread_only=${unreadOnly}&limit=${limit}`);
}

export async function markNotificationAsRead(id: number): Promise<{ success: boolean }> {
  return requestJson<{ success: boolean }>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsAsRead(): Promise<MarkReadResponse> {
  return requestJson<MarkReadResponse>("/api/v1/notifications/read-all", {
    method: "POST",
  });
}

export type AIGeneratedCardItem = {
  phrase: string;
  meaning: string;
  example_en: string;
  example_vi: string;
};

export type AIGenerateRequest = {
  topic?: string;
  count?: number;
  level?: string;
  target_sheet_id?: number;
  target_workbook_id?: number;
};

export type AIMineRequest = {
  text: string;
  target_sheet_id?: number;
  target_workbook_id?: number;
};

export type AIGeneratedSheetResponse = {
  sheet_name: string;
  cards: AIGeneratedCardItem[];
  total_generated: number;
};

export type AISaveSheetRequest = {
  mode: "new_sheet" | "append";
  workbook_id?: number;
  new_workbook_name?: string;
  target_sheet_id?: number;
  sheet_name: string;
  cards: AIGeneratedCardItem[];
};

export type AISaveSheetResponse = {
  workbook_id: number;
  workbook_name: string;
  sheet_id: number;
  sheet_name: string;
  cards_added: number;
  total_cards: number;
  is_appended: boolean;
};

export async function generateAICards(data: AIGenerateRequest): Promise<AIGeneratedSheetResponse> {
  return requestJson<AIGeneratedSheetResponse>("/api/v1/ai/generate", {
    method: "POST",
    headers: { ...guestTrialHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function mineAICards(data: AIMineRequest): Promise<AIGeneratedSheetResponse> {
  return requestJson<AIGeneratedSheetResponse>("/api/v1/ai/mine", {
    method: "POST",
    headers: { ...guestTrialHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function saveAISheet(data: AISaveSheetRequest): Promise<AISaveSheetResponse> {
  return requestJson<AISaveSheetResponse>("/api/v1/ai/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getWritingPrompts(): Promise<WritingPromptList> {
  return requestJson<WritingPromptList>("/api/v1/writing/prompts");
}

export async function getWritingPrompt(promptId: number): Promise<WritingPrompt> {
  return requestJson<WritingPrompt>(`/api/v1/writing/prompts/${promptId}`);
}

export async function generateGuestWritingTopic(): Promise<GuestWritingTopic> {
  return requestJson<GuestWritingTopic>("/api/v1/guest/ai/writing/topic", { method: "POST", headers: guestTrialHeaders() });
}

export async function gradeGuestWriting(promptId: number, draftText: string): Promise<WritingFeedback> {
  return requestJson<WritingFeedback>("/api/v1/guest/ai/writing/grade", {
    method: "POST", headers: { ...guestTrialHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt_id: promptId, draft_text: draftText }),
  });
}

export async function createWritingAttempt(promptId: number, revisionOfId?: number): Promise<WritingAttempt> {
  return requestJson<WritingAttempt>("/api/v1/writing/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt_id: promptId, revision_of_id: revisionOfId }),
  });
}

export async function generateRandomWritingAttempt(): Promise<WritingAttempt> {
  return requestJson<WritingAttempt>("/api/v1/writing/attempts/random", {
    method: "POST",
  });
}

export async function generateSentenceWritingAttempt(flashcardId: number, signal?: AbortSignal): Promise<WritingAttempt> {
  try {
    return await requestWritingJson<WritingAttempt>("/api/v1/writing/attempts/sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcard_id: flashcardId }),
      signal,
    }, 180_000);
  } catch (cause) {
    if (cause instanceof ApiRequestError && cause.status === 408) {
      throw new ApiRequestError("Creating the situation timed out. Check Practice history before trying again.", 408);
    }
    throw cause;
  }
}

export async function generateVocabularyParagraph(sheetId: number, cardIds: number[], style: "paragraph" | "dialogue", guest: boolean): Promise<WritingAttempt | ParagraphPracticeTask> {
  return requestWritingJson<WritingAttempt | ParagraphPracticeTask>(guest ? "/api/v1/guest/ai/vocabulary-paragraph/topic" : "/api/v1/writing/attempts/vocabulary-paragraph", {
    method: "POST", headers: { ...(guest ? guestTrialHeaders() : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ sheet_id: sheetId, card_ids: cardIds, style }),
  }, 180_000);
}

export async function gradeGuestVocabularyParagraph(task: ParagraphPracticeTask, draftText: string): Promise<WritingFeedback> {
  return requestWritingJson<WritingFeedback>("/api/v1/guest/ai/vocabulary-paragraph/grade", {
    method: "POST", headers: { ...guestTrialHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ task, draft_text: draftText }),
  }, 300_000);
}

export async function getWritingErrorHistory(page = 1): Promise<WritingErrorHistory> {
  return requestJson<WritingErrorHistory>(`/api/v1/writing/error-history?page=${page}&page_size=20`);
}

export async function saveWritingAttempt(
  attemptId: number,
  version: number,
  draftText: string,
): Promise<WritingAttempt> {
  return requestJson<WritingAttempt>(`/api/v1/writing/attempts/${attemptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version, draft_text: draftText }),
  });
}

export async function gradeWritingAttempt(attemptId: number, version: number, signal?: AbortSignal): Promise<WritingAttempt> {
  return requestWritingJson<WritingAttempt>(`/api/v1/writing/attempts/${attemptId}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
    signal,
  }, 300_000);
}

export async function getWritingAttempt(attemptId: number): Promise<WritingAttempt> {
  return requestWritingJson<WritingAttempt>(`/api/v1/writing/attempts/${attemptId}`);
}

export async function getWritingHistory(page = 1): Promise<WritingAttemptList> {
  return requestJson<WritingAttemptList>(`/api/v1/writing/attempts?page=${page}&page_size=20`);
}

export async function getWritingUsage(): Promise<WritingUsage> {
  return requestWritingJson<WritingUsage>("/api/v1/writing/usage");
}

export async function getSpeakingPrompts(): Promise<SpeakingPromptList> {
  return requestJson<SpeakingPromptList>("/api/v1/speaking/prompts");
}

export async function generateGuestSpeakingTopic(): Promise<Omit<SpeakingPrompt, "id" | "slug">> {
  return requestJson<Omit<SpeakingPrompt, "id" | "slug">>("/api/v1/guest/ai/speaking/topic", { method: "POST", headers: guestTrialHeaders() });
}

export async function gradeGuestSpeaking(promptId: number, transcript: string): Promise<SpeakingFeedback> {
  return requestJson<SpeakingFeedback>("/api/v1/guest/ai/speaking/grade", {
    method: "POST", headers: { ...guestTrialHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt_id: promptId, transcript }),
  });
}

export async function gradeGuestSentence(data: {
  phrase: string; meaning: string; situation_en: string; situation_vi: string; sentence: string;
}): Promise<WritingFeedback> {
  return requestJson<WritingFeedback>("/api/v1/guest/ai/sentence/grade", {
    method: "POST", headers: { ...guestTrialHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
}

export async function createSpeakingAttempt(promptId: number): Promise<SpeakingAttempt> {
  return requestJson<SpeakingAttempt>("/api/v1/speaking/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt_id: promptId }),
  });
}

export async function generateRandomSpeakingAttempt(): Promise<SpeakingAttempt> {
  return requestSpeakingJson<SpeakingAttempt>("/api/v1/speaking/attempts/random", {
    method: "POST",
  }, 90_000);
}

export async function transcribeSpeakingAttempt(attemptId: number, audio: Blob, signal?: AbortSignal): Promise<SpeakingAttempt> {
  const body = new FormData();
  const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("mpeg") ? "mp3" : "webm";
  body.append("audio", audio, `speaking-answer.${extension}`);
  return requestSpeakingJson<SpeakingAttempt>(`/api/v1/speaking/attempts/${attemptId}/transcribe`, { method: "POST", body, signal }, 190_000);
}

export async function saveSpeakingTranscript(attemptId: number, version: number, transcript: string): Promise<SpeakingAttempt> {
  return requestJson<SpeakingAttempt>(`/api/v1/speaking/attempts/${attemptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version, transcript }),
  });
}

export async function gradeSpeakingAttempt(attemptId: number, version: number, signal?: AbortSignal): Promise<SpeakingAttempt> {
  return requestSpeakingJson<SpeakingAttempt>(`/api/v1/speaking/attempts/${attemptId}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
    signal,
  }, 180_000);
}

export async function getSpeakingAttempt(attemptId: number): Promise<SpeakingAttempt> {
  return requestJson<SpeakingAttempt>(`/api/v1/speaking/attempts/${attemptId}`);
}

export async function getSpeakingHistory(): Promise<SpeakingAttemptList> {
  return requestJson<SpeakingAttemptList>("/api/v1/speaking/attempts");
}

export async function getSpeakingUsage(): Promise<SpeakingUsage> {
  return requestJson<SpeakingUsage>("/api/v1/speaking/usage");
}

async function requestSpeakingJson<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const cancel = () => controller.abort();
  if (externalSignal?.aborted) cancel();
  externalSignal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try {
    return await requestJson<T>(path, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new ApiRequestError("The speaking request timed out. Refresh the attempt status before retrying.", 408);
    }
    throw cause;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", cancel);
  }
}

async function requestWritingJson<T>(path: string, init?: RequestInit, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const cancel = () => controller.abort();
  if (externalSignal?.aborted) cancel();
  externalSignal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await requestJson<T>(path, { ...init, signal: controller.signal });
  } catch (cause) {
    if (timedOut) throw new ApiRequestError("The writing request timed out. Your saved draft is safe. Refresh the review status before retrying.", 408);
    throw cause;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", cancel);
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (!token && !headers.has("X-Guest-Token")) {
    const guestToken = getGuestTrialToken();
    if (guestToken) headers.set("X-Guest-Token", guestToken);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw await toApiRequestError(response);
  }
  return (await response.json()) as T;
}

async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  // Các lệnh DELETE admin cần JWT như requestJson, nhưng phản hồi 204 không có JSON để parse.
  const token = getStoredAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (!token && !headers.has("X-Guest-Token")) {
    const guestToken = getGuestTrialToken();
    if (guestToken) headers.set("X-Guest-Token", guestToken);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    throw await toApiRequestError(response);
  }
}


function formatValidationError(loc: string, msg: string): string {
  const fieldNames: Record<string, string> = {
    username: "Username",
    email: "Email address",
    password: "Password",
    full_name: "Full name",
    username_or_email: "Username or Email",
  };

  const fieldLabel = fieldNames[loc] || loc || "Field";

  if (msg.includes("String should match pattern") || msg.includes("pattern")) {
    return `${fieldLabel} may only contain letters, numbers, underscores (_), and hyphens (-). No spaces allowed.`;
  }
  if (msg.includes("value is not a valid email address") || msg.includes("valid email")) {
    return `${fieldLabel} must be a valid email address.`;
  }
  if (msg.includes("at least") || msg.includes("min_length")) {
    return `${fieldLabel} is too short.`;
  }
  if (msg.includes("at most") || msg.includes("max_length")) {
    return `${fieldLabel} is too long.`;
  }
  return `${fieldLabel}: ${msg}`;
}

async function toApiRequestError(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  let message = `Request failed with status ${response.status}. Please try again.`;

  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      // Handle FastAPI / Pydantic validation errors: [{ loc: ['body', 'username'], msg: '...', type: '...' }]
      message = detail
        .map((item) => {
          if (typeof item === "object" && item !== null && "msg" in item) {
            const loc = Array.isArray(item.loc)
              ? item.loc.filter((l: unknown) => l !== "body").join(".")
              : "";
            return formatValidationError(loc, String(item.msg));
          }
          return typeof item === "string" ? item : JSON.stringify(item);
        })
        .join("\n");
    }
  }

  return new ApiRequestError(message, response.status);
}

async function toWorkbookImportError(
  response: Response,
): Promise<WorkbookImportError> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null && "detail" in body) {
    const { detail } = body as { detail: unknown };
    if (typeof detail === "string") {
      return new WorkbookImportError(detail);
    }
    if (Array.isArray(detail) && detail.every(isImportValidationError)) {
      return new WorkbookImportError(
        "Workbook contains validation errors.",
        detail,
      );
    }
  }

  return new WorkbookImportError(
    `Import failed with status ${response.status}. Please try again.`,
  );
}

function isImportValidationError(value: unknown): value is ImportValidationError {
  return (
    typeof value === "object" &&
    value !== null &&
    "sheet_name" in value &&
    "message" in value
  );
}
