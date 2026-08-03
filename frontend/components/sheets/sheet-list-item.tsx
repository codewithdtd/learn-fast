import Link from "next/link";

import { Icon } from "@/components/layout/app-shell";
import { formatDate, formatLabel } from "@/lib/format";
import type { SheetSummary } from "@/services/api";

type SheetListItemProps = {
  sheet: SheetSummary;
};

export function SheetListItem({ sheet }: SheetListItemProps) {
  const isDue = sheet.status === "due";
  const isLearned = sheet.status === "learned";
  const reviewDate = sheet.next_review_at ? formatDate(sheet.next_review_at) : "Not scheduled";

  return (
    <li>
      <Link
        href={`/sheets/${sheet.id}`}
        className={`workbook-sheet-row status-${sheet.status}`}
      >
        <span className="workbook-sheet-icon"><Icon name={isLearned ? "check" : isDue ? "review" : "books"} size={25} /></span>
        <span className="workbook-sheet-copy">
          <span className="workbook-sheet-title-row">
            <strong>{sheet.name}</strong>
            {isDue && <span className="sheet-due-badge">Due</span>}
          </span>
          <span className="workbook-sheet-meta">
            <span>{sheet.card_count} cards</span>
            <span aria-hidden="true">•</span>
            <span>{formatLabel(sheet.status)}</span>
          </span>
        </span>
        <span className="workbook-sheet-side">
          <span className={`sheet-status-badge status-${sheet.status}`}>{formatLabel(sheet.status)}</span>
          <span className="sheet-review-date">Review: {reviewDate}</span>
        </span>
        <span className="workbook-sheet-arrow" aria-hidden="true">
          <Icon name={isLearned ? "refresh" : "arrow"} size={22} />
        </span>
      </Link>
    </li>
  );
}
