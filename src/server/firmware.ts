/**
 * Compilation de programmes Arduino Uno (ATmega328P) côté serveur avec la chaîne libre avr-gcc et le cœur Arduino
 * AVR (paquets Debian/Ubuntu « gcc-avr », « avr-libc », « arduino-core-avr », installés dans l'image Docker).
 * Le programme n'est JAMAIS exécuté sur le serveur : seul le fichier .hex est produit, puis simulé dans le navigateur
 * (émulateur libre avr8js) ou téléversé par l'utilisateur sur sa carte. Processus isolé, sans shell, durée limitée.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CORE_DIR = process.env.XX_ARDUINO_CORE ?? "/usr/share/arduino/hardware/arduino/avr";
// DECIMAL_DIG : avr-gcc 5 (Debian bookworm) ne le définit pas en C++11 alors que le cœur Arduino l'utilise (WString.cpp) ;
// on reprend la constante interne du compilateur (float.h fait #undef avant de la redéfinir dans les versions récentes).
const FLAGS = ["-DDECIMAL_DIG=__DECIMAL_DIG__", "-mmcu=atmega328p", "-DF_CPU=16000000L", "-DARDUINO=10806", "-DARDUINO_AVR_UNO", "-DARDUINO_ARCH_AVR", "-Os", "-ffunction-sections", "-fdata-sections", "-w"];
const INCLUDES = () => ["-I", path.join(CORE_DIR, "cores", "arduino"), "-I", path.join(CORE_DIR, "variants", "standard")];

export function toolchainStatus(): { available: boolean; reason: string | null } {
  if (!existsSync("/usr/bin/avr-g++") && !existsSync("/usr/local/bin/avr-g++")) return { available: false, reason: "chaîne avr-gcc absente du serveur" };
  if (!existsSync(path.join(CORE_DIR, "cores", "arduino", "Arduino.h"))) return { available: false, reason: `cœur Arduino AVR introuvable (${CORE_DIR})` };
  return { available: true, reason: null };
}

function run(cmd: string, args: string[], cwd: string, timeoutMs = 60_000): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(/* turbopackIgnore: true */ cmd, args, { cwd, env: { PATH: "/usr/bin:/bin:/usr/local/bin" } as unknown as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const t = setTimeout(() => { p.kill("SIGKILL"); out += "\nDurée de compilation dépassée."; }, timeoutMs);
    p.stdout.on("data", (d) => { out += d; if (out.length > 200_000) p.kill("SIGKILL"); });
    p.stderr.on("data", (d) => { out += d; if (out.length > 200_000) p.kill("SIGKILL"); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code: code ?? 1, out }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: 1, out: String(e) }); });
  });
}

let coreBuilding: Promise<string> | null = null;
/** Bibliothèque du cœur Arduino compilée une fois par processus. */
async function coreArchive(): Promise<string> {
  const dir = path.join(tmpdir(), "xx-avr-core-v2");
  const archive = path.join(dir, "core.a");
  if (existsSync(archive)) return archive;
  coreBuilding ??= (async () => {
    mkdirSync(dir, { recursive: true });
    const src = path.join(CORE_DIR, "cores", "arduino");
    const objs: string[] = [];
    for (const f of readdirSync(src).sort()) {
      const ext = path.extname(f);
      if (![".c", ".cpp", ".S"].includes(ext)) continue;
      const obj = path.join(dir, `${f}.o`);
      const cc = ext === ".cpp" ? "avr-g++" : "avr-gcc";
      const extra = ext === ".cpp" ? ["-std=gnu++11", "-fno-exceptions", "-fno-threadsafe-statics"] : ext === ".S" ? ["-x", "assembler-with-cpp"] : ["-std=gnu11"];
      const r = await run(cc, ["-c", ...FLAGS, ...extra, ...INCLUDES(), path.join(src, f), "-o", obj], dir);
      if (r.code) throw new Error(`Compilation du cœur Arduino impossible (${f}) : ${r.out.slice(0, 800)}`);
      objs.push(obj);
    }
    const r = await run("avr-ar", ["rcs", archive, ...objs], dir);
    if (r.code) throw new Error(`Archive du cœur impossible : ${r.out.slice(0, 400)}`);
    return archive;
  })();
  try { return await coreBuilding; } finally { coreBuilding = null; }
}

/** Prototypes des fonctions du croquis (comme l'environnement Arduino), pour permettre l'appel avant définition. */
export function prototypes(source: string): string[] {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const out: string[] = [];
  const re = /^[ \t]*((?:unsigned\s+|signed\s+|static\s+|inline\s+)*[A-Za-z_][\w:<>]*[\s*&]+)([A-Za-z_]\w*)\s*\(([^;{}()]*)\)\s*\{/gm;
  for (const m of noComments.matchAll(re)) {
    const name = m[2];
    if (["if", "for", "while", "switch", "setup", "loop", "return", "else"].includes(name)) continue;
    out.push(`${m[1].trim()} ${name}(${m[3].trim()});`);
  }
  return out;
}

export interface CompileResult { ok: boolean; hex: string | null; flashBytes: number | null; log: string }

export async function compileUno(source: string): Promise<CompileResult> {
  const st = toolchainStatus();
  if (!st.available) return { ok: false, hex: null, flashBytes: null, log: `Compilation indisponible sur ce serveur : ${st.reason}.` };
  let core: string;
  try { core = await coreArchive(); }
  catch (e) { return { ok: false, hex: null, flashBytes: null, log: `Compilation indisponible : ${e instanceof Error ? e.message : String(e)}` }; }
  const dir = mkdtempSync(path.join(tmpdir(), "xx-sketch-"));
  try {
    const protos = prototypes(source);
    writeFileSync(path.join(dir, "sketch.cpp"), `#include <Arduino.h>\n${protos.join("\n")}\n#line 1 "croquis.ino"\n${source}\n`);
    const c = await run("avr-g++", ["-c", ...FLAGS, "-std=gnu++11", "-fno-exceptions", "-fno-threadsafe-statics", "-Wall", ...INCLUDES(), "sketch.cpp", "-o", "sketch.o"], dir);
    if (c.code) return { ok: false, hex: null, flashBytes: null, log: c.out.replaceAll(dir + "/", "").slice(0, 20_000) };
    const l = await run("avr-gcc", ["-mmcu=atmega328p", "-Os", "-Wl,--gc-sections", "sketch.o", core, "-lm", "-o", "sketch.elf"], dir);
    if (l.code) return { ok: false, hex: null, flashBytes: null, log: l.out.replaceAll(dir + "/", "").slice(0, 20_000) };
    const o = await run("avr-objcopy", ["-O", "ihex", "-R", ".eeprom", "sketch.elf", "sketch.hex"], dir);
    if (o.code) return { ok: false, hex: null, flashBytes: null, log: o.out.slice(0, 4000) };
    const size = await run("avr-size", ["-A", "sketch.elf"], dir);
    const text = Number(/\.text\s+(\d+)/.exec(size.out)?.[1] ?? NaN), data = Number(/\.data\s+(\d+)/.exec(size.out)?.[1] ?? 0);
    const flash = Number.isFinite(text) ? text + data : null;
    const warn = c.out.replaceAll(dir + "/", "").trim();
    return { ok: true, hex: readFileSync(path.join(dir, "sketch.hex"), "utf8"), flashBytes: flash, log: `${warn ? `${warn}\n` : ""}Compilation réussie${flash != null ? ` : ${flash} octets de mémoire programme sur 32 256 (${((100 * flash) / 32256).toFixed(1)} %)` : ""}.` };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
