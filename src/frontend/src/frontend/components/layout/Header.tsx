"use client";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useLanguage } from "../../providers/LanguageProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { LanguageSelect } from "../ui/LanguageSelect";
export function Header() {
  const { t } = useLanguage();
  const pathname = usePathname();
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label={t("Navegación principal")}>
        <div className="appearance-controls">
          <LanguageSelect />
          <ThemeToggle />
        </div>
        <Link
          className={pathname === "/" ? "active" : undefined}
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
        >
          {t("Inicio")}
        </Link>
        <Link
          className={pathname === "/acerca" ? "active" : undefined}
          href="/acerca"
          aria-current={pathname === "/acerca" ? "page" : undefined}
        >
          {t("Acerca del proyecto")}
        </Link>
        <Link
          className={pathname === "/recursos" ? "active" : undefined}
          href="/recursos"
          aria-current={pathname === "/recursos" ? "page" : undefined}
        >
          {t("Recursos")}
        </Link>
        <Link className="button header-login" href="/login">
          {t("Iniciar sesión")}
        </Link>
      </nav>
    </header>
  );
}
