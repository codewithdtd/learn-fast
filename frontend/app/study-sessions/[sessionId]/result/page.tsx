import { StudySessionResult } from "@/components/study/study-session-result";

type StudySessionResultPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function StudySessionResultPage({ params }: StudySessionResultPageProps) {
  const { sessionId } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-4xl"><StudySessionResult sessionId={sessionId} /></div>
    </main>
  );
}
