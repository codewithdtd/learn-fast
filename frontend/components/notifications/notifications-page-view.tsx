"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/services/api";

export function NotificationsPageView() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData(unreadOnly: boolean) {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getNotifications(unreadOnly, 50);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load notifications."
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData(filter === "unread");
  }, [filter]);

  async function handleMarkRead(id: number) {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  }

  return (
    <div className="notifications-full-page">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Notification Center</p>
          <h1>Notifications & Reminders</h1>
          <p className="heading-date">
            Stay updated with review schedules, daily check-ins, and study milestones.
          </p>
        </div>
        <div className="heading-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => void handleMarkAllRead()}
            >
              Mark all as read
            </button>
          )}
          <Link href="/calendar" className="button primary">
            View Calendar & Schedule
          </Link>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="notification-filter-tabs">
        <button
          type="button"
          className={`tab-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All notifications
        </button>
        <button
          type="button"
          className={`tab-btn ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {error && (
        <div className="error-card" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => void loadData(filter === "unread")}
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="dashboard-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <Icon name="check" size={32} />
          <p>No notifications in this category.</p>
        </div>
      ) : (
        <div className="notifications-list-container">
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`notification-page-item ${
                item.is_read ? "read" : "unread"
              }`}
            >
              <div className="notif-page-icon">
                <span className={`notif-icon-circle type-${item.notification_type}`}>
                  {item.notification_type === "srs_due" && <Icon name="review" size={18} />}
                  {item.notification_type === "daily_checkin" && <Icon name="flame" size={18} />}
                  {item.notification_type === "streak_milestone" && <Icon name="flame" size={18} />}
                  {item.notification_type === "system" && <Icon name="bell" size={18} />}
                </span>
              </div>
              <div className="notif-page-body">
                <div className="notif-page-top">
                  <h3>{item.title}</h3>
                  <time>{formatDate(item.created_at)}</time>
                </div>
                <p>{item.message}</p>
                <div className="notif-page-actions">
                  {item.link_url && (
                    <Link
                      href={item.link_url}
                      className="button primary small"
                      onClick={() => {
                        if (!item.is_read) void handleMarkRead(item.id);
                      }}
                    >
                      Start Review
                    </Link>
                  )}
                  {!item.is_read && (
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => void handleMarkRead(item.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

}
