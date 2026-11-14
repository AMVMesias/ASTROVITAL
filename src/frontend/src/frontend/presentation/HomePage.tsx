"use client";
import { useLanguage } from "../providers/LanguageProvider";
import Image from "next/image";
import Link from "next/link";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Icon } from "../components/ui/Icon";
export function HomePage() {
  const { t } = useLanguage();
  return (
    <div className="home">
      <Header />
      <main className="hero">
        <div className="hero-photo">
          <Image
            src="/images/earth-window.webp"
            alt={t(
              "La Tierra y su atmósfera azul vistas desde la ventana de una estación espacial",
            )}
            fill
            priority
            sizes="(max-width: 700px) 100vw, 65vw"
          />
        </div>
        <svg
          className="hero-surface"
          viewBox="0 0 1672 663"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 0H1005C915 155 885 278 850 404C820 518 790 608 752 663H0Z"
            fill="#f8faff"
          />
        </svg>
        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            {t("Monitoreo de salud en misiones espaciales")}
          </p>
          <h1>
            {t("Seguimiento y bienestar")}
            <br className="desktop-break" /> {t("de astronautas")}
          </h1>
          <p className="hero-description">
            {t("Plataforma para recopilar, analizar y dar seguimiento a")}
            <br className="desktop-break" />{" "}
            {t("indicadores de salud durante misiones espaciales.")}
          </p>
          <Link href="/login" className="button hero-login">
            {t("Iniciar sesión")}
            <Icon name="arrow" />
          </Link>

          <ul className="benefits">
            <li>
              <Icon name="heart" />
              <span>
                {t("Monitoreo")}
                <br />
                {t("de salud")}
              </span>
            </li>
            <li>
              <Icon name="chart" />
              <span>
                {t("Análisis")}
                <br />
                {t("de indicadores")}
              </span>
            </li>
            <li>
              <Icon name="shield" />
              <span>
                {t("Misiones")}
                <br />
                {t("más seguras")}
              </span>
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
