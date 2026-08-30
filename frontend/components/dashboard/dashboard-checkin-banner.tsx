"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { getCalendarMonth, type CalendarMonthSummary } from "@/services/api";

export function DashboardCheckinBanner() {
  const [calendarData, setCalendarData] = useState<CalendarMonthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    getCalendarMonth(now.getFullYear(), now.getMonth() + 1)
      .then((data) => setCalendarData(data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !calendarData) return null;

  return (
    <div className={`dashboard-checkin-banner ${calendarData.today_has_studied ? "completed" : "pending"}`}>
      <div className="checkin-banner-left">
        <span className="checkin-flame-icon">
          <Icon name="flame" size={24} />
        </span>
        <div className="checkin-banner-text">
          <div className="checkin-status-heading">
            <strong>
              {calendarData.today_has_studied
                ? "Today: Study Check-in Complete!"
                : "Today: Check-in Pending"}
            </strong>
            <span className="streak-tag">
              🔥 Streak: {calendarData.current_streak} day{calendarData.current_streak === 1 ? "" : "s"}
            </span>
          </div>
          <p>
            {calendarData.today_has_studied
              ? `Great job! You have completed a study session today. Keep up the momentum!`
              : `Complete at least 1 study session today to keep your streak going.`}
          </p>
        </div>
      </div>
      <div className="checkin-banner-actions">
        <Link href="/calendar" className="button secondary">
          <Icon name="calendar" size={17} /> View Calendar & Schedule
        </Link>
      </div>
    </div>
  );

}
