"use client";

import React, { useEffect, useState } from "react";
import styles from "./storage-cleanup-modal.module.css";
import {
  executeStorageCleanup,
  getStorageCleanupStats,
  type StorageCleanupRequest,
  type StorageCleanupResponse,
  type StorageCleanupStats,
} from "@/services/api";

type StorageCleanupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCleanupSuccess?: () => void;
};

export function StorageCleanupModal({
  isOpen,
  onClose,
  onCleanupSuccess,
}: StorageCleanupModalProps) {
  const [stats, setStats] = useState<StorageCleanupStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StorageCleanupResponse | null>(null);

  // Checkbox options
  const [clearReadNotifs, setClearReadNotifs] = useState<boolean>(true);
  const [clearStaleNotifs, setClearStaleNotifs] = useState<boolean>(true);
  const [clearGuestSessions, setClearGuestSessions] = useState<boolean>(true);
  const [clearAbandonedSessions, setClearAbandonedSessions] = useState<boolean>(true);
  const [clearGuestAi, setClearGuestAi] = useState<boolean>(true);
  const [clearGuestIelts, setClearGuestIelts] = useState<boolean>(true);
  const [clearEmptyDrafts, setClearEmptyDrafts] = useState<boolean>(true);

  // Load stats whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setError(null);
      return;
    }

    let active = true;
    setIsLoadingStats(true);
    setError(null);

    getStorageCleanupStats()
      .then((data) => {
        if (!active) return;
        setStats(data);
      })
      .catch((caughtError: unknown) => {
        if (!active) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load database storage stats."
        );
      })
      .finally(() => {
        if (active) setIsLoadingStats(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleExecuteCleanup() {
    setIsCleaning(true);
    setError(null);
    setResult(null);

    const payload: StorageCleanupRequest = {
      clear_read_notifications: clearReadNotifs,
      clear_stale_notifications: clearStaleNotifs,
      clear_guest_sessions: clearGuestSessions,
      clear_abandoned_sessions: clearAbandonedSessions,
      clear_guest_ai_usage: clearGuestAi,
      clear_guest_ielts: clearGuestIelts,
      clear_empty_drafts: clearEmptyDrafts,
    };

    try {
      const response = await executeStorageCleanup(payload);
      setResult(response);
      // Refresh stats
      const updatedStats = await getStorageCleanupStats();
      setStats(updatedStats);
      onCleanupSuccess?.();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An error occurred during storage cleanup."
      );
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-modal-title"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.iconBadge} aria-hidden="true">
              🧹
            </div>
            <div>
              <h2 id="storage-modal-title" className={styles.title}>
                Optimize Database Storage
              </h2>
              <p className={styles.subtitle}>
                Clean up stale notifications and temporary data to conserve Neon Free (0.5 GB) quota
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>

        {/* Modal Body */}
        <div className={styles.body}>
          {/* Neon Storage Notice */}
          <div className={styles.neonNotice}>
            <span aria-hidden="true">💡</span>
            <div>
              <strong>Neon Free quota note:</strong> Neon PostgreSQL has a 500 MB storage cap.
              Periodically cleaning up read notifications, anonymous guest study sessions, and empty
              drafts helps keep the system running fast and well below storage limits.
            </div>
          </div>

          {/* Stats Overview */}
          {isLoadingStats ? (
            <p style={{ textAlign: "center", color: "var(--muted)", margin: "12px 0" }}>
              Fetching database storage statistics...
            </p>
          ) : stats ? (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Read notifications</span>
                <span className={styles.statValue}>{stats.read_notifications} items</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Old guest sessions (&gt;7 days)</span>
                <span className={styles.statValue}>{stats.guest_study_sessions} sessions</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Abandoned sessions (&gt;14 days)</span>
                <span className={styles.statValue}>{stats.abandoned_study_sessions} sessions</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total cleanable records</span>
                <span className={styles.statValue}>{stats.total_cleanable_records} items</span>
              </div>
            </div>
          ) : null}

          {/* Success Banner */}
          {result && (
            <div className={styles.resultBanner} role="status">
              <p className={styles.resultTitle}>
                <span>✨</span>
                <span>{result.message}</span>
              </p>
              <div className={styles.resultPills}>
                {Object.entries(result.deleted_counts).map(([key, count]) =>
                  count > 0 ? (
                    <span key={key} className={styles.resultPill}>
                      {key}: -{count}
                    </span>
                  ) : null
                )}
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: "#d9534f", fontSize: "0.85rem", margin: 0 }}>
              ⚠️ {error}
            </p>
          )}

          {/* Checklist Options */}
          <div className={styles.optionsSection}>
            <p className={styles.sectionHeading}>Select cleanup categories:</p>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearReadNotifs}
                onChange={(e) => setClearReadNotifs(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>Delete read notifications</span>
                <span className={styles.optionDesc}>
                  Purge all notifications across the system that users have already marked as read.
                </span>
              </div>
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearStaleNotifs}
                onChange={(e) => setClearStaleNotifs(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>Delete old unread notifications (&gt;30 days)</span>
                <span className={styles.optionDesc}>
                  Remove study reminders and check-in alerts that have been overdue for over 1 month.
                </span>
              </div>
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearGuestSessions}
                onChange={(e) => setClearGuestSessions(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>
                  Delete guest study sessions (&gt;7 days)
                </span>
                <span className={styles.optionDesc}>
                  Release temporary cards, rounds, and results from anonymous practice sessions.
                </span>
              </div>
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearAbandonedSessions}
                onChange={(e) => setClearAbandonedSessions(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>
                  Delete abandoned active sessions (&gt;14 days)
                </span>
                <span className={styles.optionDesc}>
                  Clean up study sessions opened and abandoned more than 2 weeks ago.
                </span>
              </div>
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearGuestAi}
                onChange={(e) => setClearGuestAi(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>Delete guest AI tracking (&gt;14 days)</span>
                <span className={styles.optionDesc}>
                  Clear rate-limiting hashes for guest AI feature trials.
                </span>
              </div>
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearEmptyDrafts}
                onChange={(e) => setClearEmptyDrafts(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>Delete empty writing drafts (&gt;7 days)</span>
                <span className={styles.optionDesc}>
                  Remove IELTS Writing drafts that contain no essay text.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={isCleaning}
          >
            Close
          </button>
          <button
            type="button"
            className={styles.cleanupBtn}
            onClick={() => void handleExecuteCleanup()}
            disabled={isCleaning}
          >
            {isCleaning ? "🔄 Cleaning up..." : "🧹 Clean up temporary data now"}
          </button>
        </footer>
      </div>
    </div>
  );
}
