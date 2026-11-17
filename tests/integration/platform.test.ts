import { describe, expect, it, beforeAll } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as projects from "@/app/api/projects/route";
import * as project from "@/app/api/projects/[id]/route";
import * as members from "@/app/api/projects/[id]/members/route";
import * as calc from "@/app/api/calc/[kind]/route";
import * as simulate from "@/app/api/simulate/route";
import * as report from "@/app/api/projects/[id]/report/route";
import * as nt from "@/app/api/normative-tables/route";
import * as i18nImport from "@/app/api/i18n/import/route";
import * as catalog from "@/app/api/i18n/catalog/route";
import * as profileMe from "@/app/api/me/route";
import { verifyAuditChain } from "@/server/audit";
import { sql } from "@/server/db";

const R = registerRoute.POST as never;
let admin: Session, eng: Session, pupil: Session;

beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  eng = await register(R, "ing@test.local", "engineer");
  pupil = await register(R, "eleve@test.local", "pupil");
});

describe("Comptes", () => {
  it("administrateur uniquement par configuration ; jamais par formulaire", async () => {
    const a = await call(meRoute.GET as never, "GET", "/api/auth/me", { session: admin });
    expect((a.json.user as { is_admin: boolean }).is_admin).toBe(true);
    const r = await call(R, "POST", "/api/auth/register", { body: { email: "x@test.local", password: "motdepasse-123", display_name: "X", profile_kind: "administrator" } });
    expect(r.status).toBe(400);
    expect(((await call(meRoute.GET as never, "GET", "/api/auth/me", { session: eng })).json.user as { is_admin: boolean }).is_admin).toBe(false);
  });
  it("changement de mot de passe : sessions révoquées", async () => {
    const s = await register(R, "pw@test.local");
    const r = await call(profileMe.PATCH as never, "PATCH", "/api/me", { session: s, body: { password: { current: "motdepasse-123", next: "nouveau-mdp-456" } } });
    expect(r.status).toBe(200);
    expect((await call(meRoute.GET as never, "GET", "/api/auth/me", { session: s })).json.user).toBeNull();
  });
});

describe("Projets privés par défaut", () => {
  it("un non-membre ne voit pas le projet (introuvable)", async () => {
    const p = await call(projects.POST as never, "POST", "/api/projects", { session: eng, body: { title: "Pompage solaire" } });
    const id = p.json.id as string;
    expect((await call(project.GET as never, "GET", `/api/projects/${id}`, { session: pupil, params: { id } })).status).toBe(404);
    await call(members.POST as never, "POST", `/api/projects/${id}/members`, { session: eng, params: { id }, body: { email: "eleve@test.local", role: "viewer" } });
    expect((await call(project.GET as never, "GET", `/api/projects/${id}`, { session: pupil, params: { id } })).status).toBe(200);
    expect((await call(project.PATCH as never, "PATCH", `/api/projects/${id}`, { session: pupil, params: { id }, body: { title: "piraté" } })).status).toBe(403);
  });
});

