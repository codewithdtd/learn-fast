import { AppShell } from "@/components/layout/app-shell";
import { ParagraphPractice } from "@/components/paragraph-practice/paragraph-practice";

export default async function ParagraphPracticePage({ params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  return <AppShell activeHref="/workbooks"><ParagraphPractice sheetId={sheetId} /></AppShell>;
}
