"use client";

import React, { useEffect, useState } from "react";
import { getSystemHealth } from "@/services/api";

export function DemoBadge() {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  useEffect(() => {
    getSystemHealth()
      .then((res) => {
        if (res.demo_mode) {
          setIsDemoMode(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!isDemoMode) return null;

  return (
    <div className="demo-showcase-badge" title="Demo Mode is active: DB mutations are protected for portfolio showcase.">
      <span className="demo-badge-dot" />
      <span className="demo-badge-text">Demo Showcase (Read-Only)</span>
    </div>
  );
}
