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
