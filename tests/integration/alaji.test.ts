import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as chat from "@/app/api/ai/chat/route";
import * as status from "@/app/api/ai/status/route";
import * as projects from "@/app/api/projects/route";
import { sql } from "@/server/db";
import { analyseRequest, budget, verifySteps } from "@/server/ai/analysis";
import { extractCalcInput } from "@/server/ai/core";

let s: Session;
const ask = (question: string) => call(chat.POST as never, "POST", "/api/ai/chat", { session: s, body: { question, lang: "fr" } });
beforeAll(async () => { s = await register(registerRoute.POST as never, "alaji@test.local", "student"); });

describe("Aláji IA — analyse et vérification (déterministes)", () => {
  it("identifie disciplines, type de projet et intentions", () => {
    const a = analyseRequest("Mémoire de BTS : dimensionner une installation solaire avec pompage et capteur ESP32 pour l'irrigation, puis rédiger le rapport");
    expect(a.disciplines.map((d) => d.key)).toEqual(expect.arrayContaining(["solar", "iot"]));
    expect(a.projectType).toBe("projet_bts");
    expect(a.intents).toEqual(expect.arrayContaining(["rapport", "calcul"]));
    expect(analyseRequest("Prototype innovant pour une start-up de domotique").projectType).toBe("startup");
    expect(analyseRequest("Bonjour").disciplines).toEqual([]);
  });

  it("vérificateur : étapes non exécutées, paramètres manquants, valeurs non finies, mesures simulées", () => {
    const v = verifySteps([
      { tool: "run_calculation", status: "done", error: null, output: { result: { outputs: { i: { value: 2, unit: "A", label: "Courant" } }, missing: [], warnings: [] } } },
      { tool: "run_calculation", status: "done", error: null, output: { result: { outputs: { p: { value: Infinity, unit: "W", label: "Puissance" } }, missing: ["cos φ"], warnings: [] } } },
      { tool: "create_project", status: "awaiting_approval", error: "niveau 3 requis" },
      { tool: "get_device_readings", status: "done", error: null, output: [{ quality: "simulated" }] },
    ]);
    expect(v.ok).toBe(false); expect(v.checked).toBe(4);
    expect(v.issues.join("\n")).toMatch(/paramètre manquant — cos φ/);
    expect(v.issues.join("\n")).toMatch(/valeur non finie pour Puissance/);
    expect(v.issues.join("\n")).toMatch(/create_project : NON exécuté — en attente/);
    expect(v.issues.join("\n")).toMatch(/SIMULÉES/);
    expect(verifySteps([{ tool: "run_calculation", status: "done", error: null, output: { result: { outputs: { i: { value: 2, unit: "A" } }, missing: [] } } }]).ok).toBe(true);
  });

  it("paramètres « nom=valeur » : jamais devinés (absent → null)", () => {
    expect(extractCalcInput("pump", "calcul pump flowM3h=5 headM=30,5")).toEqual({ flowM3h: 5, headM: 30.5, pumpEff: null, motorEff: null, dailyVolumeM3: null });
  });

  it("budget : total par devise, ligne sans prix signalée et non estimée", () => {
    const b = budget([{ name: "ESP32", qty: 2, unit_price: 6500, currency: "XOF" }, { name: "Pompe", qty: 1, unit_price: null, currency: "XOF" }]);
    expect(b).toMatch(/\*\*Total\*\* : 13000 XOF — 1 article\(s\) sans prix : total incomplet/);
  });
});

