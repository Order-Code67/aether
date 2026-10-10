export type ThemeId = "dark" | "light";

const THEME_ATTR = "data-theme";

/** Apply theme to <html> so CSS variables and Tailwind colors update. */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTR, theme);
}

export function readStoredTheme(): ThemeId {
  try {
    const raw = localStorage.getItem("aether-settings");
    if (!raw) return "dark";
    const parsed = JSON.parse(raw) as { state?: { theme?: string } };
    return parsed.state?.theme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
