"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { StartupWarmupCountdown } from "@/components/shared/startup-warmup-countdown";

export function AccessGate({ children }: { children: ReactNode }) {
  const { isLoading, refreshUser } = useAuth();
  const [showWarmup, setShowWarmup] = useState(false);

  // Đặt ngưỡng trễ 900ms: Nếu máy chủ đang chạy (local/Render đã thức) thì phản hồi ngay
  // không làm nhấp nháy màn hình đếm ngược. Chỉ kích hoạt khi tải kéo dài (Cold Start).
  useEffect(() => {
    if (!isLoading) {
      setShowWarmup(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowWarmup(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Đang kiểm tra token / xác thực
  if (isLoading) {
    if (showWarmup) {
      return (
        <main className="dashboard-page">
          <StartupWarmupCountdown
            context="auth"
            onReady={() => {
              void refreshUser();
            }}
          />
        </main>
      );
    }
    return (
      <main className="dashboard-page" aria-busy="true">
        <div className="dashboard-skeleton" aria-label="Loading application">
          <span />
          <span />
        </div>
      </main>
    );
  }

  return children;
}

export function AdminNotifications() {
  const { user, isLoading } = useAuth();
  return !isLoading && user?.is_superuser ? <NotificationBell key={user.id} /> : null;
}
