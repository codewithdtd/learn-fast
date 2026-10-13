import { AppShell } from "@/components/layout/app-shell";
import { WritingTopicList } from "@/components/writing/writing-topic-list";

export default function WritingPage() {
  return <AppShell activeHref="/writing"><WritingTopicList /></AppShell>;
}
