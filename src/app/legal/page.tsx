import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
export default function Page() {
  return (
    <>
      <Header />
      <main className="interior">
        <h1>Información legal</h1>
        <h2 id="privacidad">Privacidad</h2>
        <p>
          Este prototipo de interfaz no recopila datos de salud ni almacena
          credenciales. Las políticas del servicio deberán definirse antes de su
          uso real.
        </p>
        <h2 id="terminos">Términos de uso</h2>
        <p>
          Demostración académica. No ofrece diagnóstico médico ni representa un
          servicio oficial de NASA.
        </p>
        <h2 id="accesibilidad">Accesibilidad</h2>
        <p>
          La interfaz incluye navegación por teclado, etiquetas de formulario y
          adaptación a pantallas móviles.
        </p>
      </main>
      <Footer />
    </>
  );
}
