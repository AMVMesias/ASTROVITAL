"use client";

import { useLanguage } from "../../providers/LanguageProvider";
import { isLocale, locales } from "../../lib/i18n";

export function LanguageSelect() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <label className="language-select">
      <span className="sr-only">{t("Idioma")}</span>
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
