"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "retro";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedTheme = window.localStorage.getItem("learn-fast-theme");
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "retro") {
      setTheme(storedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  function toggleTheme() {
    let nextTheme: Theme;
    if (theme === "light") {
      nextTheme = "dark";
    } else if (theme === "dark") {
      nextTheme = "retro";
    } else {
      nextTheme = "light";
    }

    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("learn-fast-theme", nextTheme);
    setTheme(nextTheme);
  }

  // Khi chưa mount thì render placeholder ổn định để chống hydration error
  const activeTheme = mounted ? theme : "light";

  const themeLabels: Record<Theme, string> = {
    light: "Light mode",
    dark: "Dark mode",
    retro: "Retro Farm",
  };

  const nextLabels: Record<Theme, string> = {
    light: "Switch to dark mode",
    dark: "Switch to retro farm mode",
    retro: "Switch to light mode",
  };

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " compact" : ""}`}
      suppressHydrationWarning
      aria-label={nextLabels[activeTheme]}
      title={themeLabels[activeTheme]}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {activeTheme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : activeTheme === "retro" ? (
          /* Biểu tượng mầm cây / nông trại HayDay hoài cổ */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 20h10" />
            <path d="M12 20v-8" />
            <path d="M12 12c0-3.5 3-6.5 7-6.5 0 4-3 7-7 7z" />
            <path d="M12 15c0-2.5-2.5-4.5-5.5-4.5 0 3 2.5 5 5.5 5z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
      {!compact && (
        <span className="theme-toggle-label">{themeLabels[activeTheme]}</span>
      )}
    </button>
  );
}
