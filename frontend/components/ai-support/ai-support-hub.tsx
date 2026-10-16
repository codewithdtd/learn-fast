"use client";

import { useState } from "react";
import { WritingTopicList } from "@/components/writing/writing-topic-list";
import { SpeakingPractice } from "@/components/speaking/speaking-practice";
import styles from "./ai-support.module.css";

type AITab = "writing" | "speaking";

export function AISupportHub({ initialTab }: { initialTab: AITab }) {
  const [tab, setTab] = useState<AITab>(initialTab);
  function selectTab(nextTab: AITab) {
    setTab(nextTab);
    window.history.replaceState(null, "", `/ai-support?tab=${nextTab}`);
  }
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextTab = tab === "writing" ? "speaking" : "writing";
    selectTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  }
  return <div className={styles.hub}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>PRACTICE WITH AI</p>
      <h1>AI Support</h1>
      <p>Build your English writing and speaking skills with focused practice and feedback.</p>
    </header>
    <div className={styles.tabs} role="tablist" aria-label="AI practice type" onKeyDown={handleTabKeyDown}>
      <button type="button" role="tab" id="writing-tab" tabIndex={tab === "writing" ? 0 : -1} aria-selected={tab === "writing"} aria-controls="ai-practice-panel" className={tab === "writing" ? styles.activeTab : ""} onClick={() => selectTab("writing")}>Writing</button>
      <button type="button" role="tab" id="speaking-tab" tabIndex={tab === "speaking" ? 0 : -1} aria-selected={tab === "speaking"} aria-controls="ai-practice-panel" className={tab === "speaking" ? styles.activeTab : ""} onClick={() => selectTab("speaking")}>Speaking</button>
    </div>
    <section id="ai-practice-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {tab === "writing" ? <WritingTopicList /> : <SpeakingPractice />}
    </section>
  </div>;
}
