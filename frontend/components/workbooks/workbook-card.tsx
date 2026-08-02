import Link from "next/link";

import { Icon } from "@/components/layout/app-shell";
import { DeleteWorkbookButton } from "@/components/workbooks/delete-workbook-button";
import { formatDate } from "@/lib/format";
import type { WorkbookListItem } from "@/services/api";

type WorkbookCardProps = {
  workbook: WorkbookListItem;
  onDeleted: () => Promise<void>;
};

export function WorkbookCard({ workbook, onDeleted }: WorkbookCardProps) {
  return (
    <article className="workbook-card">
      <div className="workbook-card-topline">
        <span className="workbook-icon"><Icon name="books" size={26} /></span>
        <DeleteWorkbookButton workbookId={workbook.id} workbookName={workbook.name} onDeleted={onDeleted} />
      </div>

      <h2>{workbook.name}</h2>
      <p className="workbook-file">{workbook.original_filename}</p>

      <dl className="workbook-metrics">
        <div><dt>Sheets</dt><dd>{workbook.sheet_count}</dd></div>
        <div><dt>Cards</dt><dd>{workbook.total_cards}</dd></div>
      </dl>

      <div className="workbook-imported">
        <span>Imported</span>
        <time dateTime={workbook.imported_at}>{formatDate(workbook.imported_at)}</time>
      </div>

      <div className="workbook-card-footer">
        <span className="workbook-status">Imported</span>
        <Link href={`/workbooks/${workbook.id}`} className="library-card-link">
          Open workbook <Icon name="arrow" size={17} />
        </Link>
      </div>
    </article>
  );
}
