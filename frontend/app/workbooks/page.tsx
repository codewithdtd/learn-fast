import Link from "next/link";

import { WorkbookList } from "@/components/workbooks/workbook-list";

export default function WorkbooksPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">Content library</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Workbooks</h1>
          </div>
          <Link href="/import" className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">Import workbook</Link>
        </div>
        <WorkbookList />
      </section>
    </main>
  );
}
