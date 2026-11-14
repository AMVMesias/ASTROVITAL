"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
type Theme = "light" | "dark";
const key = "nasa-health.theme";
let memory: Theme | null = null;
function read(): Theme {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return (
    memory ??
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}
function subscribe(update: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", update);
  window.addEventListener("nasa-theme-change", update);
  media.addEventListener("change", update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener("nasa-theme-change", update);
    media.removeEventListener("change", update);
  };
}
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(
  null,
);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  useEffect(() => {
    // Read the preference here too so hydration never restores the server fallback.
    document.documentElement.dataset.theme = read();
  }, [theme]);
  function toggle() {
    memory = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = memory;
    try {
      localStorage.setItem(key, memory);
    } catch {}
    window.dispatchEvent(new Event("nasa-theme-change"));
  }
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider required");
  return value;
}
