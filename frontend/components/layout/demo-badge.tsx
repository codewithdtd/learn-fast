"use client";

import { useAuth } from "@/context/auth-context";

export function DemoBadge() {
  const { user, isLoading } = useAuth();
  if (isLoading || user?.is_superuser) return null;

  return (
    <div className="demo-showcase-badge" title="One public sample sheet. Full access requires an administrator account.">
      <span className="demo-badge-dot" />
      <span className="demo-badge-text">Public preview</span>
      <span className="demo-badge-text-compact">Demo</span>
    </div>
  );
}
