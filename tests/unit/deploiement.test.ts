import { describe, expect, it } from "vitest";
import { checkConfig, parseEnv } from "../../scripts/verifier-config.mjs";

const GOOD = {
  SESSION_SECRET: "Zq8vN3rT6yW1mB4kP9sD2fH5jL7xC0aE-uI",
  XX_ENCRYPTION_KEY: "Kt4Rw8Yp2Nb6Vm0Qz3Hs7Jd1Lf5Gc9Xa-oE",
  POSTGRES_PASSWORD: "p0stgres-R4nd0m-Value",
  XX_ADMIN_EMAILS: "admin@lab.example.sn",
  XX_DOMAIN: "lab.example.sn",
};

describe("Contrôle de configuration de production", () => {
  it("lit un fichier .env (commentaires, guillemets)", () => {
    expect(parseEnv("# titre\nA=1\nB=\"deux mots\"   # commentaire\n\nC='x'\nINVALIDE\n")).toEqual({ A: "1", B: "deux mots", C: "x" });
  });
  it("configuration complète : aucune erreur", () => {
    const r = checkConfig(GOOD);
    expect(r.errors).toEqual([]);
    expect(r.info.join(" ")).toContain("moteur de règles");
  });
  it("secrets absents, courts ou d'exemple refusés, sans afficher leur valeur", () => {
    const r = checkConfig({ ...GOOD, SESSION_SECRET: "changeme-changeme-changeme-changeme", POSTGRES_PASSWORD: "court" });
    expect(r.errors.join("\n")).toMatch(/SESSION_SECRET ressemble à une valeur d'exemple/);
    expect(r.errors.join("\n")).toMatch(/POSTGRES_PASSWORD trop court/);
    expect(r.errors.join("\n")).not.toContain("court\"");
    expect(checkConfig({ ...GOOD, SESSION_SECRET: "" }).errors).toContain("SESSION_SECRET manquant");
  });
  it("clé de chiffrement distincte, administrateurs valides, cookies sécurisés, TLS MQTT cohérent", () => {
    expect(checkConfig({ ...GOOD, XX_ENCRYPTION_KEY: GOOD.SESSION_SECRET }).errors).toContain("XX_ENCRYPTION_KEY doit être différent de SESSION_SECRET");
    expect(checkConfig({ ...GOOD, XX_ENCRYPTION_KEY: "" }).warnings.join(" ")).toContain("XX_ENCRYPTION_KEY absent");
    expect(checkConfig({ ...GOOD, XX_ADMIN_EMAILS: "" }).errors[0]).toContain("XX_ADMIN_EMAILS manquant");
    expect(checkConfig({ ...GOOD, XX_ADMIN_EMAILS: "admin@lab.sn, pas-une-adresse" }).errors).toContain("XX_ADMIN_EMAILS : adresse invalide « pas-une-adresse »");
    expect(checkConfig({ ...GOOD, INSECURE_COOKIES: "true" }).errors.join(" ")).toContain("INSECURE_COOKIES=true");
    expect(checkConfig({ ...GOOD, XX_RATE_LIMIT_FACTOR: "5" }).errors.join(" ")).toContain("XX_RATE_LIMIT_FACTOR");
    expect(checkConfig({ ...GOOD, MQTTS_PORT: "8883" }).errors.join(" ")).toContain("MQTT_TLS_CERT");
    expect(checkConfig({ ...GOOD, METEOMATICS_USERNAME: "compte" }).errors.join(" ")).toContain("vont ensemble");
  });
  it("domaine : localhost signalé, domaine invalide refusé", () => {
    expect(checkConfig({ ...GOOD, XX_DOMAIN: "localhost" }).warnings.join(" ")).toContain("certificat local");
    expect(checkConfig({ ...GOOD, XX_DOMAIN: "pas un domaine" }).errors.join(" ")).toContain("XX_DOMAIN invalide");
  });
});

describe("Connexion PostgreSQL hébergée (Neon)", () => {
  it("TLS avec vérification du certificat, paramètres retirés de l'URL, liaison de canal", async () => {
    const { postgresConnection } = await import("@/server/db");
    const c = postgresConnection("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
    expect(c.ssl).toEqual({ rejectUnauthorized: true });
    expect(c.enableChannelBinding).toBe(true);
    expect(c.connectionString).toBe("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb");
    expect(postgresConnection("postgres://xamxam:pw@db:5432/xamxam").ssl).toBeUndefined();
  });
});

describe("Base hébergée : chiffrement exigé", () => {
  it("refuse une base externe sans sslmode=require ; accepte la base Docker locale", () => {
    const base = { SESSION_SECRET: "Zq8vN3rT6yW1mB4kP9sD2fH5jL7xC0aE-uI", XX_ENCRYPTION_KEY: "Kt4Rw8Yp2Nb6Vm0Qz3Hs7Jd1Lf5Gc9Xa-oE", XX_ADMIN_EMAILS: "a@lab.sn", XX_DOMAIN: "lab.example.sn" };
    expect(checkConfig({ ...base, DATABASE_URL: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb" }).errors.join(" ")).toContain("sslmode=require");
    expect(checkConfig({ ...base, DATABASE_URL: "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require" }).errors).toEqual([]);
    expect(checkConfig({ ...base, DATABASE_URL: "postgres://xamxam:pw@db:5432/xamxam" }).errors).toEqual([]);
  });
});
