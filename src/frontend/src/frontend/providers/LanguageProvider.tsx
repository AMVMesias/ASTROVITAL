"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isLocale, messages, type Locale, type MessageKey } from "../lib/i18n";

const STORAGE_KEY = "nasa-health.language";
const CHANGE_EVENT = "nasa-language-change";
let memoryLocale: Locale = "es";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
function getLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLocale(saved) ? saved : memoryLocale;
  } catch {
    return memoryLocale;
  }
}
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Spanish on the server; React restores the saved preference after hydration.
  const locale = useSyncExternalStore(
    subscribe,
    getLocale,
    () => "es" as Locale,
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  function setLocale(next: Locale) {
    memoryLocale = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Switching still works without storage. */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return (
    <LanguageContext.Provider
      value={{ locale, setLocale, t: (key) => messages[locale][key] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage requires LanguageProvider");
  return context;
}
