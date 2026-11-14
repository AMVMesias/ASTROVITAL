"use client";
import { useLanguage } from "../../providers/LanguageProvider";
import Link from "next/link";
import Image from "next/image";
export function Brand({ footer = false }: { footer?: boolean }) {
  const { t } = useLanguage();
  return (
    <Link
      href="/"
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label={t("NASA Health, inicio")}
    >
      <Image
        src="/images/nasa-logo.svg"
        alt="NASA"
        width={80}
        height={68}
        priority
      />
      <span>
        NASA Health
        {footer && (
          <small>
            {t("Monitoreo y bienestar de astronautas")}
            <br />
            {t("en misiones espaciales.")}
          </small>
        )}
      </span>
    </Link>
  );
}
