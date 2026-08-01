import { StudySetupView } from "@/components/study/study-setup";

type StudySetupPageProps = {
  params: Promise<{ sheetId: string }>;
};

export default async function StudySetupPage({ params }: StudySetupPageProps) {
  const { sheetId } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto w-full max-w-3xl"><StudySetupView sheetId={sheetId} /></div>
    </main>
  );
}
