"use client";

import { FormEvent, useRef, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { ImportResult } from "@/components/import/import-result";
import { importWorkbook, WorkbookImportError, type WorkbookImportResponse } from "@/services/api";

export function ImportWorkbookForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<WorkbookImportResponse | null>(null);
  const [error, setError] = useState<WorkbookImportError | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || isImporting) return;
    setIsImporting(true); setError(null); setResult(null);
    try { setResult(await importWorkbook(file)); }
    catch (caughtError) { setError(caughtError instanceof WorkbookImportError ? caughtError : new WorkbookImportError("Import failed. Please try again.")); }
    finally { setIsImporting(false); }
  }

  function selectFile(nextFile: File | null) { setFile(nextFile); setError(null); setResult(null); }
  function resetForm() { selectFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }

  return <>
    <form className="import-card" onSubmit={handleSubmit}>
      <div className="import-file-surface">
        <input ref={fileInputRef} id="workbook-file" name="file" type="file" accept=".xlsx" disabled={isImporting} onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
        {file ? 
        <>
          <p className="import-file-name">{file.name}</p>
          <p className="import-file-size">{formatFileSize(file.size)}</p>
          <button type="button" className="import-change-button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>Change file</button>
        </> : 
        <>
          <h2>Choose an Excel workbook</h2>
          <p>Upload an .xlsx file with your vocabulary columns.</p>
          <button type="button" className="import-choose-button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Icon name="import" size={22} /> 
            Choose Excel file
          </button>
        </>}
      </div>
      <section className="import-guidance"><Icon name="review" size={22} /><div><h2>File structure</h2><p>Use <strong>Phrase</strong> and <strong>Meaning</strong> columns. <strong>Example EN</strong> and <strong>Example VI</strong> are optional.</p></div></section>
      <div className="import-actions"><button type="submit" className="import-submit-button" disabled={!file || isImporting}>{isImporting ? "Importing…" : "Import workbook"}<Icon name="arrow" size={19} /></button>{(file || result || error) && <button type="button" className="import-reset-button" onClick={resetForm} disabled={isImporting}>Choose another file</button>}</div>
    </form>
    {error && <section role="alert" className="import-error"><div className="import-status-icon"><Icon name="weak" size={22} /></div><div><h2>Import failed</h2><p>{error.message}</p>{error.validationErrors.length > 0 && <ul>{error.validationErrors.map((validationError, index) => <li key={`${validationError.sheet_name}-${validationError.row_number}-${validationError.column}-${index}`}><strong>{validationError.sheet_name}</strong>{validationError.row_number ? `, row ${validationError.row_number}` : ""}{validationError.column ? `, ${validationError.column}` : ""}: {validationError.message}</li>)}</ul>}</div></section>}
    {result && <ImportResult workbook={result} />}
  </>;
}

function formatFileSize(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
