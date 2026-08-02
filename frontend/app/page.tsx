import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto w-full max-w-5xl"><DashboardView /></div>
    </main>
  );
}
