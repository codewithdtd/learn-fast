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
        <div className="auth-header-cta-group">
          <button
            onClick={() => {
              setAuthMode("login");
              setIsAuthModalOpen(true);
            }}
            className="auth-btn-signin"
            type="button"
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setAuthMode("register");
              setIsAuthModalOpen(true);
            }}
            className="auth-btn-signup"
            type="button"
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
    <div className="auth-user-dropdown-wrap" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="auth-user-avatar-btn"
        aria-label="User profile menu"
        type="button"
      >
        <div className="auth-user-initials">
          {initials}
        </div>
        <span className="auth-user-name">
          {user.username}
        </span>
        <svg
          className={`auth-chevron ${isMenuOpen ? "open" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="auth-user-popover-menu" role="menu">
          <div className="auth-user-popover-header">
            <div className="auth-popover-avatar">
              {initials}
            </div>
            <div className="auth-popover-info">
              <strong>{user.full_name || user.username}</strong>
              <small>{user.email}</small>
            </div>
          </div>

          <div className="auth-user-popover-actions">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="auth-popover-signout-btn"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

