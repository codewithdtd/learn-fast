"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/layout/app-shell";
import { formatDate } from "@/lib/format";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/services/api";

const subscribeToNothing = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function subscribeToViewport(listener: () => void) {
  window.addEventListener("resize", listener);
  return () => window.removeEventListener("resize", listener);
}

function getIsMobileSnapshot() {
  return window.innerWidth < 768;
}

function getServerIsMobileSnapshot() {
  return false;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMountedSnapshot, getServerMountedSnapshot);
  const isMobile = useSyncExternalStore(subscribeToViewport, getIsMobileSnapshot, getServerIsMobileSnapshot);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      getNotifications(false, 10)
        .then((data) => {
          if (!active) return;
          setNotifications(data.items);
          setUnreadCount(data.unread_count);
        })
        .catch(() => undefined);
    };
    const initialTimer = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  // Xử lý đóng dropdown khi click ra ngoài (chế độ Desktop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isMobile && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen && !isMobile) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobile]);

  // Hỗ trợ đóng dropdown bằng phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  // Nội dung popover dùng chung cho cả Mobile và Desktop
  const popoverContent = (
    <div
      className={`notification-popover ${isMobile ? "notification-mobile-sheet" : ""}`}
      role="dialog"
      aria-label="Notifications Center"
    >
      <div className="notification-popover-header">
        <div className="popover-title-group">
          <h3>Notifications</h3>
          {unreadCount > 0 && <span className="badge-count">{unreadCount} new</span>}
        </div>
        <div className="flex items-center gap-2">
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
          {isMobile && (
            <button
              type="button"
              className="notification-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
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
  );

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

      {/* Trên Mobile: Dùng Portal để thoát khỏi containing-block của mobile-header (do backdrop-filter) */}
      {isOpen && isMobile && mounted && createPortal(
        <div className="notification-mobile-overlay">
          <div
            className="notification-mobile-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          {popoverContent}
        </div>,
        document.body
      )}

      {/* Trên Desktop: Render trực tiếp bên trong bell container */}
      {isOpen && !isMobile && popoverContent}
    </div>
  );

}
