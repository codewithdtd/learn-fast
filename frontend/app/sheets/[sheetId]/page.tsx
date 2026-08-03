import { AppShell } from "@/components/layout/app-shell";
import { SheetDetailView } from "@/components/sheets/sheet-detail";

type SheetPageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function SheetPage({ params }: SheetPageProps) {
  const { sheetId } = await params;

  return (
    <AppShell activeHref="/workbooks">
      <main className="sheet-detail-page">
        <SheetDetailView sheetId={sheetId} />
      </main>
    </AppShell>
  );
}
