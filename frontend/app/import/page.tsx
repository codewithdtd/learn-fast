import { AppShell } from "@/components/layout/app-shell";
import { ImportWorkbookForm } from "@/components/import/import-workbook-form";

export default function ImportPage() {
  return (
    <AppShell activeHref="/import">
      <main className="import-page">
        <section className="import-content">
          <header className="import-header"><p className="import-kicker">Content import</p><h1>Import Workbook</h1><p>Turn your Excel vocabulary into study-ready flashcards.</p></header>
          <ImportWorkbookForm />
        </section>
      </main>
    </AppShell>
  );
}
