"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function AccessGate({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();
  // Wait for auth hydration before mounting routes that can send write requests.
  if (isLoading) return <main aria-busy="true"><p role="status">Loading public preview…</p></main>;
  return children;
}

export function AdminNotifications() {
  const { user, isLoading } = useAuth();
  return !isLoading && user?.is_superuser ? <NotificationBell key={user.id} /> : null;
}
