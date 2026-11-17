import { describe, expect, it, beforeAll } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as devices from "@/app/api/devices/route";
import * as commands from "@/app/api/devices/[id]/commands/route";
import * as estop from "@/app/api/devices/[id]/estop/route";
import * as simReadings from "@/app/api/devices/[id]/simulate/route";
import * as ingest from "@/app/api/device/ingest/route";
import * as pickup from "@/app/api/device/commands/route";
import * as ack from "@/app/api/device/ack/route";
import * as automations from "@/app/api/automations/route";
import * as automation from "@/app/api/automations/[id]/route";
import * as dry from "@/app/api/automations/[id]/dry-run/route";
import * as clearances from "@/app/api/admin/users/[id]/clearances/route";
import * as rc from "@/app/api/rc/sessions/route";
import * as cc from "@/app/api/command-center/route";
import * as chat from "@/app/api/ai/chat/route";
import * as step from "@/app/api/ai/steps/[id]/route";
import * as me from "@/app/api/me/route";
import * as courses from "@/app/api/courses/route";
import * as course from "@/app/api/courses/[id]/route";
import * as enroll from "@/app/api/courses/[id]/enroll/route";
import * as submit from "@/app/api/courses/[id]/submit/route";
import * as cert from "@/app/api/public/certificates/[id]/route";
import * as eco from "@/app/api/eco/route";
import * as ecoItem from "@/app/api/eco/[id]/route";
import * as ecoLinks from "@/app/api/eco/[id]/links/route";
import * as projects from "@/app/api/projects/route";
import { sql } from "@/server/db";

const R = registerRoute.POST as never;
let admin: Session, tech: Session, pupil: Session, teacher: Session, company: Session;
let techId = "";
const caps = { metrics: [{ metric: "soil", unit: "%" }], commands: [{ action: "pump_on", label: "Pompe", max_duration_s: 600, requires_duration: true }] };

beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  tech = await register(R, "tech@test.local", "technician");
  pupil = await register(R, "pupil@test.local", "pupil");
  teacher = await register(R, "prof@test.local", "teacher");
  company = await register(R, "entreprise@test.local", "company");
  techId = (await sql<{ id: string }>("SELECT id FROM users WHERE email='tech@test.local'"))[0].id;
});

async function newDevice(s: Session, environment: string) {
  const r = await call(devices.POST as never, "POST", "/api/devices", { session: s, body: { name: `Banc ${environment}`, hardware: "xiao_esp32s3", protocol: "https", environment, capabilities: caps } });
  return { id: r.json.id as string, auth: { authorization: `Bearer ${r.json.token}` } };
}

