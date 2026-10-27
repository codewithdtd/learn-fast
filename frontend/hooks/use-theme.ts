"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, isTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();
let fallbackTheme: Theme = DEFAULT_THEME;

function emitThemeChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    const nextTheme = isTheme(event.newValue) ? event.newValue : DEFAULT_THEME;
    fallbackTheme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    emitThemeChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getThemeSnapshot(): Theme {
  const theme = document.documentElement.dataset.theme;
  if (isTheme(theme)) {
    fallbackTheme = theme;
    return theme;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) {
      fallbackTheme = stored;
      return stored;
    }
  } catch {
    // The in-memory fallback keeps theme selection usable when browser storage is disabled.
  }
  return fallbackTheme;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme) {
  fallbackTheme = theme;
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme remains applied in this tab when browser storage is disabled.
  }
  emitThemeChange();
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);
}
