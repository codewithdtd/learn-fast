import { WorkbookDetailView } from "@/components/workbooks/workbook-detail";
import { AppShell } from "@/components/layout/app-shell";

type WorkbookPageProps = {
  params: Promise<{ workbookId: string }>;
};

export default async function WorkbookPage({ params }: WorkbookPageProps) {
  const { workbookId } = await params;
  return (
    <AppShell activeHref="/workbooks">
      <main className="workbook-detail-page">
        <WorkbookDetailView workbookId={workbookId} />
      </main>
    </AppShell>
  );
}
