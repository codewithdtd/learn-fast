import { StudySetupView } from "@/components/study/study-setup";

type StudySetupPageProps = {
  params: Promise<{ sheetId: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
};

export default async function StudySetupPage({ params, searchParams }: StudySetupPageProps) {
  const [{ sheetId }, query] = await Promise.all([params, searchParams]);
  const initialMode = query.mode === "review" ? "review" : "default";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-3xl"><StudySetupView sheetId={sheetId} initialMode={initialMode} /></div>
    </main>
  );
}
