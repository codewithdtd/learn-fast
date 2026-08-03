import { AppShell } from "@/components/layout/app-shell";
import { QuickRecallView } from "@/components/quick-recall/quick-recall-view";

type QuickRecallPageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function QuickRecallPage({ params }: QuickRecallPageProps) {
  const { sheetId } = await params;

  return (
    <AppShell activeHref="/workbooks">
      <main className="quick-recall-page">
        <QuickRecallView sheetId={sheetId} />
      </main>
    </AppShell>
  );
}
