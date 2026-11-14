import { readFile } from "node:fs/promises";
import { join } from "node:path";
import swaggerUi from "swagger-ui-dist";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const types: Record<string,string> = { "swagger-ui.css": "text/css; charset=utf-8", "swagger-ui-bundle.js": "text/javascript; charset=utf-8" };
  if (!Object.hasOwn(types,file)) return new Response(null,{status:404});
  const content = await readFile(join(swaggerUi.getAbsoluteFSPath(),file));
  return new Response(content, { headers: { "Content-Type": types[file], "X-Content-Type-Options": "nosniff", "Cache-Control": "public,max-age=3600" } });
}
