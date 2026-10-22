import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PublicDemo } from "@/components/demo/public-demo";
import { DEMO_VIEWS } from "@/lib/demo-data";

export default async function DemoViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const selected = DEMO_VIEWS.find((item) => item === view);
  if (!selected) notFound();
  return <AppShell activeHref="/workbooks"><PublicDemo key={selected} view={selected} /></AppShell>;
}