describe("Aláji IA — mode sans clé (exécution réelle des agents)", () => {
  it("statut : mode sans clé signalé, agents et activité réelle", async () => {
    const r = await call(status.GET as never, "GET", "/api/ai/status", { session: s });
    expect(r.json).toMatchObject({ mode: "rules", provider: "none" });
    expect((r.json.agents as { key: string }[]).map((a) => a.key)).toContain("verifier");
  });

  it("calcul nommé : exécuté par l'outil, paramètres manquants listés et vérifiés", async () => {
    const r = await ask("Projet BTS solaire : calcul pump flowM3h=5 headM=30");
    const answer = String(r.json.answer);
    expect(answer).toMatch(/Analyse de la demande/);
    expect(answer).toMatch(/Projet de technicien supérieur/);
    expect(answer).toMatch(/Paramètre manquant/);
    expect(answer).toMatch(/Où travailler.*\/lab\/solar/s);
    const steps = await sql<{ agent_key: string; tool: string; status: string }>("SELECT agent_key, tool, status FROM ai_steps WHERE user_id=(SELECT id FROM users WHERE email='alaji@test.local') ORDER BY created_at");
    expect(steps.map((x) => [x.agent_key, x.tool, x.status])).toEqual(expect.arrayContaining([["solar", "run_calculation", "done"], ["verifier", "verify_results", "done"]]));
  });

  it("rapport et suivi d'un projet, à partir des données enregistrées", async () => {
    const p = await call(projects.POST as never, "POST", "/api/projects", { session: s, body: { title: "Irrigation solaire", description: "Pompage solaire pour 1 ha.", kind: "thesis" } });
    expect(p.status).toBe(201);
    const id = p.json.id as string;
    await sql("INSERT INTO project_components(project_id, name, qty, unit_price) VALUES ($1,'Carte ESP32',1,6500),($1,'Pompe de surface',1,NULL)", [id]);
    const r = await ask("Génère le rapport du projet Irrigation solaire");
    const answer = String(r.json.answer);
    expect(answer).toMatch(/# Irrigation solaire/);
    expect(answer).toMatch(/Pompage solaire pour 1 ha/);
    expect(answer).toMatch(/Carte ESP32/);
    expect(answer).toMatch(/total incomplet/);
    expect(answer).toMatch(/_Non renseigné\._/);
    const follow = await ask("Où en est le suivi de mes projets ?");
    expect(String(follow.json.answer)).toMatch(/Irrigation solaire : 0\/0 tâche/);
  });
});

describe("Aláji IA — fournisseur compatible OpenAI (fetch explicite)", () => {
  it("boucle d'outils : calcul exécuté par la plateforme, réponse du modèle, vérification ajoutée", async () => {
    const { askCore } = await import("@/server/ai/core");
    Object.assign(process.env, { AI_PROVIDER: "openai_compatible", AI_BASE_URL: "https://llm.exemple.test/v1", AI_MODEL: "modele-test", AI_API_KEY: "cle-test" });
    const bodies: { messages: { role: string }[]; tools: unknown[] }[] = [];
    const urls: string[] = [];
    const fetchImpl = (async (url: string, init: { body: string; headers: Record<string, string> }) => {
      urls.push(url); bodies.push(JSON.parse(init.body));
      expect(init.headers.Authorization).toBe("Bearer cle-test");
      const first = bodies.length === 1;
      const message = first
        ? { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "run_calculation", arguments: JSON.stringify({ kind: "ohm", input: { u: 12, r: 6, i: null } }) } }] }
        : { role: "assistant", content: "Le courant est de 2 A (calcul de la plateforme)." };
      return new Response(JSON.stringify({ choices: [{ message, finish_reason: first ? "tool_calls" : "stop" }] }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    try {
      const u = await (await import("@/server/api")).sessionUser(new Request("http://x", { headers: { cookie: s.cookie } }));
      const r = await askCore("Courant pour 12 V et 6 ohms", { user: u!, lang: "fr", fetchImpl });
      expect(r.mode).toBe("llm"); expect(r.model).toBe("modele-test");
      expect(urls[0]).toBe("https://llm.exemple.test/v1/chat/completions");
      expect(bodies[0].tools.length).toBeGreaterThan(3);
      expect(bodies[1].messages.at(-1)!.role).toBe("tool");
      expect(r.steps.map((x) => [x.tool, x.status])).toEqual([["run_calculation", "done"]]);
      expect(r.answer).toMatch(/2 A/);
      expect(r.answer).toMatch(/Vérification \(agent vérificateur\)/);
      // Fournisseur en erreur → repli signalé sur le mode sans clé
      const ko = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;
      const r2 = await askCore("mes projets", { user: u!, fetchImpl: ko });
      expect(r2.mode).toBe("rules"); expect(r2.warning).toMatch(/HTTP 503/);
    } finally { for (const k of ["AI_PROVIDER", "AI_BASE_URL", "AI_MODEL", "AI_API_KEY"]) delete process.env[k]; }
  });
});

describe("Aláji IA — schémas techniques", () => {
  it("demande de schéma → générateur exécuté, contrôles de logique, lien vers l'éditeur", async () => {
    const r = await ask("Génère le schéma de démarrage direct d'un moteur de 11 kW");
    const a = String(r.json.answer);
    expect(a).toMatch(/Démarrage direct — moteur 11 kW/);
    expect(a).toMatch(/\/schemas\?generer=demarrage_direct&p=/);
    expect(a).toMatch(/✓ Le contact F1 \(95-96\) du relais thermique est en série avec la bobine/);
    expect(a).toMatch(/21\.\d\d A \(calcul\)/);
  });
  it("API : génération paramétrée, paramètres hors bornes refusés", async () => {
    const gen = await import("@/app/api/schematic-generators/route");
    const ok = await call(gen.POST as never, "POST", "/x", { session: s, body: { kind: "unifilaire_pv", params: { strings: 3 } } });
    expect(ok.status).toBe(200); expect((ok.json.diagram as { blocks: unknown[] }).blocks.length).toBe(9);
    expect((await call(gen.POST as never, "POST", "/x", { session: s, body: { kind: "unifilaire_pv", params: { strings: 99 } } })).status).toBe(400);
  });
});

import * as convs from "@/app/api/ai/conversations/route";
import * as conv from "@/app/api/ai/conversations/[id]/route";
describe("Historique d'Aláji IA supprimable", () => {
  it("suppression d'une conversation, puis de tout l'historique ; jamais celui d'un autre compte", async () => {
    await ask("Calcule le courant pour P = 2000 W, U = 230 V");
    await ask("Loi d'Ohm U = 12 V R = 6 Ω");
    const list = (await call(convs.GET as never, "GET", "/x", { session: s })).json.items as { id: string }[];
    expect(list.length).toBeGreaterThanOrEqual(2);
    const other = await register(registerRoute.POST as never, "autre-ia@test.local");
    expect((await call(conv.DELETE as never, "DELETE", "/x", { session: other, params: { id: list[0].id } })).status).toBe(404);
    expect((await call(conv.DELETE as never, "DELETE", "/x", { session: s, params: { id: list[0].id } })).status).toBe(200);
    expect((await call(conv.GET as never, "GET", "/x", { session: s, params: { id: list[0].id } })).status).toBe(404);
    const all = await call(convs.DELETE as never, "DELETE", "/x", { session: s });
    expect(all.json.deleted).toBe(list.length - 1);
    expect((await call(convs.GET as never, "GET", "/x", { session: s })).json.items).toEqual([]);
    expect((await sql("SELECT 1 FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE c.user_id=(SELECT id FROM users WHERE email='alaji@test.local')")).length).toBe(0);
  });
});

import { executeStepForTest } from "./ai-helpers";
describe("Aláji IA et logiciels de dimensionnement", () => {
  it("orientation vers le bon logiciel ; outil run_study : calcul par le moteur, donnée absente signalée", async () => {
    const r = await ask("Je veux dimensionner l'irrigation goutte-à-goutte de mon champ");
    expect(r.json.answer as string).toContain("/dimensionnement/irrigation");
    const ok = await executeStepForTest("run_study", { software: "drones", input: { m_frame: 900, m_bat: 450, m_payload: 300, n: 4, thrust: 1100, p_hover: 85, v_bat: 14.8, cap: 5000, usable: 80, tw_min: 2 } }) as { ok: boolean; summary: { label: string; value: number }[] };
    expect(ok.ok).toBe(true); expect(ok.summary[0].value).toBeCloseTo(2.667, 2);
    const miss = await executeStepForTest("run_study", { software: "drones", input: { m_frame: 900 } }) as { ok: boolean; missing: string[] };
    expect(miss.ok).toBe(false); expect(miss.missing.join()).toContain("poussée");
  });
});
