"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardSummary } from "@/services/api";
import styles from "../cozy-dashboard.module.css";

interface CozyOverviewWidgetProps {
  dashboard: DashboardSummary;
  streak: number;
}

export function CozyOverviewWidget({ dashboard, streak }: CozyOverviewWidgetProps) {
  const [mounted, setMounted] = useState(false);
  const [todayDay, setTodayDay] = useState(1);
  const [monthName, setMonthName] = useState("");
  const [daysInMonth, setDaysInMonth] = useState<number[]>([]);
  const [startDayOffset, setStartDayOffset] = useState(0);

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTodayDay(now.getDate());

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    setMonthName(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);

    // Tính số ngày trong tháng hiện tại và ngày đầu tuần (T2 - CN)
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Chuyển về T2 = 0, CN = 6
    const offset = (firstDay + 6) % 7;

    setStartDayOffset(offset);
    setDaysInMonth(Array.from({ length: totalDays }, (_, i) => i + 1));
  }, []);

  // Tính số sao dựa trên chuỗi học và các lượt ôn
  // Đánh giá chuyên cần từ 3.0 đến 5.0 sao
  const starCount = Math.min(5, Math.max(3, 3 + Math.floor(streak / 3)));

  return (
    <article className={styles.cozyCard} aria-labelledby="cozy-overview-title">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderTitle}>
          <span className={styles.cardHeaderIcon} aria-hidden="true">🏡</span>
          <h2 id="cozy-overview-title" className={styles.cardTitle}>Island Overview</h2>
        </div>
        <Link href="/calendar" className={styles.cardActionLink} aria-label="View full study calendar">
          Calendar <span>→</span>
        </Link>
      </header>

      {/* Đánh giá sao chuyên cần & ID Đảo */}
      <div className={styles.overviewStatsRow}>
        <div className={styles.starRatingWrap}>
          <span className={styles.ratingLabel}>Study Rating</span>
          <div className={styles.starsRow} aria-label={`${starCount} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} aria-hidden="true">
                {i < starCount ? "⭐" : "☆"}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.islandIdBadge} title="Learner Island Code">
          LF-COZY-{streak}D
        </div>
      </div>

      {/* Lịch Mini Tháng hiện tại */}
      <div className={styles.miniCalendar} aria-label="Mini study calendar">
        <div className={styles.calendarMonthHeader}>
          <span>{mounted ? monthName : "Current Month"}</span>
          <span title={`${streak} day study streak`}>🔥 {streak}d streak</span>
        </div>

        <div className={styles.calendarGrid}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, index) => (
            <span key={index} className={styles.calendarDayName}>
              {d}
            </span>
          ))}

          {/* Ô trống bù đầu tháng */}
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <span key={`empty-${i}`} aria-hidden="true" />
          ))}

          {/* Các ngày trong tháng */}
          {daysInMonth.map((day) => {
            const isToday = mounted && day === todayDay;
            // Đánh dấu các ngày nằm trong chuỗi streak gần đây
            const isStreakDay = mounted && day <= todayDay && day > todayDay - streak;

            return (
              <span
                key={day}
                className={styles.calendarDayCell}
                data-today={isToday ? "true" : undefined}
                data-active={isStreakDay ? "true" : undefined}
                title={`Day ${day}${isToday ? " (Today)" : ""}`}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>

      {/* 3 Chỉ số hàng đợi cốt lõi */}
      <div className={styles.overviewPillsRow}>
        <div className={styles.overviewPill} title="Sheets ready for scheduled review">
          <span className={styles.overviewPillNumber}>{dashboard.due_sheets.length}</span>
          <span className={styles.overviewPillLabel}>Due Sheets</span>
        </div>
        <div className={styles.overviewPill} title="Study sessions in progress">
          <span className={styles.overviewPillNumber}>{dashboard.active_sessions.length}</span>
          <span className={styles.overviewPillLabel}>In Progress</span>
        </div>
        <div className={styles.overviewPill} title="Unstarted new learning sheets">
          <span className={styles.overviewPillNumber}>{dashboard.new_sheets.length}</span>
          <span className={styles.overviewPillLabel}>New Sheets</span>
        </div>
      </div>
    </article>
  );
}

