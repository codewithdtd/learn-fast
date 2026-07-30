import { QuickRecallView } from "@/components/quick-recall/quick-recall-view";

type QuickRecallPageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function QuickRecallPage({ params }: QuickRecallPageProps) {
  const { sheetId } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-4xl">
        <QuickRecallView sheetId={sheetId} />
      </div>
    </main>
  );
}
