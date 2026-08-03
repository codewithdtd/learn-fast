import { AppShell } from "@/components/layout/app-shell";
import { FlashcardStudyView } from "@/components/study/flashcard-study-view";

type StudySessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function StudySessionPage({ params }: StudySessionPageProps) {
  const { sessionId } = await params;

  return (
    <AppShell activeHref="/workbooks">
      <main className="study-session-page">
        <FlashcardStudyView sessionId={sessionId} />
      </main>
    </AppShell>
  );
}
