"use client";
import { useLanguage } from "../../frontend/providers/LanguageProvider";
import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
export default function Page() {
  const { t } = useLanguage();
  return (
    <>
      <Header />
      <main className="interior">
        <h1>{t("Acerca del proyecto")}</h1>
        <p>
          {t(
            "NASA Health es un prototipo académico para recopilar, analizar y dar seguimiento a indicadores de salud de astronautas durante misiones espaciales.",
          )}
        </p>
        <h2 id="objetivos">{t("Objetivos")}</h2>
        <p>
          {t(
            "Facilitar el monitoreo de salud, el análisis de indicadores y el seguimiento del bienestar en misiones espaciales.",
          )}
        </p>
        <h2 id="equipo">{t("Equipo")}</h2>
        <p>{t("Proyecto desarrollado para NASA Space Apps Challenge 2026.")}</p>
      </main>
      <Footer />
    </>
  );
}
