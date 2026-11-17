/**
 * XAM-XAM LAB — passerelle MQTT (broker Aedes) vers l'API des appareils de la plateforme.
 *
 * Connexion : identifiant client = identifiant de l'appareil, nom d'utilisateur = identifiant de l'appareil,
 * mot de passe = jeton de l'appareil (vérifié auprès de la plateforme : GET /api/device/whoami).
 * Sujets autorisés pour l'appareil <id> (et uniquement les siens) :
 *   xx/<id>/telemetry  (publication)  {"readings":[{"metric":"soil","value":21.5,"unit":"%"}]}  → POST /api/device/ingest
 *   xx/<id>/ack        (publication)  {"id":"<commande>","ok":true,"state":{...}}                → POST /api/device/ack
 *   xx/<id>/cmd        (abonnement)   commandes confirmées, relevées sur GET /api/device/commands
 * La passerelle ne lit ni n'écrit la base : elle ne fait que relayer, avec le jeton de l'appareil.
 *
 * Variables : XX_PLATFORM_URL (ex. https://lab.exemple.sn), MQTT_PORT (1883), MQTTS_PORT + MQTT_TLS_CERT + MQTT_TLS_KEY (TLS),
 *             MQTT_POLL_S (5), MQTT_ALLOW_INSECURE=true pour accepter le MQTT non chiffré hors développement.
 */
import { createServer } from "node:net";
import { createServer as createTlsServer } from "node:tls";
import { readFileSync } from "node:fs";
import { Aedes } from "aedes";

let PLATFORM = (process.env.XX_PLATFORM_URL ?? "http://localhost:3100").replace(/\/$/, "");
const POLL_MS = Number(process.env.MQTT_POLL_S ?? 5) * 1000;
const tokens = new Map(); // id appareil → jeton (en mémoire uniquement, le temps de la connexion)
const log = (...a) => console.log(new Date().toISOString(), "[mqtt]", ...a);

async function platform(path, token, init = {}) {
  const r = await fetch(`${PLATFORM}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error ?? `HTTP ${r.status}`), { status: r.status });
  return body;
}

const topicOf = (t) => { const m = /^xx\/([0-9a-f-]{36})\/(telemetry|ack|cmd)$/.exec(t); return m ? { id: m[1], kind: m[2] } : null; };

/** @param {{ port?: number, tlsPort?: number | null, platformUrl?: string | null, pollMs?: number }} [opts] */
export async function startGateway({ port = Number(process.env.MQTT_PORT ?? 1883), tlsPort = process.env.MQTTS_PORT ? Number(process.env.MQTTS_PORT) : null, platformUrl = null, pollMs = POLL_MS } = {}) {
  if (platformUrl) PLATFORM = platformUrl.replace(/\/$/, "");
  const broker = await Aedes.createBroker({
    authenticate: (client, username, password, done) => {
      const token = password?.toString() ?? "";
      if (!username || username !== client.id || !token) return done(Object.assign(new Error("identifiants requis"), { returnCode: 4 }), false);
      platform("/api/device/whoami", token).then((d) => {
        if (d.id !== client.id) return done(Object.assign(new Error("jeton d'un autre appareil"), { returnCode: 5 }), false);
        tokens.set(client.id, token); log("connecté", d.name, client.id); done(null, true);
      }).catch((e) => { log("refusé", client.id, e.message); done(Object.assign(new Error("non autorisé"), { returnCode: 5 }), false); });
    },
    authorizePublish: (client, packet, done) => {
      const t = topicOf(packet.topic);
      if (!client || !t || t.id !== client.id || t.kind === "cmd") return done(new Error("publication non autorisée"));
      done(null);
    },
    authorizeSubscribe: (client, sub, done) => {
      const t = topicOf(sub.topic);
      if (!t || t.id !== client.id || t.kind !== "cmd") return done(new Error("abonnement non autorisé"));
      done(null, sub);
    },
  });

  broker.on("publish", async (packet, client) => {
    if (!client) return;
    const t = topicOf(packet.topic);
    const token = tokens.get(client.id);
    if (!t || !token) return;
    try {
      const body = JSON.parse(packet.payload.toString("utf8"));
      if (t.kind === "telemetry") {
        const readings = Array.isArray(body.readings) ? body.readings : [body];
        const r = await platform("/api/device/ingest", token, { method: "POST", body: JSON.stringify({ readings, ...(body.firmware ? { firmware: body.firmware } : {}) }) });
        if (r.rejected?.length) log("mesures rejetées", client.id, r.rejected.join(" ; "));
      } else if (t.kind === "ack") {
        await platform("/api/device/ack", token, { method: "POST", body: JSON.stringify(body) });
      }
    } catch (e) { log("relais impossible", client.id, e.message); }
  });
  broker.on("clientDisconnect", (client) => { tokens.delete(client.id); log("déconnecté", client.id); });

  // Commandes confirmées : relevées pour chaque appareil connecté et publiées sur xx/<id>/cmd (QoS 1).
  const timer = setInterval(async () => {
    for (const [id, token] of tokens) {
      try {
        const r = await platform("/api/device/commands", token);
        for (const c of r.commands ?? []) broker.publish({ topic: `xx/${id}/cmd`, payload: Buffer.from(JSON.stringify(c)), qos: 1, retain: false }, () => undefined);
      } catch (e) { log("relevé des commandes impossible", id, e.message); }
    }
  }, pollMs);

  const insecureOk = process.env.NODE_ENV !== "production" || process.env.MQTT_ALLOW_INSECURE === "true";
  const servers = [];
  if (insecureOk) servers.push(await new Promise((res) => { const s = createServer(broker.handle).listen(port, () => res(s)); }));
  if (tlsPort && process.env.MQTT_TLS_CERT && process.env.MQTT_TLS_KEY) {
    const opts = { cert: readFileSync(process.env.MQTT_TLS_CERT), key: readFileSync(process.env.MQTT_TLS_KEY) };
    servers.push(await new Promise((res) => { const s = createTlsServer(opts, broker.handle).listen(tlsPort, () => res(s)); }));
  }
  if (!servers.length) throw new Error("Aucun port MQTT ouvert : configurer MQTTS_PORT + MQTT_TLS_CERT + MQTT_TLS_KEY (ou MQTT_ALLOW_INSECURE=true)");
  log(`passerelle prête → ${PLATFORM} (ports : ${servers.map((s) => s.address().port).join(", ")})`);
  return { broker, close: async () => { clearInterval(timer); await Promise.all(servers.map((s) => new Promise((r) => s.close(r)))); await new Promise((r) => broker.close(r)); } };
}

if (import.meta.url === `file://${process.argv[1]}`) startGateway().catch((e) => { console.error(e); process.exit(1); });
