import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
/** Los comandos se ejecutan desde la raíz. Variables de proceso tienen prioridad. */
export function loadLocalEnvironment() {
  const root=process.cwd();
  const backend=resolve(root,"src/backend");
  loadEnvConfig(existsSync(resolve(backend,".env.local"))?backend:root);
}
