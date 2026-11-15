"use client";
import { ThemeToggle } from "../../../frontend/components/ui/ThemeToggle";
import { useLanguage } from "../../../frontend/providers/LanguageProvider";
import { LanguageSelect } from "../../../frontend/components/ui/LanguageSelect";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "../../../frontend/features/auth/components/LoginForm";
import "./login.css";

export default function Login() {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <div className="auth-scene" aria-hidden="true">
        <Image
          className="auth-scene-photo"
          src="/images/astrovital-astronaut.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 900px) 100vw, 65vw"
        />
      </div>
      <svg
        className="auth-curve"
        viewBox="0 0 1671 941"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M982 0 C909 89 833 227 862 355 C930 583 870 774 662 941 H1671 V0 Z" />
      </svg>
      <section className="auth-intro" aria-label="AstroVital">
        <p className="auth-eyebrow">
          <span />
          ASTROVITAL
        </p>
        <h1>
          {t("Monitoreo de salud")}
          <br />
          {t("en misiones espaciales")}
        </h1>
        <p>
          {t("Plataforma para recopilar, analizar y dar seguimiento")}
          <br className="auth-desktop-break" />
          {t("a indicadores de salud de astronautas.")}
        </p>
      </section>
      <section className="auth-card-area" aria-labelledby="auth-title">
        <div className="auth-card-stack">
          <div className="appearance-controls">
            <LanguageSelect />
            <ThemeToggle />
          </div>
          <Link href="/" className="auth-home-link">
            <span aria-hidden="true">←</span>
            {t("Volver a la página de inicio")}
          </Link>
          <div className="auth-card">
            <Link
              href="/"
              className="auth-brand"
              aria-label={t("AstroVital, volver al inicio")}
            >
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
            </Link>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
