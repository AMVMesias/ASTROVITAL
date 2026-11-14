"use client";

import { useLanguage } from "../../providers/LanguageProvider";
import { isLocale, locales } from "../../lib/i18n";

export function LanguageSelect() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <label className="language-select" title={t("Idioma")}>
      <span className="sr-only">{t("Idioma")}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0" />
      </svg>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        {locales.map(({ value, label }) => (
          <option key={value} value={value} lang={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
