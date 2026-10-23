"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";

export function WritingAdminGuard({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <main aria-busy="true"><p role="status">Loading public preview…</p></main>;
  }

  // AppShell's AccessGate renders a stateless guest AI preview for non-admins and mounts private history only for admins.
  return children;
}
