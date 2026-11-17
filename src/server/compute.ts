/**
 * Moteur de calcul scientifique (Python : pvlib, CoolProp) exécuté en processus isolé (workers/compute.py).
 * Interpréteur : XX_PYTHON (par défaut « python3 »), avec les paquets de workers/requirements.txt.
 * Indisponible → erreur explicite (jamais de résultat approché à la place).
 */
import path from "node:path";
import { spawn } from "node:child_process";
import { ApiFailure } from "./api";

export const FLUIDS = ["R134a", "R404A", "R410A", "R407C", "R32", "R290", "R600a", "R1234yf", "R717", "R744"] as const;

export function pythonBin() { return process.env.XX_PYTHON || "python3"; }

export function runCompute<T>(op: string, input: unknown, timeoutMs = 120_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), "workers", "compute.py");
    const child = spawn(/* turbopackIgnore: true */ pythonBin(), ["-I", file], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "/tmp", NODE_ENV: "production" } as NodeJS.ProcessEnv });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new ApiFailure(504, `Délai de calcul dépassé (${timeoutMs / 1000} s)`, "compute.timeout")); }, timeoutMs);
    child.on("error", (e) => { clearTimeout(timer); reject(new ApiFailure(503, `Moteur de calcul Python indisponible (${pythonBin()} : ${e.message}). Installer Python 3 et « pip install -r workers/requirements.txt ».`, "compute.unavailable")); });
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { err += c; });
    child.on("close", () => {
      clearTimeout(timer);
      let r: { ok: boolean; result?: T; error?: string };
      try { r = JSON.parse(out); } catch { return reject(new ApiFailure(503, `Moteur de calcul Python indisponible : ${err.slice(-400) || "sortie illisible"}`, "compute.unavailable")); }
      if (!r.ok) return reject(new ApiFailure(422, `Calcul refusé par le moteur : ${r.error}`, "compute.failed"));
      resolve(r.result as T);
    });
    child.stdin.end(JSON.stringify({ op, input }));
  });
}
