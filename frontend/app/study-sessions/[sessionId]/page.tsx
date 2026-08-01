import { FlashcardStudyView } from "@/components/study/flashcard-study-view";

type StudySessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function StudySessionPage({ params }: StudySessionPageProps) {
  const { sessionId } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-3xl"><FlashcardStudyView sessionId={sessionId} /></div>
    </main>
  );
}
