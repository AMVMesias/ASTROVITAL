import { readFile } from "node:fs/promises";
import path from "node:path";

// The report is generated from informe/Ficha_Proyecto_EN.tex at the repo root.
export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  const reportPath = path.resolve(process.cwd(), "../../informe/Ficha_Proyecto_EN.pdf");
  const pdf = await readFile(reportPath);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=Ficha_Proyecto_EN.pdf" },
  });
}

