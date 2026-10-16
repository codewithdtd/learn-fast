import { AppShell } from "@/components/layout/app-shell";
import { WritingAttemptView } from "@/components/writing/writing-attempt-view";

export default async function WritingAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const parsedAttemptId = Number(attemptId);
  if (!Number.isInteger(parsedAttemptId) || parsedAttemptId < 1) {
    return <AppShell activeHref="/ai-support"><main><h1>Writing attempt not found</h1></main></AppShell>;
  }
  return <AppShell activeHref="/ai-support"><WritingAttemptView attemptId={parsedAttemptId} /></AppShell>;
}
