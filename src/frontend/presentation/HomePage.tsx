import Image from "next/image";
import Link from "next/link";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Icon } from "../components/ui/Icon";
export function HomePage() {
  return (
    <div className="home">
      <Header />
      <main className="hero">
        <div className="hero-photo">
          <Image
            src="/images/earth-window.webp"
            alt="La Tierra y su atmósfera azul vistas desde la ventana de una estación espacial"
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
            Monitoreo de salud en misiones espaciales
          </p>
          <h1>
            Seguimiento y bienestar
            <br className="desktop-break" /> de astronautas
          </h1>
          <p className="hero-description">
            Plataforma para recopilar, analizar y dar seguimiento a
            <br className="desktop-break" /> indicadores de salud durante
            misiones espaciales.
          </p>
          <Link href="/login" className="button hero-login">
            Iniciar sesión <Icon name="arrow" />
          </Link>
          <ul className="benefits">
            <li>
              <Icon name="heart" />
              <span>
                Monitoreo
                <br />
                de salud
              </span>
            </li>
            <li>
              <Icon name="chart" />
              <span>
                Análisis
                <br />
                de indicadores
              </span>
            </li>
            <li>
              <Icon name="shield" />
              <span>
                Misiones
                <br />
                más seguras
              </span>
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
