"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { DashboardSummary } from "@/services/api";
import styles from "../cozy-dashboard.module.css";

interface CozyReviewQueueWidgetProps {
  dashboard: DashboardSummary;
}

export function CozyReviewQueueWidget({ dashboard }: CozyReviewQueueWidgetProps) {
  const [activeTab, setActiveTab] = useState<"due" | "new">("due");

  const dueSheets = dashboard.due_sheets;
  const newSheets = dashboard.new_sheets;

  return (
    <article className={styles.cozyCard} id="today-reviews" aria-labelledby="cozy-queue-title">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderTitle}>
          <span className={styles.cardHeaderIcon} aria-hidden="true">📬</span>
          <h2 id="cozy-queue-title" className={styles.cardTitle}>Learning Queues</h2>
        </div>
        <Link href="/workbooks" className={styles.cardActionLink} aria-label="Browse all learning sheets">
          Workbooks <span>→</span>
        </Link>
      </header>

      {/* Tabs chuyển đổi giữa Due Sheets và New Sheets */}
      <div className={styles.queueTabRow} role="tablist" aria-label="Learning queue types">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "due"}
          className={styles.queueTabBtn}
          data-active={activeTab === "due" ? "true" : undefined}
          onClick={() => setActiveTab("due")}
        >
          Scheduled Review ({dueSheets.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "new"}
          className={styles.queueTabBtn}
          data-active={activeTab === "new" ? "true" : undefined}
          onClick={() => setActiveTab("new")}
          id="new-sheets"
        >
          New Sheets ({newSheets.length})
        </button>
      </div>

      {/* Tab: Scheduled Review */}
      {activeTab === "due" && (
        <div className={styles.queueList} role="tabpanel" aria-label="Sheets due for review">
          {dueSheets.length === 0 ? (
            <div className={styles.queueEmptyState}>
              <span style={{ fontSize: "2rem" }} aria-hidden="true">🎉</span>
              <strong>All Caught Up!</strong>
              <p>No sheets are due for review right now. Your SRS island memory is crystal clear.</p>
            </div>
          ) : (
            dueSheets.map((sheet) => (
              <div key={sheet.id} className={styles.queueItem}>
                <div className={styles.queueItemInfo}>
                  <strong>{sheet.name}</strong>
                  <span>
                    {sheet.workbook_name} · Due {formatDate(sheet.next_review_at)}
                  </span>
                </div>
                <Link
                  href={`/sheets/${sheet.id}/study?mode=review`}
                  className={styles.queueItemBtn}
                  aria-label={`Review now: ${sheet.name}`}
                >
                  Review now
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: New Sheets */}
      {activeTab === "new" && (
        <div className={styles.queueList} role="tabpanel" aria-label="New learning sheets">
          {newSheets.length === 0 ? (
            <div className={styles.queueEmptyState}>
              <span style={{ fontSize: "2rem" }} aria-hidden="true">📚</span>
              <strong>All Sheets Started!</strong>
              <p>Import a new workbook or Excel deck to add more words to your collection.</p>
              <Link href="/import" className={styles.cardActionLink} style={{ marginTop: "4px" }}>
                Import workbook →
              </Link>
            </div>
          ) : (
            newSheets.map((sheet) => (
              <div key={sheet.id} className={styles.queueItem}>
                <div className={styles.queueItemInfo}>
                  <strong>{sheet.name}</strong>
                  <span>
                    {sheet.workbook_name} · {sheet.card_count} cards
                  </span>
                </div>
                <Link
                  href={`/sheets/${sheet.id}/study`}
                  className={styles.queueItemBtn}
                  aria-label={`Start learning: ${sheet.name}`}
                >
                  Start
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </article>
  );
}

