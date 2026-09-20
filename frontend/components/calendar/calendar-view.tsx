"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate, formatLabel } from "@/lib/format";
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
  return (
    <Suspense fallback={<div className="calendar-skeleton" />}>
      <CalendarViewContent />
    </Suspense>
  );
}

function CalendarViewContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const today = new Date();
  const initialDateStr = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : today.toISOString().split("T")[0];

  const initialYear = Number(initialDateStr.slice(0, 4));
  const initialMonth = Number(initialDateStr.slice(5, 7));

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [calendarData, setCalendarData] = useState<CalendarMonthSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(initialDateStr);
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [isLoadingMonth, setIsLoadingMonth] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync date when url param changes
  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam);
      const y = Number(dateParam.slice(0, 4));
      const m = Number(dateParam.slice(5, 7));
      setCurrentYear(y);
      setCurrentMonth(m);
    }
  }, [dateParam]);

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

  // Days in month that have scheduled reviews
  const daysWithDue = (calendarData?.days || []).filter((d) => d.due_sheets_count > 0);

  return (
    <div className="calendar-page-layout">
      <header className="calendar-header-banner">
        <div className="banner-title-block">
          <p className="eyebrow">Progress & Spaced Repetition</p>
          <h1>Check-in Calendar & Review Schedule</h1>
          <p className="banner-subtext">
            Track daily study streaks and see exact dates for upcoming spaced repetition reviews.
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
                <Icon name="review" size={26} />
              </span>
              <div className="streak-info">
                <strong>{daysWithDue.length} Day{daysWithDue.length === 1 ? "" : "s"}</strong>
                <span>Scheduled Reviews</span>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Month Schedule Quick Forecast Ribbon */}
      {daysWithDue.length > 0 && (
        <section className="month-due-forecast-ribbon">
          <div className="forecast-header">
            <div className="forecast-title">
              <Icon name="clock" size={18} />
              <strong>Upcoming Reviews in {MONTH_NAMES[currentMonth - 1]}:</strong>
            </div>
            <span className="forecast-count">{daysWithDue.length} scheduled dates</span>
          </div>
          <div className="forecast-pills-row">
            {daysWithDue.map((d) => {
              const isSelected = d.date === selectedDate;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDate(d.date)}
                  className={`forecast-pill ${isSelected ? "active" : ""} ${d.is_today ? "today" : ""}`}
                >
                  <span className="forecast-pill-date">
                    {formatDate(d.date)} {d.is_today ? "(Today)" : ""}
                  </span>
                  <span className="forecast-pill-badge">
                    {d.due_sheets_count} sheet{d.due_sheets_count === 1 ? "" : "s"} due
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
                const hasDue = day.due_sheets_count > 0;
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`calendar-day-cell ${
                      day.is_today ? "today" : ""
                    } ${day.has_studied ? "studied" : ""} ${
                      isSelected ? "selected" : ""
                    } ${day.is_future ? "future" : ""} ${
                      hasDue ? "has-due" : ""
                    }`}
                    onClick={() => setSelectedDate(day.date)}
                    aria-label={`Date ${day.date}: ${day.due_sheets_count} sheets due, ${day.cards_reviewed} cards reviewed`}
                  >
                    <div className="cell-top">
                      <span className="day-number">
                        {new Date(day.date).getDate()}
                      </span>
                      {day.has_studied && (
                        <span className="study-badge" title="Checked in (Completed Study)">
                          <Icon name="check" size={12} />
                        </span>
                      )}
                    </div>

                    <div className="cell-indicators">
                      {day.due_sheets_count > 0 && (
                        <span
                          className="due-indicator-pill"
                          title={`${day.due_sheets_count} sheet(s) scheduled for review on this day`}
                        >
                          <Icon name="review" size={11} /> {day.due_sheets_count} due
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
                <p className="eyebrow">Day Schedule & Activity</p>
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
                {/* Scheduled SRS Reviews Banner / List */}
                <div className="inspector-section">
                  <div className="section-title-with-badge">
                    <h4>Scheduled Reviews on this Day</h4>
                    <span className={`count-tag ${dayDetail.due_sheets.length > 0 ? "highlight" : ""}`}>
                      {dayDetail.due_sheets.length}
                    </span>
                  </div>

                  {dayDetail.due_sheets.length === 0 ? (
                    <div className="empty-schedule-box">
                      <Icon name="check" size={18} />
                      <p>No spaced repetition reviews scheduled for this date.</p>
                    </div>
                  ) : (
                    <div className="due-sheets-mini-list">
                      {dayDetail.due_sheets.map((sheet) => (
                        <div key={sheet.id} className="due-sheet-item-card">
                          <div className="due-sheet-meta">
                            <div className="due-sheet-title-row">
                              <strong>{sheet.name}</strong>
                              <span className={`priority-badge priority-${sheet.priority}`}>
                                {formatLabel(sheet.priority)}
                              </span>
                            </div>
                            <span className="due-sheet-subtext">
                              {sheet.workbook_name} · {sheet.card_count} flashcards
                            </span>
                            {sheet.next_review_at && (
                              <span className="due-sheet-time">
                                <Icon name="clock" size={13} /> Target: {formatDate(sheet.next_review_at)}
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/sheets/${sheet.id}/study?mode=review`}
                            className="button primary small"
                          >
                            Review now <Icon name="arrow" size={14} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Sessions List */}
                <div className="inspector-section">
                  <div className="section-title-with-badge">
                    <h4>Completed Sessions</h4>
                    <span className="count-tag">{dayDetail.completed_sessions.length}</span>
                  </div>
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
                              {session.workbook_name} · {session.total_cards} cards · {formatDate(session.completed_at)}
                            </span>
                          </div>
                          <div className="session-row-score">
                            {session.mastery_score !== null
                              ? `${session.mastery_score}%`
                              : "View"}
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
