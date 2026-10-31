"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createStudySession, type DashboardSummary } from "@/services/api";
import styles from "../cozy-dashboard.module.css";

interface CozyDailyPracticeWidgetProps {
  dashboard: DashboardSummary;
}

export function CozyDailyPracticeWidget({ dashboard }: CozyDailyPracticeWidgetProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeSession = dashboard.active_sessions[0];
  const dueSheet = dashboard.due_sheets[0];
  const newSheet = dashboard.new_sheets[0];
  const selectedSheet = dueSheet ?? newSheet;

  // Tiêu đề và mô tả bài học ưu tiên hôm nay
  const planTitle = activeSession
    ? activeSession.sheet.name
    : selectedSheet
      ? selectedSheet.name
      : "Your Island Queue is Clear!";

  const planSubtitle = activeSession
    ? `${activeSession.sheet.workbook_name} · In progress (${activeSession.total_cards} cards).`
    : dueSheet
      ? `${dueSheet.workbook_name} · ${dueSheet.card_count} cards are ready for scheduled review.`
      : newSheet
        ? `${newSheet.workbook_name} · Start with ${newSheet.card_count} new cards.`
        : "You are completely up to date on all reviews today. Relax or explore new workbooks.";

  async function handleStartPractice() {
    if (isStarting) return;
    setErrorMessage(null);

    // Nếu đã có phiên đang học dở -> Tiếp tục ngay
    if (activeSession) {
      router.push(`/study-sessions/${activeSession.id}`);
      return;
    }

    if (!selectedSheet) {
      router.push("/workbooks");
      return;
    }

    setIsStarting(true);
    try {
      // Ưu tiên srs_review nếu là dueSheet, ngược lại là new_learning
      const session = await createStudySession({
        sheet_id: selectedSheet.id,
        session_type: dueSheet ? "srs_review" : "new_learning",
        direction: "en_to_vi",
      });
      router.push(`/study-sessions/${session.id}`);
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error ? caughtError.message : "Could not start today's practice. Please try again."
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <article className={styles.practiceCard} aria-labelledby="cozy-practice-title">
      <div>
        <div className={styles.practiceHeader}>
          <span className={styles.practiceBadge}>
            <span aria-hidden="true">⭐</span> Daily Focus
          </span>
          <span style={{ fontSize: "1.2rem" }} aria-hidden="true">⛺</span>
        </div>

        <h2 id="cozy-practice-title" className={styles.practiceTitle}>
          {planTitle}
        </h2>
        <p className={styles.practiceSubtitle}>{planSubtitle}</p>

        {(activeSession || selectedSheet) && (
          <div className={styles.practiceStepsRow} aria-label="Learning steps">
            <span className={styles.practiceStepNumber}>1</span>
            <strong>Flashcard Recall</strong>
            <span aria-hidden="true">→</span>
            <span className={styles.practiceStepNumber}>2</span>
            <span>Practice Exercises</span>
          </div>
        )}

        {errorMessage && (
          <p style={{ color: "#9e362c", fontSize: "0.82rem", margin: "0 0 12px" }} role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <div>
        {activeSession || selectedSheet ? (
          <button
            type="button"
            className={styles.practiceCtaBtn}
            onClick={() => void handleStartPractice()}
            disabled={isStarting}
            aria-busy={isStarting}
          >
            {isStarting ? (
              "Starting practice…"
            ) : activeSession ? (
              <>Continue session <span>→</span></>
            ) : dueSheet ? (
              <>Start review now <span>→</span></>
            ) : (
              <>Start learning <span>→</span></>
            )}
          </button>
        ) : (
          <Link href="/workbooks" className={styles.practiceCtaBtn}>
            Explore Workbooks <span>→</span>
          </Link>
        )}
      </div>
    </article>
  );
}

