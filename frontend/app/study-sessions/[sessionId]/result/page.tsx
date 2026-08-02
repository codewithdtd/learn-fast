import { AppShell } from "@/components/layout/app-shell";
import { StudySessionResult } from "@/components/study/study-session-result";

type StudySessionResultPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function StudySessionResultPage({ params }: StudySessionResultPageProps) {
  const { sessionId } = await params;

  return (
    <AppShell activeHref="/workbooks">
      <main className="study-result-page">
        <StudySessionResult sessionId={sessionId} />
      </main>
    </AppShell>
  );
}