describe("Calculs et simulation réelle", () => {
  it("calcul tracé dans le projet, paramètres manquants signalés", async () => {
    const p = await call(projects.POST as never, "POST", "/api/projects", { session: eng, body: { title: "Installation" } });
    const pid = p.json.id as string;
    const r = await call(calc.POST as never, "POST", "/api/calc/voltage_drop", { session: eng, params: { kind: "voltage_drop" }, body: { project_id: pid, input: { system: "three", u: 400, i: 30, lengthM: 50, sectionMm2: 6, conductor: "copper", tempC: 70, cosPhi: 0.8 } } });
    expect((r.json.result as { ok: boolean }).ok).toBe(false);
    const rows = await sql<{ missing: string[] }>("SELECT missing FROM calc_runs WHERE project_id=$1", [pid]);
    expect(rows[0].missing[0]).toMatch(/réactance/);
    expect((await call(calc.POST as never, "POST", "/api/calc/inconnu", { session: eng, params: { kind: "inconnu" }, body: { input: {} } })).status).toBe(404);
  });
  it("tableau normatif : saisie réservée à l'administrateur, puis utilisé", async () => {
    const body = { standard: "Norme X (édition test)", table_ref: "Tab. test", description: "pose test", validated_by_name: "Ing. Test", rows: [{ s: 1.5, iz: 18 }, { s: 2.5, iz: 25 }] };
    expect((await call(nt.POST as never, "POST", "/api/normative-tables", { session: eng, body })).status).toBe(403);
    const t = await call(nt.POST as never, "POST", "/api/normative-tables", { session: admin, body });
    const r = await call(calc.POST as never, "POST", "/api/calc/cable_section", { session: eng, params: { kind: "cable_section" }, body: { input: { inA: 20, correctionFactors: [1], tableId: t.json.id } } });
    expect((r.json.result as { outputs: { s: { value: number } } }).outputs.s.value).toBe(2.5);
  });
  it("ngspice : pont diviseur 5 V → 3,333 V, enregistré avec version et empreinte", async () => {
    const graph = { parts: [{ id: "V1", type: "V", x: 0, y: 0, rot: 0, value: "DC 5" }, { id: "R1", type: "R", x: 0, y: 0, rot: 0, value: "1k" }, { id: "R2", type: "R", x: 0, y: 0, rot: 0, value: "2k" }, { id: "G1", type: "GND", x: 0, y: 0, rot: 0, value: "" }],
      wires: [{ a: { part: "V1", pin: 0 }, b: { part: "R1", pin: 0 } }, { a: { part: "R1", pin: 1 }, b: { part: "R2", pin: 0 } }, { a: { part: "R2", pin: 1 }, b: { part: "G1", pin: 0 } }, { a: { part: "V1", pin: 1 }, b: { part: "G1", pin: 0 } }] };
    const r = await call(simulate.POST as never, "POST", "/api/simulate", { session: eng, body: { graph, analysis: { kind: "op" } } });
    expect(r.status).toBe(200);
    const traces = r.json.traces as { name: string; values: number[] }[];
    expect(traces.find((x) => x.name === "v(n2)")!.values[0]).toBeCloseTo(10 / 3, 6);
    expect(r.json.engine).toMatch(/ngspice-\d+/);
    const row = (await sql<{ engine_version: string; input_hash: string; kind: string }>("SELECT engine_version, input_hash, kind FROM simulations WHERE id=$1", [r.json.id]))[0];
    expect(row.kind).toBe("numerical_solver");
    expect(row.input_hash).toHaveLength(64);
    const tran = await call(simulate.POST as never, "POST", "/api/simulate", { session: eng, body: { graph: { ...graph, parts: graph.parts.map((p) => (p.id === "V1" ? { ...p, value: "PULSE(0 5 0 1u 1u 5m 10m)" } : p.id === "R2" ? { ...p, type: "C", value: "1u" } : p)) }, analysis: { kind: "tran", step: "10u", stop: "5m" } } });
    const vc = (tran.json.traces as { name: string; values: number[] }[]).find((x) => x.name === "v(n2)")!.values;
    expect(vc.at(-1)!).toBeCloseTo(5 * (1 - Math.exp(-5)), 1);
  }, 60000);
  it("ERC bloquant : la simulation n'est pas lancée", async () => {
    const r = await call(simulate.POST as never, "POST", "/api/simulate", { session: eng, body: { graph: { parts: [{ id: "R1", type: "R", x: 0, y: 0, rot: 0, value: "1k" }], wires: [] }, analysis: { kind: "op" } } });
    expect(r.status).toBe(422);
    expect(r.json.ok).toBe(false);
  });
  it("rapport : sections calculé / simulé / mesuré", async () => {
    const p = await call(projects.POST as never, "POST", "/api/projects", { session: eng, body: { title: "Rapport" } });
    const id = p.json.id as string;
    await call(calc.POST as never, "POST", "/api/calc/ohm", { session: eng, params: { kind: "ohm" }, body: { project_id: id, input: { u: 5, r: 10 } } });
    const r = await call(report.GET as never, "GET", `/api/projects/${id}/report`, { session: eng, params: { id } });
    expect((r.json.calcs as unknown[]).length).toBe(1);
    expect(r.json.measures).toEqual([]);
  });
});

describe("Traductions wolof", () => {
  it("import : cellules remplies validées, paramètres obligatoires, clés inconnues rejetées ; catalogue = validés seulement", async () => {
    const csv = "key;fr;en;wo;status\nc.save;Enregistrer;Save;TEXTE-WO-TEST;missing\nlang.fallbackBanner;x;x;sans paramètres;missing\ninconnu.cle;;;abc;missing\ngloss.transistor;;;transistor;missing";
    expect((await call(i18nImport.POST as never, "POST", "/api/i18n/import", { session: eng, body: { lang: "wo", format: "csv", content: csv, mode: "validated" } })).status).toBe(403);
    const r = await call(i18nImport.POST as never, "POST", "/api/i18n/import", { session: admin, body: { lang: "wo", format: "csv", content: csv, mode: "validated" } });
    expect(r.json.imported).toBe(2);
    expect((r.json.rejected as string[]).length).toBe(2);
    await call(i18nImport.POST as never, "POST", "/api/i18n/import", { session: admin, body: { lang: "wo", format: "json", content: JSON.stringify({ entries: [{ key: "c.cancel", text: "BROUILLON" }] }), mode: "draft" } });
    const cat = await call(catalog.GET as never, "GET", "/api/i18n/catalog?lang=wo");
    expect((cat.json.entries as Record<string, string>)["c.save"]).toBe("TEXTE-WO-TEST");
    expect((cat.json.entries as Record<string, string>)["c.cancel"]).toBeUndefined();
    const v = await sql<{ validated_by: string }>("SELECT validated_by FROM translations WHERE key='c.save'");
    expect(v[0].validated_by).toBe("Fichier importé par l'administrateur");
  });
});

describe("Audit", () => {
  it("chaîne d'empreintes intègre, et détection d'une altération", async () => {
    expect((await verifyAuditChain()).ok).toBe(true);
    await sql("UPDATE audit_log SET action='falsifié' WHERE id=(SELECT MIN(id) FROM audit_log)");
    const v = await verifyAuditChain();
    expect(v.ok).toBe(false);
    expect(v.brokenAt).not.toBeNull();
  });
});
