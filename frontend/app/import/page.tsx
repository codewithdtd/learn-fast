import { ImportWorkbookForm } from "@/components/import/import-workbook-form";

export default function ImportPage() {
  return (
    <main className="flex min-h-screen justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <section className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
          Content import
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Import an Excel workbook
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          Upload an .xlsx file with Phrase and Meaning columns. Example EN and
          Example VI are optional.
        </p>
        <ImportWorkbookForm />
      </section>
    </main>
  );
}
