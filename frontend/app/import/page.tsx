"use client";

import { useState } from "react";

import { AIGeneratorForm } from "@/components/import/ai-generator-form";
import { ImportWorkbookForm } from "@/components/import/import-workbook-form";
import { AppShell } from "@/components/layout/app-shell";

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"excel" | "ai">("ai");

  return (
    <AppShell activeHref="/import">
      <main className="import-page">
        <section className="import-content">
          <header className="import-header">
            <p className="import-kicker">Content Creation & Import</p>
            <h1>{activeTab === "excel" ? "Import Workbook" : "AI Flashcard Generator"}</h1>
            <p>
              {activeTab === "excel"
                ? "Turn your Excel vocabulary spreadsheets into study-ready flashcards."
                : "Tự động sinh các mẫu câu và cụm từ giao tiếp thông dụng từ Local AI."}
            </p>
          </header>

          <div className="import-tabs-nav" role="tablist" aria-label="Phương thức tạo nội dung">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "ai"}
              className={`import-tab-btn ${activeTab === "ai" ? "active" : ""}`}
              onClick={() => setActiveTab("ai")}
            >
              <span className="import-tab-icon">✨</span>
              <span>Tự sinh bằng AI</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "excel"}
              className={`import-tab-btn ${activeTab === "excel" ? "active" : ""}`}
              onClick={() => setActiveTab("excel")}
            >
              <span className="import-tab-icon">📂</span>
              <span>Nhập file Excel</span>
            </button>
          </div>

          {activeTab === "excel" ? <ImportWorkbookForm /> : <AIGeneratorForm />}
        </section>
      </main>
    </AppShell>
  );
}

