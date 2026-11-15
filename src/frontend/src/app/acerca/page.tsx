import type { Metadata } from "next";
import { AboutProject } from "./AboutProject";

export const metadata: Metadata = {
  title: "Acerca del proyecto | AstroVital",
  description: "Conoce la misión, los objetivos y el trabajo detrás de AstroVital: sensores, seguimiento y contexto espacial para la tripulación.",
};

export default function Page() {
  return <AboutProject />;
}
