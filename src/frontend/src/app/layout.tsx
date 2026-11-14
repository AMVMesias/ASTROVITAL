import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "../frontend/providers/LanguageProvider";

export const metadata: Metadata = {
  title: "NASA Health | Bienestar en el espacio",
  description:
    "Plataforma de monitoreo y bienestar de astronautas en misiones espaciales. Prototipo académico.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
