import Link from "next/link";

import { Icon } from "@/components/layout/app-shell";
import { formatDate, formatLabel } from "@/lib/format";
import type { SheetSummary } from "@/services/api";
import { InlineNameEditor } from "@/components/shared/inline-name-editor";

type SheetListItemProps = {
  sheet: SheetSummary;
  management?: {
    isSelected: boolean;
    onToggle: (sheetId: number) => void;
    onRename: (name: string) => Promise<void>;
  };
};

export function SheetListItem({ sheet, management }: SheetListItemProps) {
  const isDue = sheet.status === "due";
  const isLearned = sheet.status === "learned";
  const reviewDate = sheet.next_review_at ? formatDate(sheet.next_review_at) : "Not scheduled";

  return (
    <li className={management ? "workbook-sheet-management-item" : undefined}>
      {management && (
        <div className="workbook-sheet-management-controls">
          <label className="workbook-sheet-select">
            <input
              type="checkbox"
              checked={management.isSelected}
              onChange={() => management.onToggle(sheet.id)}
              aria-label={`Select ${sheet.name}`}
            />
            <span>Select</span>
          </label>
          <InlineNameEditor
            value={sheet.name}
            label={`sheet ${sheet.name}`}
            onSave={management.onRename}
          />
        </div>
      )}
      <Link
        href={`/sheets/${sheet.id}`}
        className={`workbook-sheet-row status-${sheet.status}`}
      >
        <span className="workbook-sheet-icon"><Icon name={isLearned ? "check" : isDue ? "review" : "books"} size={25} /></span>
        <span className="workbook-sheet-copy">
          <span className="workbook-sheet-title-row">
            <strong>{sheet.name}</strong>
            {sheet.is_ai_generated && <span className="sheet-ai-badge">✨ AI</span>}
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
