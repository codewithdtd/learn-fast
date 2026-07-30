import Link from "next/link";

import type { WorkbookImportResponse } from "@/services/api";

type ImportResultProps = {
  workbook: WorkbookImportResponse;
};

export function ImportResult({ workbook }: ImportResultProps) {
  return (
    <section
      aria-live="polite"
      className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        Import successful
      </p>
      <h2 className="mt-2 text-xl font-semibold">{workbook.name}</h2>
      <p className="mt-1 text-sm text-emerald-800">
        {workbook.sheet_count} sheet{workbook.sheet_count === 1 ? "" : "s"} ·{" "}
        {workbook.total_cards} card{workbook.total_cards === 1 ? "" : "s"}
      </p>
      <ul className="mt-4 space-y-2 border-t border-emerald-200 pt-4 text-sm">
        {workbook.sheets.map((sheet) => (
          <li key={sheet.id} className="flex justify-between gap-4">
            <span>
              {sheet.position}. {sheet.name}
            </span>
            <span>{sheet.card_count} cards</span>
          </li>
        ))}
      </ul>
      <Link href={`/workbooks/${workbook.id}`} className="mt-5 inline-block text-sm font-semibold text-emerald-800 underline">
        Open workbook
      </Link>
    </section>
  );
}
