import { AppShell } from "@/components/layout/app-shell";
import { PublicDemo } from "@/components/demo/public-demo";

export default function DemoPage() {
  return <AppShell activeHref="/workbooks"><PublicDemo /></AppShell>;
}
