"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import { getCalendarMonth, type CalendarMonthSummary, type DashboardSummary } from "@/services/api";

type DashboardLearningChartProps = {
  dashboard: DashboardSummary;
};

export function DashboardLearningChart({ dashboard }: DashboardLearningChartProps) {
  const [calendarData, setCalendarData] = useState<CalendarMonthSummary | null>(null);
  const [activeMetric, setActiveMetric] = useState<"cards" | "sessions">("cards");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    getCalendarMonth(now.getFullYear(), now.getMonth() + 1)
      .then((data) => setCalendarData(data))
      .catch(() => {});
  }, []);

  const chartDays = (() => {
    if (!calendarData?.days) return [];
    const todayStr = new Date().toISOString().split("T")[0];
    const todayIndex = calendarData.days.findIndex((d) => d.date === todayStr);
    
    let sliceDays = [];
    if (todayIndex >= 0) {
      const start = Math.max(0, todayIndex - 6);
      sliceDays = calendarData.days.slice(start, todayIndex + 1);
    } else {
      sliceDays = calendarData.days.slice(-7);
    }

    return sliceDays.map((d) => {
      const dayDate = new Date(d.date);
      const weekday = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const dayNumber = dayDate.getDate();
      return {
        date: d.date,
        label: `${weekday} ${dayNumber}`,
        cards: d.cards_reviewed,
        sessions: d.sessions_count,
        dueCount: d.due_sheets_count,
        isToday: d.is_today,
      };
    });
  })();

  const maxCards = Math.max(...chartDays.map((d) => d.cards), 10);
  const maxSessions = Math.max(...chartDays.map((d) => d.sessions), 4);
  const maxValue = activeMetric === "cards" ? maxCards : maxSessions;
  const upcomingDueSheets = dashboard.due_sheets.slice(0, 4);

  return (
    <section className="dashboard-learning-chart-card">
      <div className="chart-header">
        <div>
          <p className="eyebrow">Learning Momentum</p>
          <h2>7-Day Activity & Review Forecast</h2>
        </div>
        <div className="chart-metric-switch">
          <button
            type="button"
            className={`metric-btn ${activeMetric === "cards" ? "active" : ""}`}
            onClick={() => setActiveMetric("cards")}
          >
            Cards Reviewed
          </button>
          <button
            type="button"
            className={`metric-btn ${activeMetric === "sessions" ? "active" : ""}`}
            onClick={() => setActiveMetric("sessions")}
          >
            Sessions
          </button>
        </div>
      </div>
      <ChartGrid
        chartDays={chartDays}
        activeMetric={activeMetric}
        maxValue={maxValue}
        hoveredIndex={hoveredIndex}
        setHoveredIndex={setHoveredIndex}
        dashboard={dashboard}
        upcomingDueSheets={upcomingDueSheets}
      />
    </section>
  );
}

type ChartGridProps = {
  chartDays: { date: string; label: string; cards: number; sessions: number; dueCount: number; isToday: boolean }[];
  activeMetric: "cards" | "sessions";
  maxValue: number;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
  dashboard: DashboardSummary;
  upcomingDueSheets: DashboardSummary["due_sheets"];
};

