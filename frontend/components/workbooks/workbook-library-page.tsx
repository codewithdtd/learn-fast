import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { WorkbookList } from "@/components/workbooks/workbook-list";

export function WorkbookLibraryPage() {
  return (
    <AppShell activeHref="/workbooks">
      <main className="library-page">
        <header className="library-header">
          <div>
            <p className="library-eyebrow">Vocabulary library</p>
            <h1>Workbooks</h1>
          </div>
          <Link href="/import" className="library-button library-button-secondary">
            Import workbook
          </Link>
        </header>
        <WorkbookList />
      </main>
    </AppShell>
  );
}
