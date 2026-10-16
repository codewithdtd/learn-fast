import { AppShell } from "@/components/layout/app-shell";
import { AISupportHub } from "@/components/ai-support/ai-support-hub";

export default async function AISupportPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const params = await searchParams;
  const initialTab = params.tab === "speaking" ? "speaking" : "writing";
  return <AppShell activeHref="/ai-support"><AISupportHub initialTab={initialTab} /></AppShell>;
}