function ChartGrid({ chartDays, activeMetric, maxValue, hoveredIndex, setHoveredIndex, dashboard, upcomingDueSheets }: ChartGridProps) {
  return (
    <div className="chart-split-grid">
      <div className="chart-canvas-block">
        <div className="chart-sub-header">
          <span className="chart-hint-label">
            <Icon name="check" size={14} /> Daily Retention Pace
          </span>
          {hoveredIndex !== null && chartDays[hoveredIndex] && (
            <span className="chart-tooltip-badge">
              {chartDays[hoveredIndex].label}:{" "}
              <strong>
                {activeMetric === "cards"
                  ? `${chartDays[hoveredIndex].cards} cards`
                  : `${chartDays[hoveredIndex].sessions} sessions`}
              </strong>
              {chartDays[hoveredIndex].dueCount > 0 && ` · ${chartDays[hoveredIndex].dueCount} due`}
            </span>
          )}
        </div>

        <div className="svg-chart-container">
          <svg viewBox="0 0 460 160" className="learning-bar-svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="barGradientPrimary" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="barGradientHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--gold, #d97706)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--gold, #f59e0b)" stopOpacity="0.5" />
              </linearGradient>
            </defs>

            <line x1="10" y1="20" x2="450" y2="20" stroke="var(--outline)" strokeDasharray="3 3" opacity="0.4" />
            <line x1="10" y1="75" x2="450" y2="75" stroke="var(--outline)" strokeDasharray="3 3" opacity="0.4" />
            <line x1="10" y1="130" x2="450" y2="130" stroke="var(--outline)" opacity="0.7" />

            {chartDays.map((day, idx) => {
              const totalBars = chartDays.length || 7;
              const slotWidth = 440 / totalBars;
              const barWidth = 26;
              const x = 15 + idx * slotWidth + (slotWidth - barWidth) / 2;
              const value = activeMetric === "cards" ? day.cards : day.sessions;
              const barHeight = Math.max(value > 0 ? (value / maxValue) * 105 : 4, 4);
              const y = 130 - barHeight;
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={day.date}
                  className="chart-bar-group"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    fill={day.isToday ? "url(#barGradientHighlight)" : "url(#barGradientPrimary)"}
                    opacity={isHovered ? 1 : 0.85}
                    stroke={day.isToday ? "var(--gold)" : "none"}
                    strokeWidth={day.isToday ? "1.5" : "0"}
                  />
                  {value > 0 && (
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--foreground)">
                      {value}
                    </text>
                  )}
                  <text x={x + barWidth / 2} y="146" textAnchor="middle" fontSize="10" fontWeight={day.isToday ? "800" : "600"} fill={day.isToday ? "var(--primary)" : "var(--muted)"}>
                    {day.label.slice(0, 3)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="chart-legend-bottom">
          <span className="legend-chip"><span className="legend-box current" /> Today</span>
          <span className="legend-chip"><span className="legend-box past" /> Completed</span>
          <Link href="/calendar" className="text-link-subtle">
            Full Month Calendar <Icon name="arrow" size={13} />
          </Link>
        </div>
      </div>

      <ForecastBlock dashboard={dashboard} upcomingDueSheets={upcomingDueSheets} />
    </div>
  );
}
function ForecastBlock({ dashboard, upcomingDueSheets }: { dashboard: DashboardSummary; upcomingDueSheets: DashboardSummary["due_sheets"] }) {
  return (
    <div className="chart-forecast-block">
      <div className="forecast-card-inner">
        <div className="forecast-head-row">
          <h3>
            <Icon name="clock" size={16} /> Due for Review
          </h3>
          <span className="forecast-badge">{dashboard.due_sheets.length} sheets</span>
        </div>

        {upcomingDueSheets.length === 0 ? (
          <div className="forecast-empty-note">
            <Icon name="check" size={20} />
            <p>All reviews are completed! No pending SRS sheets right now.</p>
          </div>
        ) : (
          <ul className="forecast-list">
            {upcomingDueSheets.map((sheet) => (
              <li key={sheet.id} className="forecast-item">
                <div className="forecast-item-text">
                  <strong>{sheet.name}</strong>
                  <small>
                    {sheet.workbook_name} · Due {sheet.next_review_at ? formatDate(sheet.next_review_at) : "Today"}
                  </small>
                </div>
                <Link
                  href={`/sheets/${sheet.id}/study?mode=review`}
                  className="forecast-action-btn"
                  title={`Review ${sheet.name}`}
                >
                  Review <Icon name="arrow" size={12} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="forecast-footer-action">
          <Link href="/calendar" className="button secondary small w-full">
            <Icon name="calendar" size={15} /> Check Calendar Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
