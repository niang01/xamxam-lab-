#!/usr/bin/env node
/**
 * XAM-XAM LAB — agent local : relie un appareil branché en USB/série (Arduino, ESP32, automate…) à la plateforme,
 * quand le navigateur ne peut pas accéder au matériel (Safari, Firefox, iPhone, poste sans écran, Raspberry Pi).
 *
 * Protocole série (une ligne par message, \n) :
 *   appareil → agent : « grandeur=valeur »            ex. soil=21.5     → mesure (POST /api/device/ingest)
 *                      « ACK <id> ok|fail [json] »                     → accusé (POST /api/device/ack)
 *   agent → appareil : « CMD {"id":…,"action":…,"duration_s":…} »      commandes confirmées (GET /api/device/commands)
 * Les limites de sécurité restent appliquées par le firmware de l'appareil.
 *
 * Usage : node services/local-agent.mjs --port /dev/ttyUSB0 --baud 115200 --platform https://… --token <jeton>
 *         (ou variables XX_SERIAL_PORT, XX_SERIAL_BAUD, XX_PLATFORM_URL, XX_DEVICE_TOKEN)
 */
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const log = (...a) => console.log(new Date().toISOString(), "[agent]", ...a);

export function parseLine(line) {
  const t = line.trim();
  const ack = /^ACK\s+([0-9a-f-]{36})\s+(ok|fail)(?:\s+(\{.*\}))?$/i.exec(t);
  if (ack) { let state = {}; try { state = ack[3] ? JSON.parse(ack[3]) : {}; } catch { /* état illisible ignoré */ } return { kind: "ack", id: ack[1], ok: ack[2].toLowerCase() === "ok", state }; }
  const m = /^([a-z0-9_.-]{1,40})\s*[=:]\s*(-?\d+(?:\.\d+)?(?:e-?\d+)?)$/i.exec(t);
  if (m) return { kind: "reading", metric: m[1], value: Number(m[2]) };
  return null;
}

/** @param {{ path: string, baudRate?: number, platformUrl: string, token: string, binding?: unknown, pollMs?: number, flushMs?: number }} opts */
export async function runAgent({ path, baudRate = 115200, platformUrl, token, binding, pollMs = 5000, flushMs = 1000 }) {
  if (!path || !platformUrl || !token) throw new Error("port série, URL de la plateforme et jeton requis");
  const base = platformUrl.replace(/\/$/, "");
  const api = async (p, init = {}) => {
    const r = await fetch(`${base}${p}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, signal: AbortSignal.timeout(15000) });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
    return b;
  };
  const me = await api("/api/device/whoami");
  const port = new SerialPort({ path, baudRate, autoOpen: false, ...(binding ? { binding } : {}) });
  await new Promise((res, rej) => port.open((e) => (e ? rej(e) : res())));
  log(`appareil « ${me.name} » sur ${path} à ${baudRate} bauds → ${base}`);
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  let batch = [];
  const stats = { readings: 0, acks: 0, commands: 0, errors: 0 };
  parser.on("data", (line) => {
    const msg = parseLine(String(line));
    if (!msg) return;
    if (msg.kind === "reading") batch.push({ metric: msg.metric, value: msg.value, ts: new Date().toISOString() });
    else api("/api/device/ack", { method: "POST", body: JSON.stringify({ id: msg.id, ok: msg.ok, state: msg.state }) }).then(() => { stats.acks++; }).catch((e) => { stats.errors++; log("accusé refusé", e.message); });
  });
  const flush = setInterval(async () => {
    if (!batch.length) return;
    const readings = batch; batch = [];
    try { await api("/api/device/ingest", { method: "POST", body: JSON.stringify({ readings }) }); stats.readings += readings.length; }
    catch (e) { stats.errors++; batch = readings.concat(batch).slice(-500); log("envoi différé", e.message); }
  }, flushMs);
  const poll = setInterval(async () => {
    try {
      const r = await api("/api/device/commands");
      for (const c of r.commands ?? []) { port.write(`CMD ${JSON.stringify(c)}\n`); stats.commands++; }
    } catch (e) { stats.errors++; log("relevé des commandes impossible", e.message); }
  }, pollMs);
  return { port, stats, stop: async () => { clearInterval(flush); clearInterval(poll); await new Promise((r) => port.close(() => r())); } };
}

function arg(name, env) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : process.env[env]; }

if (import.meta.url === `file://${process.argv[1]}`) {
  runAgent({ path: arg("port", "XX_SERIAL_PORT"), baudRate: Number(arg("baud", "XX_SERIAL_BAUD") ?? 115200), platformUrl: arg("platform", "XX_PLATFORM_URL"), token: arg("token", "XX_DEVICE_TOKEN") })
    .catch((e) => { console.error(`Agent arrêté : ${e.message}`); process.exit(1); });
}
