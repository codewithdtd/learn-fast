import { AppShell } from "@/components/layout/app-shell";
import { NotificationsPageView } from "@/components/notifications/notifications-page-view";

export const metadata = {
  title: "Notifications | DtdFLow",
  description: "Study reminders & review notification center",
};


export default function NotificationsPage() {
  return (
    <AppShell activeHref="/notifications">
      <main className="notifications-page">
        <NotificationsPageView />
      </main>
    </AppShell>
  );
}
