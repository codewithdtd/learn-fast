"use client";

import { useState } from "react";

type Theme = "light" | "dark";

function getPreferredTheme(): Theme {
  const storedTheme = window.localStorage.getItem("learn-fast-theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(() => typeof window === "undefined" ? "light" : getPreferredTheme());

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("learn-fast-theme", nextTheme);
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " compact" : ""}`}
      suppressHydrationWarning
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-icon theme-toggle-sun" aria-hidden="true" />
      <span className="theme-toggle-icon theme-toggle-moon" aria-hidden="true" />
      <span className="theme-toggle-label">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
