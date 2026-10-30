"use client";

import { useState } from "react";
import { WritingTopicList } from "@/components/writing/writing-topic-list";
import { SpeakingPractice } from "@/components/speaking/speaking-practice";
import { SentencePractice } from "@/components/sentences/sentence-practice";
import { GuestAIPractice } from "@/components/demo/guest-ai-practice";
import { VideoPractice } from "@/components/video-practice/video-practice";
import { IELTSPractice } from "@/components/ielts/ielts-practice";
import { useAuth } from "@/context/auth-context";
import { LearningIllustration } from "@/components/illustrations/learning-illustration";
import styles from "./ai-support.module.css";

type AITab = "writing" | "speaking" | "sentences" | "video" | "ielts";
const tabOrder: AITab[] = ["sentences", "writing", "speaking", "video", "ielts"];

export function AISupportHub({ initialTab, initialSheetId }: { initialTab: AITab; initialSheetId?: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [tab, setTab] = useState<AITab>(initialTab);
  function selectTab(nextTab: AITab) {
    setTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextTab);
    window.history.replaceState(null, "", url);
  }
  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextTab = event.key === "Home" ? tabOrder[0] : event.key === "End" ? tabOrder[tabOrder.length - 1]
      : tabOrder[(tabOrder.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + tabOrder.length) % tabOrder.length];
    selectTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  }
  if (!isLoading && !isAuthenticated) return <div className={styles.hub}>
    <header className={styles.header}><LearningIllustration kind={tab === "video" ? "video" : "writing"} className="journey-only journey-ai-illustration" /><p className={styles.eyebrow}>PRACTICE WITH AI</p><h1>AI Support</h1><p>Try the AI tools with one free guest use per feature. Guest practice is not saved to an account.</p></header>
    {tab === "ielts" ? <IELTSPractice /> : <GuestAIPractice initialVideo={tab === "video"} />}
  </div>;
  return <div className={styles.hub}>
    <header className={styles.header}>
      <LearningIllustration kind={tab === "speaking" ? "speaking" : tab === "video" ? "video" : tab === "writing" ? "writing" : "cards"} className="journey-only journey-ai-illustration" />
      <p className={styles.eyebrow}>PRACTICE WITH AI</p>
      <h1>AI Support</h1>
      <p>Build your English skills with focused writing, speaking, and video practice.</p>
    </header>
    <div className={styles.tabs} role="tablist" aria-label="AI practice type" onKeyDown={handleTabKeyDown}>
      <button type="button" role="tab" id="sentences-tab" tabIndex={tab === "sentences" ? 0 : -1} aria-selected={tab === "sentences"} aria-controls="ai-practice-panel" className={tab === "sentences" ? styles.activeTab : ""} onClick={() => selectTab("sentences")}>Sentences</button>
      <button type="button" role="tab" id="writing-tab" tabIndex={tab === "writing" ? 0 : -1} aria-selected={tab === "writing"} aria-controls="ai-practice-panel" className={tab === "writing" ? styles.activeTab : ""} onClick={() => selectTab("writing")}>Writing</button>
      <button type="button" role="tab" id="speaking-tab" tabIndex={tab === "speaking" ? 0 : -1} aria-selected={tab === "speaking"} aria-controls="ai-practice-panel" className={tab === "speaking" ? styles.activeTab : ""} onClick={() => selectTab("speaking")}>Speaking</button>
      <button type="button" role="tab" id="video-tab" tabIndex={tab === "video" ? 0 : -1} aria-selected={tab === "video"} aria-controls="ai-practice-panel" className={tab === "video" ? styles.activeTab : ""} onClick={() => selectTab("video")}>Video Practice</button>
      <button type="button" role="tab" id="ielts-tab" tabIndex={tab === "ielts" ? 0 : -1} aria-selected={tab === "ielts"} aria-controls="ai-practice-panel" className={tab === "ielts" ? styles.activeTab : ""} onClick={() => selectTab("ielts")}>IELTS Practice</button>
    </div>
    <section id="ai-practice-panel" role="tabpanel" aria-labelledby={`${tab}-tab`}>
      {tab === "sentences" ? <SentencePractice initialSheetId={initialSheetId} /> : tab === "writing" ? <WritingTopicList /> : tab === "speaking" ? <SpeakingPractice /> : tab === "video" ? <VideoPractice /> : <IELTSPractice />}
    </section>
  </div>;
}
