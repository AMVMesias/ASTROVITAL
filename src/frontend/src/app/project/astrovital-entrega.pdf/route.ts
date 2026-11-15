import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";
export const runtime = "nodejs";

export async function GET() {
  const pdf=await readFile(path.resolve(process.cwd(),"../../informe/Ficha_Entrega_ES_EN.pdf"));
  return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline; filename=Ficha_Entrega_ES_EN.pdf"}});
}
