import { HealthStatus } from "@/components/health-status";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
          English SRS
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Foundation check
        </h1>
        <p className="mt-3 text-slate-600">
          Xác nhận kết nối giữa Next.js và FastAPI trước khi bắt đầu các tính
          năng học tập.
        </p>
        <HealthStatus />
      </section>
    </main>
  );
}