describe("IoT Gateway et commandes", () => {
  it("profil sans droit matériel : enregistrement refusé", async () => {
    expect((await call(devices.POST as never, "POST", "/api/devices", { session: pupil, body: { name: "x", hardware: "esp32", protocol: "https", environment: "virtual", capabilities: caps } })).status).toBe(403);
  });
  it("jeton : seul le hachage est stocké ; mauvais jeton refusé", async () => {
    const d = await newDevice(tech, "bench");
    const row = (await sql<{ token_hash: string }>("SELECT token_hash FROM devices WHERE id=$1", [d.id]))[0];
    expect(row.token_hash).toHaveLength(64);
    expect((await call(ingest.POST as never, "POST", "/api/device/ingest", { headers: { authorization: "Bearer faux" }, body: { readings: [{ metric: "soil", value: 1 }] } })).status).toBe(401);
    const ok = await call(ingest.POST as never, "POST", "/api/device/ingest", { headers: d.auth, body: { readings: [{ metric: "soil", value: 30 }, { metric: "soil", value: 1, ts: "2099-01-01T00:00:00Z" }] } });
    expect(ok.json).toMatchObject({ accepted: 1, quality: "valid" });
  });
  it("banc : habilitation requise ; accordée par l'administrateur ; exécutée seulement sur accusé", async () => {
    const d = await newDevice(tech, "bench");
    const c1 = await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 120, confirm: true } });
    expect(c1.status).toBe(403);
    expect((await call(clearances.POST as never, "POST", "/x", { session: tech, params: { id: techId }, body: { kind: "banc_essai", evidence: "Formation 2026" } })).status).toBe(403);
    await call(clearances.POST as never, "POST", "/x", { session: admin, params: { id: techId }, body: { kind: "banc_essai", evidence: "Formation sécurité électrique 2026" } });
    const c2 = await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 120, confirm: true } });
    expect(c2.json.status).toBe("confirmed");
    const got = await call(pickup.GET as never, "GET", "/api/device/commands", { headers: d.auth });
    const cmd = (got.json.commands as { id: string; duration_s: number }[])[0];
    expect(cmd.duration_s).toBe(120);
    let st = (await sql<{ status: string }>("SELECT status FROM device_commands WHERE id=$1", [cmd.id]))[0].status;
    expect(st).toBe("sent");
    await call(ack.POST as never, "POST", "/api/device/ack", { headers: d.auth, body: { id: cmd.id, ok: true, state: { relay: "on" } } });
    st = (await sql<{ status: string }>("SELECT status FROM device_commands WHERE id=$1", [cmd.id]))[0].status;
    expect(st).toBe("acknowledged");
    expect((await call(ack.POST as never, "POST", "/api/device/ack", { headers: d.auth, body: { id: cmd.id, ok: true } })).status).toBe(409);
  });
  it("durée > maximum refusée ; commande non récupérée expirée ; arrêt d'urgence prioritaire", async () => {
    const d = await newDevice(tech, "virtual");
    expect((await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 9999, confirm: true } })).status).toBe(409);
    const c = await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 60, confirm: true } });
    await sql("UPDATE device_commands SET expires_at=now() - interval '1 second' WHERE id=$1", [c.json.id]);
    const got = await call(pickup.GET as never, "GET", "/api/device/commands", { headers: d.auth });
    expect(got.json.commands).toEqual([]);
    expect((await sql<{ status: string }>("SELECT status FROM device_commands WHERE id=$1", [c.json.id]))[0].status).toBe("expired");
    await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 60, confirm: true } });
    await call(estop.POST as never, "POST", `/api/devices/${d.id}/estop`, { session: tech, params: { id: d.id }, body: {} });
    const after = await call(pickup.GET as never, "GET", "/api/device/commands", { headers: d.auth });
    expect((after.json.commands as { action: string }[]).map((x) => x.action)).toEqual(["estop"]);
  });
  it("opération réelle : session refusée sans habilitation ni autorisation", async () => {
    const d = await newDevice(tech, "real");
    const r = await call(rc.POST as never, "POST", "/api/rc/sessions", { session: tech, body: { device_id: d.id, checklist: [{ item: "a", checked: true }] } });
    expect(r.status).toBe(403);
    expect(String(r.json.error)).toMatch(/opération réelle/);
  });
  it("coupe-circuit des commandes (Command Center)", async () => {
    const d = await newDevice(tech, "virtual");
    expect((await call(cc.POST as never, "POST", "/x", { session: tech, body: { kind: "switch", key: "devices_enabled", value: false } })).status).toBe(403);
    await call(cc.POST as never, "POST", "/x", { session: admin, body: { kind: "switch", key: "devices_enabled", value: false } });
    expect((await call(commands.POST as never, "POST", `/api/devices/${d.id}/commands`, { session: tech, params: { id: d.id }, body: { action: "pump_on", duration_s: 60, confirm: true } })).status).toBe(423);
    expect((await call(estop.POST as never, "POST", `/api/devices/${d.id}/estop`, { session: tech, params: { id: d.id }, body: {} })).status).toBe(200);
    await call(cc.POST as never, "POST", "/x", { session: admin, body: { kind: "switch", key: "devices_enabled", value: true } });
    const view = await call(cc.GET as never, "GET", "/x", { session: admin });
    expect((view.json.auditChain as { ok: boolean }).ok).toBe(true);
  });
});

