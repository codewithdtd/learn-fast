"use client";

import { FormEvent, useRef, useState } from "react";

import { ImportResult } from "@/components/import/import-result";
import {
  importWorkbook,
  WorkbookImportError,
  type WorkbookImportResponse,
} from "@/services/api";

export function ImportWorkbookForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<WorkbookImportResponse | null>(null);
  const [error, setError] = useState<WorkbookImportError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      setResult(await importWorkbook(file));
    } catch (caughtError) {
      setError(
        caughtError instanceof WorkbookImportError
          ? caughtError
          : new WorkbookImportError("Import failed. Please try again."),
      );
    } finally {
      setIsImporting(false);
    }
  }

  function resetForm() {
    setFile(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="workbook-file" className="text-sm font-medium text-slate-800">
            Excel workbook (.xlsx)
          </label>
          <input
            ref={fileInputRef}
            id="workbook-file"
            name="file"
            type="file"
            accept=".xlsx"
            disabled={isImporting}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(null);
              setResult(null);
            }}
            className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-sky-50 file:px-3 file:py-1.5 file:font-medium file:text-sky-800 hover:file:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {file && (
            <p className="mt-2 text-sm text-slate-600">
              Selected: {file.name} ({formatFileSize(file.size)})
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!file || isImporting}
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isImporting ? "Importing…" : "Import workbook"}
          </button>
          {(file || result || error) && (
            <button
              type="button"
              onClick={resetForm}
              disabled={isImporting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Choose another file
            </button>
          )}
        </div>
      </form>

      {error && (
        <section
          role="alert"
          className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-950"
        >
          <h2 className="font-semibold">Import failed</h2>
          <p className="mt-1 text-sm">{error.message}</p>
          {error.validationErrors.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
              {error.validationErrors.map((validationError, index) => (
                <li key={`${validationError.sheet_name}-${validationError.row_number}-${validationError.column}-${index}`}>
                  {validationError.sheet_name}
                  {validationError.row_number ? `, row ${validationError.row_number}` : ""}
                  {validationError.column ? `, ${validationError.column}` : ""}: {" "}
                  {validationError.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {result && <ImportResult workbook={result} />}
    </>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
