import { Header } from "../../frontend/components/layout/Header";
import { Footer } from "../../frontend/components/layout/Footer";
export default function Page() {
  return (
    <>
      <Header />
      <main className="interior">
        <h1>Recursos</h1>
        <h2>Documentación</h2>
        <p>
          La documentación técnica se encuentra en el repositorio del proyecto.
        </p>
        <h2 id="publicaciones">Publicaciones</h2>
        <p>Sección preparada para futuras publicaciones del proyecto.</p>
        <h2 id="ayuda">Centro de ayuda</h2>
        <p>
          El acceso al panel y los servicios de monitoreo estarán disponibles al
          conectar el backend.
        </p>
      </main>
      <Footer />
    </>
  );
}
