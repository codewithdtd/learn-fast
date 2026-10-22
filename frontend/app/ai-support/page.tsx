import { AppShell } from "@/components/layout/app-shell";
import { AISupportHub } from "@/components/ai-support/ai-support-hub";

export default async function AISupportPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; sheet?: string | string[] }> }) {
  const params = await searchParams;
  const initialTab = params.tab === "speaking" ? "speaking" : params.tab === "sentences" ? "sentences" : "writing";
  const initialSheetId = typeof params.sheet === "string" && /^[1-9]\d*$/.test(params.sheet) ? params.sheet : undefined;
  return <AppShell activeHref="/ai-support"><AISupportHub key={`${initialTab}-${initialSheetId ?? ""}`} initialTab={initialTab} initialSheetId={initialSheetId} /></AppShell>;
}
