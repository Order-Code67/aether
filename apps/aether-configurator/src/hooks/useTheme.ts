import { useEffect } from "react";
import { useUiStore } from "@/stores/uiStore";

export function useTheme() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = theme === "dark" || (theme === "system" && preferDark);
    root.classList.toggle("dark", dark);
    root.dataset.theme = dark ? "dark" : "light";
  }, [theme]);
}
