"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { setTheme, useTheme } from "@/hooks/use-theme";
import { THEME_OPTIONS, type Theme } from "@/lib/theme";
import { getJourneySoundsEnabled, getJourneySoundsServerSnapshot, setJourneySoundsEnabled, subscribeToJourneySoundPreference } from "@/lib/journey-sounds";
import styles from "./theme-toggle.module.css";

const swatches: Record<Theme, string> = {
  light: "linear-gradient(135deg, #eaf2f7 50%, #ffffff 50%)",
  dark: "linear-gradient(135deg, #111827 50%, #334155 50%)",
  retro: "linear-gradient(135deg, #805a37 50%, #ddbf8e 50%)",
  playful: "linear-gradient(135deg, #0284c7 50%, #c7d2fe 50%)",
  journey: "linear-gradient(135deg, #2457bc 50%, #f4f8fe 50%)",
  island: "linear-gradient(135deg, #2e5a36 50%, #f5efe6 50%)",
};

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const activeTheme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const soundsEnabled = useSyncExternalStore(
    subscribeToJourneySoundPreference,
    getJourneySoundsEnabled,
    getJourneySoundsServerSnapshot,
  );
  const instanceId = useId().replace(/:/g, "");
  const menuId = "theme-menu-" + instanceId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const soundOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    menuItemRefs.current[THEME_OPTIONS.findIndex((option) => option.id === activeTheme)]?.focus();
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeTheme, isOpen]);

  function focusChoice(index: number) {
    const nextIndex = (index + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    menuItemRefs.current[nextIndex]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      if (activeTheme === "journey" && index === THEME_OPTIONS.length - 1) soundOptionRef.current?.focus();
      else focusChoice(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (activeTheme === "journey" && index === 0) soundOptionRef.current?.focus();
      else focusChoice(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusChoice(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusChoice(THEME_OPTIONS.length - 1);
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  function handleSoundOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusChoice(THEME_OPTIONS.length - 1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      focusChoice(0);
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  function toggleSounds() {
    const nextEnabled = !soundsEnabled;
    setJourneySoundsEnabled(nextEnabled);
  }

  function chooseTheme(theme: Theme) {
    setTheme(theme);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={styles.root} data-compact={compact || undefined} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger + (compact ? " " + styles.compact : "")}
        aria-label={"Choose theme. Current theme: " + (THEME_OPTIONS.find((option) => option.id === activeTheme)?.label ?? "Playful EdTech")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        title="Choose theme"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className={styles.triggerIcon} aria-hidden="true"><ThemeIcon theme={activeTheme} /></span>
        {!compact && <span className={styles.triggerLabel}>{THEME_OPTIONS.find((option) => option.id === activeTheme)?.label}</span>}
      </button>
      {isOpen && (
        <div id={menuId} className={styles.menu} role="menu" aria-label="Choose a theme">
          <p className={styles.menuLabel} role="presentation">Appearance</p>
          {THEME_OPTIONS.map((option, index) => (
            <button
              key={option.id}
              ref={(element) => { menuItemRefs.current[index] = element; }}
              type="button"
              role="menuitemradio"
              aria-checked={activeTheme === option.id}
              tabIndex={activeTheme === option.id ? 0 : -1}
              className={styles.themeChoice}
              style={{ "--swatch": swatches[option.id] } as CSSProperties}
              onKeyDown={(event) => handleMenuKeyDown(event, index)}
              onClick={() => chooseTheme(option.id)}
            >
              <span className={styles.choiceSwatch} aria-hidden="true" />
              <span className={styles.choiceText}><strong>{option.label}</strong><small>{option.description}</small></span>
              <span className={styles.choiceCheck} aria-hidden="true">{activeTheme === option.id ? "✓" : ""}</span>
            </button>
          ))}
          {activeTheme === "journey" && (
            <button
              ref={soundOptionRef}
              type="button"
              role="menuitemcheckbox"
              aria-checked={soundsEnabled}
              className={styles.soundPreference}
              onKeyDown={handleSoundOptionKeyDown}
              onClick={toggleSounds}
            >
              <span className={styles.soundPreferenceText}><strong>Completion sound</strong><small>Plays when practice is complete</small></span>
              <span className={styles.soundSwitch} aria-hidden="true"><span data-on={soundsEnabled || undefined} /></span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg>;
  if (theme === "retro") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21V11m0 4c-4 0-6-2-6-6 4 0 6 2 6 6Zm0-3c0-4 2-6 6-6 0 4-2 6-6 6Z" /></svg>;
  if (theme === "playful") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 2 2.8 6.2 6.8.8-5 4.6 1.3 6.6-5.9-3.2-5.9 3.2 1.3-6.6-5-4.6 6.8-.8L12 2Z" /></svg>;
  if (theme === "journey") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V6l8-3 8 3v13l-8 3-8-3Z" /><path d="m4 6 8 3 8-3M12 9v13" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
