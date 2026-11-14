import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { loadLocalEnvironment } from "./loadLocalEnvironment";
loadLocalEnvironment();
const venv=process.platform==="win32"?"tools/bridge/.venv/Scripts/python.exe":"tools/bridge/.venv/bin/python";
const child=spawn(process.env.BRIDGE_PYTHON||(existsSync(venv)?venv:"python3"),["tools/bridge/bridge.py",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
for(const signal of ["SIGINT","SIGTERM"] as const) process.on(signal,()=>child.kill(signal));
child.on("error",()=>{console.error("No se pudo iniciar Python. Revisa BRIDGE_PYTHON y tools/bridge/requirements.txt.");process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code??1;});
