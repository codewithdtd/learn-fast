"use client";

import { useEffect, useState } from "react";

import { getHealth } from "@/services/api";

type ConnectionState = "checking" | "connected" | "error";

export function HealthStatus() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("checking");

  useEffect(() => {
    let isMounted = true;

    // Run this request in the browser so Day 1 verifies the real CORS path
    // between localhost:3000 and localhost:8000, not only server-to-server IO.
    getHealth()
      .then(() => {
        if (isMounted) {
          setConnectionState("connected");
        }
      })
      .catch(() => {
        if (isMounted) {
          setConnectionState("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (connectionState === "checking") {
    return <p className="mt-8 text-sm text-slate-500">Checking API…</p>;
  }

  if (connectionState === "connected") {
    return (
      <p className="mt-8 rounded-lg bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
        API connected
      </p>
    );
  }

  return (
    <p className="mt-8 rounded-lg bg-rose-50 px-4 py-3 text-rose-800">
      API connection failed. Start the FastAPI server and reload this page.
    </p>
  );
}
