import "./globals.css";
import "./theme.css";
import { ThemeProvider } from "../frontend/providers/ThemeProvider";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "../frontend/providers/LanguageProvider";

export const metadata: Metadata = {
  title: "AstroVital | Bienestar en el espacio",
  description:
    "Plataforma de monitoreo y bienestar de astronautas en misiones espaciales. Prototipo académico.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("nasa-health.theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){document.documentElement.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}})()`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
