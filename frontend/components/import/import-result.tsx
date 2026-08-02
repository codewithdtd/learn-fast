import Link from "next/link";

import { Icon } from "@/components/layout/app-shell";
import type { WorkbookImportResponse } from "@/services/api";

export function ImportResult({ workbook }: { workbook: WorkbookImportResponse }) {
  return <section aria-live="polite" className="import-success"><div className="import-success-heading"><div className="import-status-icon"><Icon name="check" size={23} /></div><div><p className="import-success-kicker">Import successful</p><h2>{workbook.name}</h2><p>{workbook.original_filename}</p></div></div><dl className="import-result-stats"><div><dt>Sheets</dt><dd>{workbook.sheet_count}</dd></div><div><dt>Cards</dt><dd>{workbook.total_cards}</dd></div></dl><ul className="import-sheet-list">{workbook.sheets.map((sheet) => <li key={sheet.id}><span>{sheet.position}. {sheet.name}</span><strong>{sheet.card_count} cards</strong></li>)}</ul><Link href={`/workbooks/${workbook.id}`} className="import-open-link">Open workbook <Icon name="arrow" size={18} /></Link></section>;
}
