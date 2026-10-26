import { AppShell } from "@/components/layout/app-shell";
import { NewsReader } from "@/components/reading/news-reader";

export default function ReadingPage() {
  return <AppShell activeHref="/reading"><NewsReader /></AppShell>;
}
