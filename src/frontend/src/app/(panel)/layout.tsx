import { ThemeToggle } from "../../frontend/components/ui/ThemeToggle";
import Link from "next/link";
import type { ReactNode } from "react";
export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="panel-nav" aria-label="Panel">
        <Link href="/">NASA Health</Link>
        <ThemeToggle />
        {["dashboard", "usuarios", "reportes", "configuracion"].map((route) => (
          <Link href={`/${route}`} key={route}>
            {route}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
