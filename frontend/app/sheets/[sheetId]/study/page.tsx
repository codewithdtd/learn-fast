import { AppShell } from "@/components/layout/app-shell";
import { StudySetupView } from "@/components/study/study-setup";

type StudySetupPageProps = {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function StudySetupPage({ params, searchParams }: StudySetupPageProps) {
  const [{ sheetId }, query] = await Promise.all([params, searchParams]);
  const initialMode = query.mode === "review" ? "review" : "default";

  return (
    <AppShell activeHref="/workbooks">
      <main className="study-setup-page">
        <StudySetupView sheetId={sheetId} initialMode={initialMode} />
      </main>
    </AppShell>
  );
}
