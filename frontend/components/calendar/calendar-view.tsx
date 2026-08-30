"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import {
  getCalendarDayDetail,
  getCalendarMonth,
  type CalendarDayDetail,
  type CalendarDaySummary,
  type CalendarMonthSummary,
} from "@/services/api";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function CalendarView() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const [calendarData, setCalendarData] = useState<CalendarMonthSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0]
  );
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMonth(year: number, month: number) {
    setIsLoadingMonth(true);
    setError(null);
    try {
      const data = await getCalendarMonth(year, month);
      setCalendarData(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load calendar data."
      );
    } finally {
      setIsLoadingMonth(false);
    }
  }

  async function loadDayDetail(dateStr: string) {
    setIsLoadingDay(true);
    try {
      const detail = await getCalendarDayDetail(dateStr);
      setDayDetail(detail);
    } catch {
      // Ignore
    } finally {
      setIsLoadingDay(false);
    }
  }

  useEffect(() => {
    void loadMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      void loadDayDetail(selectedDate);
    }
  }, [selectedDate]);

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleGoToday() {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
    setSelectedDate(now.toISOString().split("T")[0]);
  }

  // Calculate start offset (Monday = 0, Sunday = 6)
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay();
  const startOffset = (firstDayOfMonth + 6) % 7;

  return (
    <div className="calendar-page-layout">
      <header className="calendar-header-banner">
        <div className="banner-title-block">
          <p className="eyebrow">Progress & Schedule</p>
          <h1>Check-in Calendar & SRS Schedule</h1>
          <p className="banner-subtext">
            Check in every day to build a habit and ensure long-term vocabulary retention.
          </p>
        </div>

        {calendarData && (
          <div className="streak-stats-ribbon">
            <div className="streak-card highlight">
              <span className="streak-icon">
                <Icon name="flame" size={28} />
              </span>
              <div className="streak-info">
                <strong>{calendarData.current_streak} Day{calendarData.current_streak === 1 ? "" : "s"}</strong>
                <span>Current Streak</span>
              </div>
            </div>
            <div className="streak-card">
              <span className="streak-icon">
                <Icon name="check" size={26} />
              </span>
              <div className="streak-info">
                <strong>
                  {calendarData.total_study_days_this_month} Day{calendarData.total_study_days_this_month === 1 ? "" : "s"}
                </strong>
                <span>Studied This Month</span>
              </div>
            </div>
            <div className="streak-card">
              <span className="streak-icon">
                <Icon name="books" size={26} />
              </span>
              <div className="streak-info">
                <strong>{calendarData.total_cards_this_month} Card{calendarData.total_cards_this_month === 1 ? "" : "s"}</strong>
                <span>Total Reviewed</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="error-card" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => void loadMonth(currentYear, currentMonth)}
          >
            Try again
          </button>
        </div>
      )}

      <div className="calendar-main-grid">
        {/* Left Column: Month Calendar */}
        <section className="calendar-month-panel">
          <div className="month-navigation-bar">
            <div className="month-title-wrap">
              <h2>
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </h2>
              <button
                type="button"
                className="button-subtle-pill"
                onClick={handleGoToday}
              >
                Today
              </button>
            </div>
            <div className="month-nav-actions">
              <button
                type="button"
                className="btn-icon"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                <Icon name="back" size={18} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays-header">
            {WEEKDAYS.map((day) => (
              <div key={day} className="weekday-cell">
                {day}
              </div>
            ))}
          </div>

          {isLoadingMonth ? (
            <div className="calendar-skeleton">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="calendar-skeleton-cell" />
              ))}
            </div>
          ) : (
            <div className="calendar-days-grid">
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day-cell empty" />
              ))}

              {calendarData?.days.map((day) => {
                const isSelected = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`calendar-day-cell ${
                      day.is_today ? "today" : ""
                    } ${day.has_studied ? "studied" : ""} ${
                      isSelected ? "selected" : ""
                    } ${day.is_future ? "future" : ""}`}
                    onClick={() => setSelectedDate(day.date)}
                    aria-label={`Date ${day.date}`}
                  >
                    <div className="cell-top">
                      <span className="day-number">
                        {new Date(day.date).getDate()}
                      </span>
                      {day.has_studied && (
                        <span className="study-badge" title="Checked in (Studied)">
                          <Icon name="check" size={12} />
                        </span>
                      )}
                    </div>

                    <div className="cell-indicators">
                      {day.due_sheets_count > 0 && (
                        <span
                          className="due-indicator-pill"
                          title={`${day.due_sheets_count} sheet(s) due for review`}
                        >
                          <Icon name="review" size={11} /> {day.due_sheets_count}
                        </span>
                      )}
                      {day.cards_reviewed > 0 && (
                        <span className="cards-count-label">
                          {day.cards_reviewed} cards
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="calendar-legend-bar">
            <div className="legend-item">
              <span className="legend-dot studied" />
              <span>Studied (Checked-in)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot due" />
              <span>Due for Review</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot today" />
              <span>Today</span>
            </div>
          </div>
        </section>

        {/* Right Column: Selected Day Inspector */}
        <aside className="calendar-inspector-panel">
          <div className="inspector-card">
            <header className="inspector-header">
              <div>
                <p className="eyebrow">Day Details</p>
                <h3>
                  {selectedDate
                    ? formatDate(selectedDate)
                    : "Select a date to inspect"}
                </h3>
              </div>
              {dayDetail?.is_today && (
                <span className="today-chip">Today</span>
              )}
            </header>

            {isLoadingDay ? (
              <div className="inspector-loading">Loading details...</div>
            ) : dayDetail ? (
              <div className="inspector-content">
                {/* Check-in Status Banner */}
                <div
                  className={`checkin-status-banner ${
                    dayDetail.has_studied ? "completed" : "pending"
                  }`}
                >
                  <span className="status-icon">
                    <Icon
                      name={dayDetail.has_studied ? "check" : "clock"}
                      size={22}
                    />
                  </span>
                  <div>
                    <strong>
                      {dayDetail.has_studied
                        ? "Study Check-in Complete!"
                        : "No Study Activity Recorded"}
                    </strong>
                    <p>
                      {dayDetail.has_studied
                        ? `Completed ${dayDetail.completed_sessions.length} session${dayDetail.completed_sessions.length === 1 ? "" : "s"} (${dayDetail.total_cards_reviewed} cards)`
                        : dayDetail.is_today
                        ? "Complete at least 1 study session today to keep your streak!"
                        : "No completed study sessions recorded on this day."}
                    </p>
                  </div>
                </div>

                {/* Due Sheets List */}
                {dayDetail.due_sheets.length > 0 && (
                  <div className="inspector-section">
                    <h4>
                      Scheduled SRS Reviews ({dayDetail.due_sheets.length})
                    </h4>
                    <div className="due-sheets-mini-list">
                      {dayDetail.due_sheets.map((sheet) => (
                        <div key={sheet.id} className="due-sheet-item-row">
                          <div>
                            <strong>{sheet.name}</strong>
                            <span>
                              {sheet.workbook_name} · {sheet.card_count} cards
                            </span>
                          </div>
                          <Link
                            href={`/sheets/${sheet.id}/study?mode=review`}
                            className="button primary small"
                          >
                            Review now
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Sessions List */}
                <div className="inspector-section">
                  <h4>Completed Sessions</h4>
                  {dayDetail.completed_sessions.length === 0 ? (
                    <p className="empty-copy">
                      No study sessions completed on this date.
                    </p>
                  ) : (
                    <div className="session-history-mini-list">
                      {dayDetail.completed_sessions.map((session) => (
                        <Link
                          key={session.id}
                          href={`/study-sessions/${session.id}/result`}
                          className="session-history-row"
                        >
                          <div className="session-row-info">
                            <strong>{session.sheet_name}</strong>
                            <span>
                              {session.workbook_name} · {session.total_cards} cards
                            </span>
                          </div>
                          <div className="session-row-score">
                            {session.mastery_score !== null
                              ? `${session.mastery_score}%`
                              : "View result"}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );

}
