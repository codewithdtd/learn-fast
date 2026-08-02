export type HealthResponse = {
  status: "ok";
};

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

export type StudySessionType =
  | "new_learning"
  | "srs_review"
  | "weak_cards"
  | "quick_recall";
export type StudyDirection = "en_to_vi" | "vi_to_en" | "mixed";
export type StudyAnswerDirection = Exclude<StudyDirection, "mixed">;
export type StudySessionStatus = "active" | "completed" | "abandoned";
export type StudyAnswerResult = "again" | "remembered";
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

export async function getWorkbook(id: string): Promise<WorkbookDetail> {
  return requestJson<WorkbookDetail>(`/api/v1/workbooks/${encodeURIComponent(id)}`);
}

export async function deleteWorkbook(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/v1/workbooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw await toApiRequestError(response);
  }
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  if (!response.ok) {
    throw await toApiRequestError(response);
  }
  return (await response.json()) as T;
}

async function toApiRequestError(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" && body !== null && "detail" in body && typeof body.detail === "string"
      ? body.detail
      : `Request failed with status ${response.status}. Please try again.`;
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
