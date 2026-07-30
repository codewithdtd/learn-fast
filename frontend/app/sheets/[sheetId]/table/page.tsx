import { SheetTableView } from "@/components/sheets/sheet-table-view";

type SheetTablePageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function SheetTablePage({ params }: SheetTablePageProps) {
  const { sheetId } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-7xl">
        <SheetTableView sheetId={sheetId} />
      </div>
    </main>
  );
}
