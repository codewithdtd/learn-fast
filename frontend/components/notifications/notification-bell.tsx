"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/services/api";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifs() {
    try {
      const data = await getNotifications(false, 10);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Bỏ qua lỗi ngầm để không gián đoạn giao diện
    }
  }

  useEffect(() => {
    void fetchNotifs();
    // Tự động kiểm tra thông báo mỗi 60 giây
    const timer = setInterval(() => {
      void fetchNotifs();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Xử lý đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

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
      setIsLoading(true);
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell-button ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover" role="dialog" aria-label="Notifications Center">
          <div className="notification-popover-header">
            <div className="popover-title-group">
              <h3>Notifications</h3>
              {unreadCount > 0 && <span className="badge-count">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn-link-action"
                onClick={() => void handleMarkAllRead()}
                disabled={isLoading}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-popover-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Icon name="check" size={28} />
                <p>You have no new notifications!</p>
              </div>
            ) : (
              notifications.map((item) => (
                <article
                  key={item.id}
                  className={`notification-item ${item.is_read ? "read" : "unread"}`}
                  onClick={() => {
                    if (!item.is_read) void handleMarkRead(item.id);
                  }}
                >
                  <div className="notif-indicator">
                    <span
                      className={`notif-icon-circle type-${item.notification_type}`}
                    >
                      {item.notification_type === "srs_due" && <Icon name="review" size={16} />}
                      {item.notification_type === "daily_checkin" && <Icon name="flame" size={16} />}
                      {item.notification_type === "streak_milestone" && <Icon name="flame" size={16} />}
                      {item.notification_type === "system" && <Icon name="bell" size={16} />}
                    </span>
                  </div>
                  <div className="notif-content">
                    <div className="notif-heading-row">
                      <h4>{item.title}</h4>
                      <time className="notif-time">{formatDate(item.created_at)}</time>
                    </div>
                    <p>{item.message}</p>
                    {item.link_url && (
                      <div className="notif-actions">
                        <Link
                          href={item.link_url}
                          className="notif-action-link"
                          onClick={() => {
                            if (!item.is_read) void handleMarkRead(item.id);
                            setIsOpen(false);
                          }}
                        >
                          Review now <Icon name="arrow" size={14} />
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="notification-popover-footer">
            <Link
              href="/notifications"
              className="view-all-link"
              onClick={() => setIsOpen(false)}
            >
              View all notifications <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );

}
