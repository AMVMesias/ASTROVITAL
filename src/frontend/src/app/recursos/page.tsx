"use client";
import { useLanguage } from "../../frontend/providers/LanguageProvider";
import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
export default function Page() {
  const { t } = useLanguage();
  return (
    <div className="public-page">
      <Header />
      <main className="interior">
        <h1>{t("Recursos")}</h1>
        <h2>{t("Documentación")}</h2>
        <p>
          {t(
            "La documentación técnica se encuentra en el repositorio del proyecto.",
          )}
        </p>
        <h2 id="publicaciones">{t("Publicaciones")}</h2>
        <p>{t("Sección preparada para futuras publicaciones del proyecto.")}</p>
        <h2 id="ayuda">{t("Centro de ayuda")}</h2>
        <p>
          {t(
            "El acceso al panel y los servicios de monitoreo estarán disponibles al conectar el backend.",
          )}
        </p>
      </main>
      <Footer />
    </div>
  );
}
