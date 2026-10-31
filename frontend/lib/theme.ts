export const THEMES = ["light", "dark", "retro", "playful", "journey", "island"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "playful";
export const THEME_STORAGE_KEY = "learn-fast-theme";

export const THEME_OPTIONS: ReadonlyArray<{ id: Theme; label: string; description: string }> = [
  { id: "light", label: "Light", description: "Clean and calm" },
  { id: "dark", label: "Dark", description: "Low light" },
  { id: "retro", label: "Retro Farm", description: "Warm vintage" },
  { id: "playful", label: "Playful EdTech", description: "Bright and friendly" },
  { id: "journey", label: "Learning Journey", description: "Colorful learning" },
  { id: "island", label: "Cozy Island", description: "Warm cottagecore sanctuary" },
];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.some((theme) => theme === value);
}

// The inline initializer shares this allowlist with the selector so a stored theme survives reloads.
export const THEME_INIT_SCRIPT = [
  "(() => {",
  "  const key = " + JSON.stringify(THEME_STORAGE_KEY) + ";",
  "  const themes = " + JSON.stringify(THEMES) + ";",
  "  try {",
  "    const stored = window.localStorage.getItem(key);",
  "    document.documentElement.dataset.theme = themes.includes(stored) ? stored : " + JSON.stringify(DEFAULT_THEME) + ";",
  "  } catch {",
  "    document.documentElement.dataset.theme = " + JSON.stringify(DEFAULT_THEME) + ";",
  "  }",
  "})();",
].join("\n");