describe("Automation Studio", () => {
  it("essai à blanc obligatoire ; mesures simulées sans effet ; déclenchement → proposition ; niveau 5 → confirmation préautorisée", async () => {
    const d = await newDevice(tech, "virtual");
    const spec = { trigger: { device_id: d.id, metric: "soil" }, condition: { op: "<", threshold: 25, max_age_s: 900 }, action: { kind: "command", device_id: d.id, action: "pump_on", duration_s: 300 }, cooldown_s: 3600, verify: { metric: "soil", within_s: 1800 }, stop: { max_runs_per_day: 3 } };
    const a = await call(automations.POST as never, "POST", "/api/automations", { session: tech, body: { name: "Irrigation", spec } });
    const id = a.json.id as string;
    expect((await call(automation.PATCH as never, "PATCH", "/x", { session: tech, params: { id }, body: { enabled: true } })).status).toBe(409);
    expect((await call(dry.POST as never, "POST", "/x", { session: tech, params: { id } })).json.readings).toBe(0);
    await call(automation.PATCH as never, "PATCH", "/x", { session: tech, params: { id }, body: { enabled: true } });
    await call(simReadings.POST as never, "POST", "/x", { session: tech, params: { id: d.id }, body: { metric: "soil", values: [10], interval_s: 60 } });
    expect((await sql("SELECT 1 FROM device_commands WHERE device_id=$1", [d.id])).length).toBe(0);
    await call(ingest.POST as never, "POST", "/x", { headers: d.auth, body: { readings: [{ metric: "soil", value: 12 }] } });
    const c = await sql<{ status: string; proposed_by: string }>("SELECT status, proposed_by FROM device_commands WHERE device_id=$1", [d.id]);
    expect(c).toEqual([{ status: "proposed", proposed_by: "automation" }]);
    // Préautorisation : niveau 5 exigé.
    expect((await call(automation.PATCH as never, "PATCH", "/x", { session: tech, params: { id }, body: { preauthorized: true } })).status).toBe(403);
    await call(me.PATCH as never, "PATCH", "/api/me", { session: tech, body: { autonomy_level: 5 } });
    expect((await call(automation.PATCH as never, "PATCH", "/x", { session: tech, params: { id }, body: { preauthorized: true } })).status).toBe(200);
    await sql("UPDATE automations SET last_fired_at=NULL WHERE id=$1", [id]);
    await call(ingest.POST as never, "POST", "/x", { headers: d.auth, body: { readings: [{ metric: "soil", value: 11 }] } });
    const c2 = await sql<{ status: string; preauthorized_by: string | null }>("SELECT status, preauthorized_by FROM device_commands WHERE device_id=$1 ORDER BY created_at DESC LIMIT 1", [d.id]);
    expect(c2[0].status).toBe("confirmed");
    expect(c2[0].preauthorized_by).toBe(techId);
  });
});

