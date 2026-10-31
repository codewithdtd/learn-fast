"use client";

import Link from "next/link";
import type { DashboardSummary } from "@/services/api";
import styles from "../cozy-dashboard.module.css";

interface CozyQuestsWidgetProps {
  dashboard: DashboardSummary;
  streak: number;
}

export function CozyQuestsWidget({ dashboard, streak }: CozyQuestsWidgetProps) {
  // Mục tiêu chuỗi ngày học tiếp theo (7, 14, 30 ngày)
  const streakTarget = streak < 7 ? 7 : streak < 14 ? 14 : streak < 30 ? 30 : streak + 10;
  const streakPercent = Math.min(100, Math.round((streak / streakTarget) * 100));

  // Tiến độ ôn tập đến hạn: nếu không còn thẻ đến hạn -> 100% hoàn thành
  const dueCount = dashboard.due_sheets.length;
  const duePercent = dueCount === 0 ? 100 : Math.max(15, 100 - dueCount * 20);

  // Tiến độ học từ mới
  const newCount = dashboard.new_sheets.length;
  const newPercent = Math.min(100, Math.max(20, newCount * 15));

  // Thẻ yếu cần khắc phục
  const weakCount = dashboard.weak_card_count;
  const weakPercent = weakCount === 0 ? 100 : Math.max(10, 100 - weakCount * 10);

  const quests = [
    {
      id: "due-review",
      title: "Complete scheduled review",
      icon: "⏳",
      href: "#today-reviews",
      progressText: dueCount === 0 ? "Complete (0 due)" : `${dueCount} sheet${dueCount > 1 ? "s" : ""} left`,
      percent: duePercent,
      isComplete: dueCount === 0,
    },
    {
      id: "learn-new",
      title: "Explore fresh vocabulary",
      icon: "🌱",
      href: "#new-sheets",
      progressText: newCount === 0 ? "All started" : `${newCount} sheet${newCount > 1 ? "s" : ""} ready`,
      percent: newPercent,
      isComplete: newCount === 0,
    },
    {
      id: "weak-cards",
      title: "Fix weak vocabulary cards",
      icon: "🎯",
      href: "/workbooks",
      progressText: weakCount === 0 ? "Mastered (0 weak)" : `${weakCount} card${weakCount > 1 ? "s" : ""} to fix`,
      percent: weakPercent,
      isComplete: weakCount === 0,
    },
    {
      id: "streak-goal",
      title: `Reach ${streakTarget}-day study streak`,
      icon: "🔥",
      href: "/calendar",
      progressText: `${streak} / ${streakTarget} days`,
      percent: streakPercent,
      isComplete: streak >= streakTarget,
    },
  ];

  return (
    <article className={styles.cozyCard} aria-labelledby="cozy-quests-title">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderTitle}>
          <span className={styles.cardHeaderIcon} aria-hidden="true">📋</span>
          <h2 id="cozy-quests-title" className={styles.cardTitle}>Daily Learning Quests</h2>
        </div>
        <Link href="/workbooks" className={styles.cardActionLink} aria-label="Browse all workbooks and sheets">
          All <span>→</span>
        </Link>
      </header>

      <div className={styles.questList}>
        {quests.map((quest) => (
          <Link
            key={quest.id}
            href={quest.href}
            className={styles.questItem}
            aria-label={`${quest.title}: ${quest.progressText}`}
          >
            <div className={styles.questTopRow}>
              <span className={styles.questTitleWrap}>
                <span className={styles.questIcon} aria-hidden="true">{quest.icon}</span>
                <span>{quest.title}</span>
              </span>
              <span className={styles.questCount}>{quest.progressText}</span>
            </div>

            <div
              className={styles.progressBarTrack}
              role="progressbar"
              aria-valuenow={quest.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={styles.progressBarFill}
                style={{ width: `${quest.percent}%` }}
                data-complete={quest.isComplete ? "true" : undefined}
              />
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}

