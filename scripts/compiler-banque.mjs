#!/usr/bin/env node
/**
 * Compile chaque programme d'exemple de la banque de projets (src/lib/bank/codes.ts) avec PlatformIO
 * (carte Seeed XIAO ESP32-S3, cœur Arduino). Usage : PIO=/chemin/pio node scripts/compiler-banque.mjs
 * Code de sortie 1 si un programme ne compile pas.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const src = require("node:fs").readFileSync(new URL("../src/lib/bank/codes.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} }; new Function("module", "exports", js)(mod, mod.exports);
const { CODES } = mod.exports;

const dir = mkdtempSync(path.join(tmpdir(), "xx-banque-"));
mkdirSync(path.join(dir, "src"));
writeFileSync(path.join(dir, "platformio.ini"), "[env:xiao]\nplatform = espressif32@6.9.0\nboard = seeed_xiao_esp32s3\nframework = arduino\n");
const pio = process.env.PIO ?? "pio";
let failed = 0;
for (const [key, c] of Object.entries(CODES)) {
  writeFileSync(path.join(dir, "src", "main.cpp"), c.source);
  try {
    const out = execFileSync(pio, ["run", "-d", dir, "-s"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 600_000 });
    const flash = out.match(/Flash:.*?(\d+\.\d+)%/)?.[1];
    console.log(`✓ ${key} — compilé${flash ? ` (Flash ${flash} %)` : ""}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${key}\n${String(e.stdout ?? "").split("\n").filter((l) => /error/i.test(l)).slice(0, 8).join("\n")}${e.stderr ?? ""}`);
  }
}
console.log(failed ? `\n${failed} programme(s) en échec` : `\n${Object.keys(CODES).length} programmes compilés sans erreur`);
process.exit(failed ? 1 : 0);
