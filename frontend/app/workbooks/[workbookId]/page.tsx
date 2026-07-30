import { WorkbookDetailView } from "@/components/workbooks/workbook-detail";

type WorkbookPageProps = {
  params: Promise<{ workbookId: string }>;
};

export default async function WorkbookPage({ params }: WorkbookPageProps) {
  const { workbookId } = await params;
  return <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900"><div className="mx-auto w-full max-w-4xl"><WorkbookDetailView workbookId={workbookId} /></div></main>;
}
