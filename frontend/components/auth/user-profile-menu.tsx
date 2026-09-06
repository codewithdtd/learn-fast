"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";

export function UserProfileMenu() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAuthMode("login");
              setIsAuthModalOpen(true);
            }}
            className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode("register");
              setIsAuthModalOpen(true);
            }}
            className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            Sign Up
          </button>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
        />
      </>
    );
  }

  const initials = (user.full_name || user.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 p-1 pr-3 transition-all hover:border-primary/40 hover:bg-muted/60"
        aria-label="User profile menu"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground shadow-sm">
          {initials}
        </div>
        <span className="max-w-[100px] truncate text-xs font-medium text-foreground">
          {user.username}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            isMenuOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-border bg-card p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="truncate text-xs font-semibold text-foreground">
              {user.full_name || user.username}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
