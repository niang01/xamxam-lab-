#!/usr/bin/env node
/**
 * Contrôle de la configuration de production de XAM-XAM LAB, AVANT la mise en ligne.
 *   node scripts/verifier-config.mjs            # lit .env (ou le fichier passé en argument), sinon l'environnement
 *   node scripts/verifier-config.mjs prod.env
 * Code de sortie 1 s'il reste une erreur bloquante. Aucune valeur secrète n'est affichée.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /^(change|changeme|secret|password|motdepasse|xxx+|todo|test|exemple|example)/i;

/** Lecture minimale d'un fichier .env (clé=valeur, commentaires #, guillemets facultatifs). */
export function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** Renvoie { errors, warnings, info } — messages en français, sans jamais reproduire une valeur secrète. */
export function checkConfig(env) {
  const errors = [], warnings = [], info = [];
  const v = (k) => (env[k] ?? "").trim();
  const strong = (k, min) => {
    const s = v(k);
    if (!s) errors.push(`${k} manquant`);
    else if (s.length < min) errors.push(`${k} trop court (${s.length} caractères, minimum ${min})`);
    else if (PLACEHOLDER.test(s)) errors.push(`${k} ressemble à une valeur d'exemple : générer une valeur aléatoire (openssl rand -base64 48)`);
  };

  strong("SESSION_SECRET", 32);
  if (!v("DATABASE_URL")) strong("POSTGRES_PASSWORD", 16);

  const admins = v("XX_ADMIN_EMAILS").split(",").map((s) => s.trim()).filter(Boolean);
  if (!admins.length) errors.push("XX_ADMIN_EMAILS manquant : aucun compte ne pourra administrer la plateforme");
  for (const a of admins) if (!EMAIL.test(a)) errors.push(`XX_ADMIN_EMAILS : adresse invalide « ${a} »`);

  const enc = v("XX_ENCRYPTION_KEY");
  if (!enc) warnings.push("XX_ENCRYPTION_KEY absent : les secrets de double authentification seront chiffrés avec une clé dérivée de SESSION_SECRET (changer SESSION_SECRET les rendrait illisibles)");
  else if (enc.length < 32) errors.push(`XX_ENCRYPTION_KEY trop court (${enc.length} caractères, minimum 32)`);
  else if (enc === v("SESSION_SECRET")) errors.push("XX_ENCRYPTION_KEY doit être différent de SESSION_SECRET");

  if (v("INSECURE_COOKIES") === "true") errors.push("INSECURE_COOKIES=true : interdit en production (cookies de session envoyés sans HTTPS)");
  info.push(v("MQTTS_PORT") ? "Passerelle MQTT : TLS configuré (profil « iot »)" : v("MQTT_ALLOW_INSECURE") === "true" ? "Passerelle MQTT : sans TLS (profil « iot », banc d'essai)" : "Passerelle MQTT : non activable tant que TLS n'est pas configuré (profil « iot » facultatif)");
  if (v("MQTT_ALLOW_INSECURE") === "true" && !v("MQTTS_PORT")) warnings.push("MQTT sans TLS autorisé et aucun MQTTS_PORT : réserver à un réseau local de banc d'essai");
  if (v("MQTTS_PORT") && (!v("MQTT_TLS_CERT") || !v("MQTT_TLS_KEY"))) errors.push("MQTTS_PORT défini sans MQTT_TLS_CERT et MQTT_TLS_KEY");

  const domain = v("XX_DOMAIN");
  if (!domain || domain === "localhost") warnings.push("XX_DOMAIN absent ou « localhost » : le profil https utilisera un certificat local, non reconnu par les navigateurs (essais uniquement)");
  else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) errors.push(`XX_DOMAIN invalide « ${domain} »`);

  if (!!v("METEOMATICS_USERNAME") !== !!v("METEOMATICS_PASSWORD")) errors.push("METEOMATICS_USERNAME et METEOMATICS_PASSWORD vont ensemble");
  info.push(v("ANTHROPIC_API_KEY") ? "IA générative : clé Anthropic présente" : "IA générative : aucune clé ANTHROPIC_API_KEY — le moteur de règles répondra (signalé aux utilisateurs)");
  info.push(v("METEOMATICS_USERNAME") ? "Prévisions Meteomatics : identifiants présents" : "Prévisions Meteomatics : non configurées (fonction signalée « en attente d'un compte »)");
  info.push(v("XX_TURN_URLS") ? "Visioconférence : serveur TURN configuré" : "Visioconférence : pas de serveur TURN (réunions entre réseaux différents non garanties)");
  const days = Number(v("XX_BACKUP_RETENTION_DAYS") || 14);
  if (!Number.isInteger(days) || days < 1) errors.push("XX_BACKUP_RETENTION_DAYS doit être un entier ≥ 1");
  else {
    const every = Number(v("XX_BACKUP_INTERVAL_S") || 86400);
    if (!Number.isFinite(every) || every < 60) errors.push("XX_BACKUP_INTERVAL_S doit être un nombre de secondes ≥ 60");
    else info.push(`Sauvegardes : toutes les ${every >= 3600 ? `${Math.round(every / 3600)} h` : `${Math.round(every / 60)} min`}, conservées ${days} jours`);
  }
  return { errors, warnings, info };
}

function main() {
  const file = process.argv[2] ?? ".env";
  const env = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : process.env;
  console.log(`XAM-XAM LAB — contrôle de configuration (${existsSync(file) ? file : "variables d'environnement"})`);
  const { errors, warnings, info } = checkConfig(env);
  for (const m of errors) console.log(`  ✗ ${m}`);
  for (const m of warnings) console.log(`  ! ${m}`);
  for (const m of info) console.log(`  · ${m}`);
  console.log(errors.length ? `\n${errors.length} erreur(s) bloquante(s) : corriger avant la mise en ligne.` : "\nConfiguration acceptable pour la production.");
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