describe("XAM-XAM AI CORE", () => {
  it("moteur de règles signalé ; calcul via outil journalisé", async () => {
    const r = await call(chat.POST as never, "POST", "/x", { session: pupil, body: { question: "Calcule 192.168.1.0/26", lang: "fr" } });
    expect(r.json.mode).toBe("rules");
    expect(String(r.json.answer)).toMatch(/Moteur de règles/);
    expect(String(r.json.answer)).toMatch(/62 hôtes/);
    expect((r.json.steps as { tool: string; status: string }[])[0]).toMatchObject({ tool: "run_calculation", status: "done" });
  });
  it("arrêt global : aucune opération", async () => {
    await call(cc.POST as never, "POST", "/x", { session: admin, body: { kind: "switch", key: "ai_enabled", value: false } });
    const r = await call(chat.POST as never, "POST", "/x", { session: pupil, body: { question: "U=5 R=10" } });
    expect(r.json.steps).toEqual([]);
    expect(String(r.json.answer)).toMatch(/suspendue/);
    await call(cc.POST as never, "POST", "/x", { session: admin, body: { kind: "switch", key: "ai_enabled", value: true } });
  });
  it("mode Claude (fetch explicite) : outils exécutés, écriture au-dessus du niveau mise en attente puis approuvée", async () => {
    const { askCore } = await import("@/server/ai/core");
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const bodies: Record<string, unknown>[] = [];
    let turn = 0;
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      turn++;
      const content = turn === 1
        ? [{ type: "text", text: "Je calcule puis je crée le projet." }, { type: "tool_use", id: "t1", name: "run_calculation", input: { kind: "ohm", input: { u: 12, r: 6 } } }, { type: "tool_use", id: "t2", name: "create_project", input: { title: "Projet IA", description: null, problem: null, objectives: null, kind: "engineering" } }]
        : [{ type: "text", text: "Courant : 2 A. Le projet attend votre approbation." }];
      return new Response(JSON.stringify({ id: `m${turn}`, type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason: turn === 1 ? "tool_use" : "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const user = (await import("@/server/api")).sessionUser;
    const u = await user(new Request("http://x", { headers: { cookie: pupil.cookie } }));
    const r = await askCore("Courant pour 12 V et 6 ohms, puis crée un projet", { user: u!, lang: "fr", fetchImpl });
    delete process.env.ANTHROPIC_API_KEY;
    expect(r.mode).toBe("llm");
    expect(r.steps.map((s) => [s.tool, s.status])).toEqual([["run_calculation", "done"], ["create_project", "awaiting_approval"]]);
    expect(bodies[0]).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "medium" }, fallbacks: "default" });
    expect(bodies[0].tool_choice).toBeUndefined();
    expect(bodies[0].temperature).toBeUndefined();
    const second = bodies[1].messages as { role: string; content: unknown }[];
    expect(second[0].role).toBe("user");
    expect(JSON.stringify(second.at(-1))).toMatch(/NON EXÉCUTÉ — en attente d'approbation/);
    expect((await sql("SELECT 1 FROM projects WHERE title='Projet IA'")).length).toBe(0);
    const pending = r.steps[1];
    const ap = await call(step.POST as never, "POST", "/x", { session: pupil, params: { id: pending.id }, body: { approve: true } });
    expect(ap.json.status).toBe("approved");
    expect((await sql("SELECT 1 FROM projects WHERE title='Projet IA'")).length).toBe(1);
    expect((await call(step.POST as never, "POST", "/x", { session: pupil, params: { id: pending.id }, body: { approve: true } })).status).toBe(409);
  });
  it("clé refusée par le fournisseur : repli signalé sur le moteur de règles", async () => {
    const { askCore } = await import("@/server/ai/core");
    process.env.ANTHROPIC_API_KEY = "sk-ant-invalide";
    const fetchImpl = (async () => new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: 401, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const u = await (await import("@/server/api")).sessionUser(new Request("http://x", { headers: { cookie: pupil.cookie } }));
    const r = await askCore("mes projets", { user: u!, fetchImpl });
    delete process.env.ANTHROPIC_API_KEY;
    expect(r.mode).toBe("rules");
    expect(r.warning).toMatch(/clé du fournisseur IA refusée/);
  });
});

describe("Academy et écosystème", () => {
  it("cours, correction serveur, certificat vérifiable ; réponses masquées à l'apprenant", async () => {
    expect((await call(courses.POST as never, "POST", "/x", { session: pupil, body: {} })).status).toBe(403);
    const c = await call(courses.POST as never, "POST", "/x", { session: teacher, body: { title: "Loi d'Ohm", domain: "Électricité", level: "pupil", lang: "fr", lessons: [{ title: "Intro", body: "U = R I" }], quiz: [{ q: "U = ?", choices: ["R×I", "R/I"], answer: 0 }, { q: "Unité de R", choices: ["Ω", "V"], answer: 0 }], pass_mark: 50, published: true } });
    const id = c.json.id as string;
    const view = await call(course.GET as never, "GET", "/x", { session: pupil, params: { id } });
    expect((view.json.quiz as { answer?: number }[])[0].answer).toBeUndefined();
    await call(enroll.POST as never, "POST", "/x", { session: pupil, params: { id } });
    const s = await call(submit.POST as never, "POST", "/x", { session: pupil, params: { id }, body: { answers: [0, 1] } });
    expect(s.json).toMatchObject({ score: 50, passed: true });
    const certId = (s.json.certificate as { id: string }).id;
    const v = await call(cert.GET as never, "GET", "/x", { params: { id: certId } });
    expect(v.json.valid).toBe(true);
  });
  it("concours : dépôt d'une version figée, jury humain, conflit d'intérêts refusé, classement", async () => {
    const ch = await call(eco.POST as never, "POST", "/x", { session: company, body: { kind: "challenge", title: "Défi solaire", sponsored: true, data: { description: "d", rules: "r", criteria: ["impact"], deadline: "2099-12-31", prizes: "p", sponsor: "S" } } });
    const id = ch.json.id as string;
    expect((await call(eco.POST as never, "POST", "/x", { session: pupil, body: { kind: "challenge", title: "Concours", data: {} } })).status).toBe(403);
    const p = await call(projects.POST as never, "POST", "/x", { session: tech, body: { title: "Prototype pompe" } });
    await call(ecoLinks.POST as never, "POST", "/x", { session: tech, params: { id }, body: { kind: "entry", data: { project_id: p.json.id, note: "" } } });
    await call(ecoLinks.POST as never, "POST", "/x", { session: company, params: { id }, body: { kind: "jury", data: { email: "prof@test.local", conflict_declared: false } } });
    await call(ecoLinks.POST as never, "POST", "/x", { session: company, params: { id }, body: { kind: "jury", data: { email: "tech@test.local", conflict_declared: false } } });
    const detail = await call(ecoItem.GET as never, "GET", "/x", { session: teacher, params: { id } });
    const entry = (detail.json.ranking as { entry_id: string }[])[0].entry_id;
    expect((await call(ecoLinks.POST as never, "POST", "/x", { session: tech, params: { id }, body: { kind: "score", data: { entry_id: entry, score: 20, comment: "" } } })).status).toBe(403);
    await call(ecoLinks.POST as never, "POST", "/x", { session: teacher, params: { id }, body: { kind: "score", data: { entry_id: entry, score: 14, comment: "bien" } } });
    const after = await call(ecoItem.GET as never, "GET", "/x", { session: pupil, params: { id } });
    expect((after.json.ranking as { average: number }[])[0].average).toBe(14);
    expect((after.json.item as { sponsored: boolean }).sponsored).toBe(true);
  });
});

describe("Gouvernance : liste blanche des agents", () => {
  it("un outil hors de la liste blanche des agents mobilisés est bloqué, même si le modèle l'appelle", async () => {
    const { askCore } = await import("@/server/ai/core");
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      const content = n === 1 ? [{ type: "tool_use", id: "t1", name: "propose_device_command", input: { device_id: "00000000-0000-4000-8000-000000000000", action: "pump_on", duration_s: 10, reason: "test" } }] : [{ type: "text", text: "ok" }];
      return new Response(JSON.stringify({ id: `m${n}`, type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason: n === 1 ? "tool_use" : "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const u = await (await import("@/server/api")).sessionUser(new Request("http://x", { headers: { cookie: pupil.cookie } }));
    const r = await askCore("Explique-moi le cours de mathématiques", { user: u!, fetchImpl });
    delete process.env.ANTHROPIC_API_KEY;
    expect(r.steps[0]).toMatchObject({ tool: "propose_device_command", status: "blocked" });
  });
});
