/**
 * Moteur de simulation de circuits : ngspice 45 compilé en WebAssembly (paquet eecircuit-engine, licence MIT ;
 * ngspice : licence BSD). Chaque simulation s'exécute dans un PROCESSUS ENFANT isolé (workers/spice-worker.mjs),
 * tué au-delà du délai maximal. Un échec du solveur est rapporté comme tel : aucun résultat partiel n'est
 * présenté comme complet.
 */
import crypto from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";

export const ENGINE_PACKAGE = "eecircuit-engine 1.9.0";

export interface Trace { name: string; type: string; values: number[]; imag?: number[] }
export interface SpiceOutcome { ok: boolean; traces: Trace[]; points: number; errors: string[]; engine: string; durationMs: number; inputHash: string; complex: boolean }

type RawResult = { numVariables: number; variableNames: string[]; numPoints: number; dataType: "real" | "complex"; data: { name: string; type: string; values: (number | { real: number; img: number })[] }[] };

export const hashNetlist = (n: string) => crypto.createHash("sha256").update(n).digest("hex");

function runWorker(netlist: string, timeoutMs: number): Promise<{ ok: boolean; version?: string; result?: RawResult; errors: string[] }> {
  return new Promise((resolve) => {
    const file = path.join(/* turbopackIgnore: true */ process.cwd(), "workers", "spice-worker.mjs");
    const child = spawn(process.execPath, [file], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: process.env.PATH ?? "", NODE_ENV: "production" } as NodeJS.ProcessEnv });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve({ ok: false, errors: [`Délai de simulation dépassé (${timeoutMs / 1000} s) : processus arrêté`] }); }, timeoutMs);
    child.stdout.on("data", (c) => { out += c; if (out.length > 50_000_000) child.kill("SIGKILL"); });
    child.stderr.on("data", (c) => { err += c; });
    child.on("close", () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out)); } catch { resolve({ ok: false, errors: [`Le moteur n'a pas renvoyé de résultat${err ? ` : ${err.slice(0, 500)}` : ""}`] }); }
    });
    child.stdin.end(JSON.stringify({ netlist }));
  });
}

export async function runSpice(netlist: string, timeoutMs = 20000): Promise<SpiceOutcome> {
  const t0 = Date.now();
  const w = await runWorker(netlist, timeoutMs);
  const errors = (w.errors ?? []).map((e) => e.trim()).filter(Boolean);
  const r = w.result;
  const fatal = !w.ok || !r || errors.some((e) => /fatal|aborted|error/i.test(e)) || r.numVariables === 0;
  const traces: Trace[] = fatal || !r ? [] : r.dataType === "complex"
    ? r.data.map((d) => ({ name: d.name, type: d.type, values: d.values.map((c) => (c as { real: number }).real), imag: d.values.map((c) => (c as { img: number }).img) }))
    : r.data.map((d) => ({ name: d.name, type: d.type, values: d.values as number[] }));
  return { ok: !fatal, traces, points: fatal || !r ? 0 : r.numPoints, errors, engine: `${w.version ?? "ngspice"} (${ENGINE_PACKAGE})`, durationMs: Date.now() - t0, inputHash: hashNetlist(netlist), complex: r?.dataType === "complex" };
}
