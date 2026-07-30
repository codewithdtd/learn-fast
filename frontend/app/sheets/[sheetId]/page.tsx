import { SheetDetailView } from "@/components/sheets/sheet-detail";

type SheetPageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function SheetPage({ params }: SheetPageProps) {
  const { sheetId } = await params;
  return <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900"><div className="mx-auto w-full max-w-4xl"><SheetDetailView sheetId={sheetId} /></div></main>;
}
