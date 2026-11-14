"use client";
import { useLanguage } from "../../providers/LanguageProvider";
import Link from "next/link";
import { Brand } from "./Brand";
import { LanguageSelect } from "../ui/LanguageSelect";
export function Header() {
  const { t } = useLanguage();
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label={t("Navegación principal")}>
        <Link className="active" href="/" aria-current="page">
          {t("Inicio")}
        </Link>
        <Link href="/acerca">{t("Acerca del proyecto")}</Link>
        <Link href="/recursos">{t("Recursos")}</Link>
        <Link className="button header-login" href="/login">
          {t("Iniciar sesión")}
        </Link>
        <LanguageSelect />
      </nav>
    </header>
  );
}
