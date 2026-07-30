import Link from "next/link";

import { DeleteWorkbookButton } from "@/components/workbooks/delete-workbook-button";
import { formatDate } from "@/lib/format";
import type { WorkbookListItem } from "@/services/api";

type WorkbookCardProps = {
  workbook: WorkbookListItem;
  onDeleted: () => Promise<void>;
};

export function WorkbookCard({ workbook, onDeleted }: WorkbookCardProps) {
  return (
    <article className="flex items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Link
        href={`/workbooks/${workbook.id}`}
        className="min-w-0 flex-1 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <h2 className="truncate text-lg font-semibold text-slate-900">{workbook.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{workbook.original_filename}</p>
        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          <div>
            <dt className="inline text-slate-500">Sheets: </dt>
            <dd className="inline font-medium">{workbook.sheet_count}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Cards: </dt>
            <dd className="inline font-medium">{workbook.total_cards}</dd>
          </div>
          <div>
            <dt className="inline text-slate-500">Imported: </dt>
            <dd className="inline font-medium">{formatDate(workbook.imported_at)}</dd>
          </div>
        </dl>
      </Link>
      <DeleteWorkbookButton
        workbookId={workbook.id}
        workbookName={workbook.name}
        onDeleted={onDeleted}
      />
    </article>
  );
}
