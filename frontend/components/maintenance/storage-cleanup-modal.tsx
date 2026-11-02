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
          : "Đã xảy ra lỗi trong quá trình dọn dẹp bộ nhớ."
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
                Tối ưu Bộ nhớ Cơ sở dữ liệu
              </h2>
              <p className={styles.subtitle}>
                Dọn dẹp thông báo cũ và dữ liệu rác để tiết kiệm dung lượng Neon Free (0.5 GB)
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Đóng cửa sổ"
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
              <strong>Lưu ý gói Neon Free:</strong> Cơ sở dữ liệu Neon có hạn mức lưu trữ 500 MB.
              Việc định kỳ dọn dẹp thông báo đã đọc, phiên học ẩn danh của khách vãng lai và các bản
              nháp rác sẽ giúp hệ thống luôn vận hành nhanh chóng và không bị quá tải lưu lượng.
            </div>
          </div>

          {/* Stats Overview */}
          {isLoadingStats ? (
            <p style={{ textAlign: "center", color: "var(--muted)", margin: "12px 0" }}>
              Đang thống kê dữ liệu trong database...
            </p>
          ) : stats ? (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Thông báo đã đọc</span>
                <span className={styles.statValue}>{stats.read_notifications} mục</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Phiên học khách cũ (&gt;7 ngày)</span>
                <span className={styles.statValue}>{stats.guest_study_sessions} phiên</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Phiên học bỏ dở (&gt;14 ngày)</span>
                <span className={styles.statValue}>{stats.abandoned_study_sessions} phiên</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Tổng bản ghi có thể dọn dẹp</span>
                <span className={styles.statValue}>{stats.total_cleanable_records} mục</span>
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
            <p className={styles.sectionHeading}>Chọn các hạng mục cần dọn dẹp:</p>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={clearReadNotifs}
                onChange={(e) => setClearReadNotifs(e.target.checked)}
              />
              <div className={styles.optionTexts}>
                <span className={styles.optionLabel}>Xóa thông báo đã đọc</span>
                <span className={styles.optionDesc}>
                  Xóa toàn bộ các thông báo trong hệ thống mà người dùng đã đọc xong.
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
                <span className={styles.optionLabel}>Xóa thông báo chưa đọc quá cũ (&gt;30 ngày)</span>
                <span className={styles.optionDesc}>
                  Xóa các lời nhắc lịch học hoặc điểm danh đã quá hạn hơn 1 tháng.
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
                  Xóa phiên học của khách vãng lai (&gt;7 ngày)
                </span>
                <span className={styles.optionDesc}>
                  Giải phóng dữ liệu thẻ, vòng học và kết quả của các phiên học thử ẩn danh.
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
                  Xóa phiên học active bị bỏ dở (&gt;14 ngày)
                </span>
                <span className={styles.optionDesc}>
                  Xóa các phiên học mở dở dang từ hơn 2 tuần trước không còn sử dụng.
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
                <span className={styles.optionLabel}>Xóa tracking guest AI (&gt;14 ngày)</span>
                <span className={styles.optionDesc}>
                  Xóa hash bản ghi kiểm soát dùng thử tính năng AI của khách vãng lai.
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
                <span className={styles.optionLabel}>Xóa bản nháp viết trống (&gt;7 ngày)</span>
                <span className={styles.optionDesc}>
                  Xóa các bản nháp bài viết Writing chưa có nội dung văn bản.
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
            Đóng
          </button>
          <button
            type="button"
            className={styles.cleanupBtn}
            onClick={() => void handleExecuteCleanup()}
            disabled={isCleaning}
          >
            {isCleaning ? "🔄 Đang dọn dẹp..." : "🧹 Dọn dẹp dữ liệu thừa ngay"}
          </button>
        </footer>
      </div>
    </div>
  );
}
