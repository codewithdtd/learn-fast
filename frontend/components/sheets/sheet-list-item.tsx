import Link from "next/link";

import { formatDate, formatLabel } from "@/lib/format";
import type { SheetSummary } from "@/services/api";

type SheetListItemProps = {
  sheet: SheetSummary;
};

export function SheetListItem({ sheet }: SheetListItemProps) {
  return (
    <li>
      <Link
        href={`/sheets/${sheet.id}`}
        className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">
            {sheet.position}. {sheet.name}
          </h2>
          <span className="text-sm text-slate-600">{sheet.card_count} cards</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            {formatLabel(sheet.status)}
          </span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-800">
            {formatLabel(sheet.priority)}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
            Next review: {formatDate(sheet.next_review_at)}
          </span>
        </div>
      </Link>
    </li>
  );
}
