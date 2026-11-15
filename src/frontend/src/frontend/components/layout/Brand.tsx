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
      aria-label={t("AstroVital, inicio")}
    >
      <span className="brand-mark">
        <Image
          className="brand-logo-standard"
          src="/images/astrovital_logo.svg"
          alt=""
          width={1100}
          height={280}
          priority
        />
        <Image
          className="brand-logo-inverse"
          src="/images/astrovital_logo_claro.svg"
          alt=""
          width={1100}
          height={280}
          priority
        />
      </span>
      {footer && (
        <small>
          {t("Monitoreo y bienestar de astronautas")}
          <br />
          {t("en misiones espaciales.")}
        </small>
      )}
    </Link>
  );
}
