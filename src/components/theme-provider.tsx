"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const key = "team-tracker-theme";
const valid = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system";
const ThemeContext = createContext<{ theme: Theme; ready: boolean; setTheme: (theme: Theme) => void }>({ theme: "system", ready: false, setTheme: () => {} });
function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function savedTheme(): Theme {
  try { const value = localStorage.getItem(key); return valid(value) ? value : "system"; } catch { return "system"; }
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>("system");
  const [ready, setReady] = useState(false);
  const currentTheme = useRef<Theme>("system");
  useEffect(() => {
    const value = savedTheme(); currentTheme.current = value; updateTheme(value); apply(value); setReady(true);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function systemChanged() { if (currentTheme.current === "system") apply("system"); }
    function storageChanged(event: StorageEvent) {
      if (event.key !== key && event.key !== null) return;
      const value = savedTheme(); currentTheme.current = value; updateTheme(value); apply(value);
    }
    media.addEventListener("change", systemChanged); window.addEventListener("storage", storageChanged);
    return () => { media.removeEventListener("change", systemChanged); window.removeEventListener("storage", storageChanged); };
  }, []);
  function setTheme(value: Theme) {
    currentTheme.current = value; updateTheme(value); apply(value);
    try { localStorage.setItem(key, value); } catch { /* The choice still applies for this page if storage is unavailable. */ }
  }
  return <ThemeContext.Provider value={{ theme, ready, setTheme }}>{children}</ThemeContext.Provider>;
}
export function ThemeControl() {
  const { theme, ready, setTheme } = useContext(ThemeContext);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return <div className="theme-control"><Icon size={16} aria-hidden="true" /><select aria-label="Color theme" disabled={!ready} value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>;
}
