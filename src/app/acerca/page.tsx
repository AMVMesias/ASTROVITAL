import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
export default function Page() {
  return (
    <>
      <Header />
      <main className="interior">
        <h1>Acerca del proyecto</h1>
        <p>
          NASA Health es un prototipo académico para recopilar, analizar y dar
          seguimiento a indicadores de salud de astronautas durante misiones
          espaciales.
        </p>
        <h2 id="objetivos">Objetivos</h2>
        <p>
          Facilitar el monitoreo de salud, el análisis de indicadores y el
          seguimiento del bienestar en misiones espaciales.
        </p>
        <h2 id="equipo">Equipo</h2>
        <p>Proyecto desarrollado para NASA Space Apps Challenge 2026.</p>
      </main>
      <Footer />
    </>
  );
}
