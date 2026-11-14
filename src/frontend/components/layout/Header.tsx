import Link from "next/link";
import { Brand } from "./Brand";
export function Header() {
  return (
    <header className="site-header">
      <Brand />
      <nav aria-label="Navegación principal">
        <Link className="active" href="/" aria-current="page">
          Inicio
        </Link>
        <Link href="/acerca">Acerca del proyecto</Link>
        <Link href="/recursos">Recursos</Link>
        <Link className="button header-login" href="/login">
          Iniciar sesión
        </Link>
      </nav>
    </header>
  );
}
