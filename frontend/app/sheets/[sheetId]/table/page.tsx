import { AppShell } from "@/components/layout/app-shell";
import { ResponsiveSheetTableView } from "@/components/sheets/table-view-page";

type SheetTablePageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function SheetTablePage({ params }: SheetTablePageProps) {
  const { sheetId } = await params;

  return (
    <AppShell activeHref="/workbooks">
      <main className="table-view-page">
        <ResponsiveSheetTableView sheetId={sheetId} />
      </main>
    </AppShell>
  );
}
