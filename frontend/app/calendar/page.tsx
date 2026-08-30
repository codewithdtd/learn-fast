import { AppShell } from "@/components/layout/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata = {
  title: "Check-in Calendar & Schedule | DtdFLow",
  description: "Track daily study check-in and spaced repetition review schedules",
};


export default function CalendarPage() {
  return (
    <AppShell activeHref="/calendar">
      <main className="calendar-page">
        <CalendarView />
      </main>
    </AppShell>
  );
}
