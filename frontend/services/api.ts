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
