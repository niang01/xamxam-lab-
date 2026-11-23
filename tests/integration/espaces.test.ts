import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as components from "@/app/api/components/route";
import * as fromTemplate from "@/app/api/projects/from-template/route";
import * as project from "@/app/api/projects/[id]/route";
import * as bom from "@/app/api/projects/[id]/components/route";
import * as bomLine from "@/app/api/projects/[id]/components/[cid]/route";
import * as exportRoute from "@/app/api/projects/[id]/export/route";
import * as diagrams from "@/app/api/diagrams/route";
import * as diagram from "@/app/api/diagrams/[id]/route";
import * as scenarios from "@/app/api/scenarios/route";
import * as assemblies from "@/app/api/assemblies/route";

let s: Session, other: Session;
beforeAll(async () => { s = await register(registerRoute.POST as never, "espaces@test.local", "student"); other = await register(registerRoute.POST as never, "autre-espaces@test.local", "student"); });

describe("Bibliothèque en base", () => {
  it("composants par discipline avec paramètres ; anciens noms renommés sans doublon", async () => {
    const r = await call(components.GET as never, "GET", "/api/components?q=", { session: s });
    const items = r.json.items as { name: string; discipline: string | null; params: unknown[] }[];
    expect(items.length).toBeGreaterThanOrEqual(120);
    expect((r.json.disciplines as unknown[]).length).toBe(12);
    expect(items.filter((c) => c.name === "Diode").length).toBe(1);
    expect(items.some((c) => c.name === "Diode (modèle générique)")).toBe(false);
    expect(items.find((c) => c.name === "Module photovoltaïque")!.params.length).toBeGreaterThan(3);
    const hyd = await call(components.GET as never, "GET", "/api/components?q=&discipline=hydraulique", { session: s });
    expect((hyd.json.items as { discipline: string }[]).every((c) => c.discipline === "hydraulique")).toBe(true);
  });
});

describe("Projets structurés", () => {
  let id = "";
  it("création depuis un modèle : sections, nomenclature liée à la bibliothèque, tâches du niveau", async () => {
    const r = await call(fromTemplate.POST as never, "POST", "/api/projects/from-template", { session: s, body: { template_key: "irrigation-automatique", level: "startup", title: "Irrigation pilote" } });
    expect(r.status).toBe(201); id = r.json.id as string;
    const p = await call(project.GET as never, "GET", "/x", { session: s, params: { id } });
    const pr = p.json.project as Record<string, string>;
    expect(pr.kind).toBe("startup"); expect(pr.level).toBe("startup"); expect(pr.methodology).toMatch(/MVP/); expect(pr.specs).toMatch(/\[à compléter\]/);
    const comps = p.json.components as { name: string; component_id: string | null; unit_price: number | null }[];
    expect(comps.length).toBe(13); expect(comps.every((c) => c.component_id)).toBe(true); expect(comps.every((c) => c.unit_price === null)).toBe(true);
    expect((p.json.tasks as { title: string }[]).map((t) => t.title)).toContain("Entretiens clients");
    expect((await call(project.GET as never, "GET", "/x", { session: other, params: { id } })).status).toBe(404);
  });
  it("budget : prix saisis, total par devise, total incomplet signalé ; export rapport et présentation", async () => {
    const lines = (await call(bom.GET as never, "GET", "/x", { session: s, params: { id } })).json.items as { id: string; name: string }[];
    expect((await call(bomLine.PATCH as never, "PATCH", "/x", { session: s, params: { id, cid: lines[0].id }, body: { unit_price: 250000 } })).status).toBe(200);
    expect((await call(bom.POST as never, "POST", "/x", { session: s, params: { id }, body: { items: [{ name: "Main d'œuvre", qty: 2, unit_price: 15000 }] } })).status).toBe(201);
    const b = await call(bom.GET as never, "GET", "/x", { session: s, params: { id } });
    expect(String(b.json.budget_markdown)).toMatch(/\*\*Total\*\* : 280000 XOF — 12 article\(s\) sans prix/);
    expect((await call(bomLine.PATCH as never, "PATCH", "/x", { session: other, params: { id, cid: lines[0].id }, body: { unit_price: 1 } })).status).toBe(404);
    await call(project.PATCH as never, "PATCH", "/x", { session: s, params: { id }, body: { results: "Débit mesuré : [à compléter]" } });
    const md = await call(exportRoute.GET as never, "GET", `/api/projects/${id}/export?format=md`, { session: s, params: { id } });
    expect(md.headers.get("content-type")).toMatch(/text\/markdown/);
    expect(String(md.json)).toMatch(/## 8\. Budget prévisionnel/); expect(String(md.json)).toMatch(/Débit mesuré/);
    const slides = await call(exportRoute.GET as never, "GET", `/api/projects/${id}/export?format=slides`, { session: s, params: { id } });
    expect(String(slides.json)).toMatch(/^---\nmarp: true/); expect((String(slides.json).match(/\n---\n/g) ?? []).length).toBeGreaterThanOrEqual(9);
  });
});

describe("Schémas 2D, scénarios 4D, maquettes 3D (API)", () => {
  it("schéma : création, version, export SVG, accès refusé à un tiers, schéma invalide refusé", async () => {
    const graph = { discipline: "iot", blocks: [{ id: "a", name: "Carte ESP32", symbol: "MCU", label: "MCU1", pins: ["3V3", "GND"], x: 0, y: 0, rot: 0, params: {} }], wires: [], notes: [] };
    const c = await call(diagrams.POST as never, "POST", "/api/diagrams", { session: s, body: { title: "Câblage", graph } });
    expect(c.status).toBe(201); const id = c.json.id as string;
    expect((await call(diagram.PUT as never, "PUT", "/x", { session: s, params: { id }, body: { title: "Câblage v2", graph: { ...graph, notes: [{ x: 0, y: 0, text: "ok" }] } } })).json.version).toBe(2);
    const svg = await call(diagram.GET as never, "GET", `/api/diagrams/${id}?format=svg`, { session: s, params: { id } });
    expect(svg.headers.get("content-type")).toMatch(/image\/svg\+xml/); expect(String(svg.json)).toContain("MCU1");
    expect((await call(diagram.GET as never, "GET", "/x", { session: other, params: { id } })).status).toBe(404);
    expect((await call(diagrams.POST as never, "POST", "/api/diagrams", { session: s, body: { title: "x", graph: { blocks: [{ id: "a" }], wires: [] } } })).status).toBe(400);
  });
  it("scénario 4D exécuté et enregistré ; paramètre manquant → échec signalé, aucune valeur devinée", async () => {
    const r = await call(scenarios.POST as never, "POST", "/api/scenarios", { session: s, body: { model: "tank", input: { volumeM3: 10, levelInitPct: 50, pumpFlowM3h: 3, pumpOnBelowPct: 30, pumpOffAbovePct: 95, demandM3h: 0.6, pumpHoursStart: 8, pumpHoursEnd: 17, days: 1 } } });
    expect(r.status).toBe(200); expect(r.json.missing).toEqual([]); expect((r.json.balance as { residual: number }).residual).toBeLessThan(1e-9);
    const m = await call(scenarios.POST as never, "POST", "/api/scenarios", { session: s, body: { model: "cold_room", input: { uaWK: 20 } } });
    expect((m.json.missing as string[])).toContain("coolingW"); expect(m.json.series).toBeNull();
  });
  it("maquette 3D enregistrée (versions) ; forme inconnue refusée", async () => {
    const part = { id: "p1", name: "Socle", shape: "box", dims: [400, 300, 20], pos: [0, 0, 10], rot: [0, 0, 0], color: "#22e3ff", density: 2700, hollow: false };
    expect((await call(assemblies.POST as never, "POST", "/api/assemblies", { session: s, body: { title: "Coffret", graph: { parts: [part] } } })).status).toBe(201);
    expect((await call(assemblies.POST as never, "POST", "/api/assemblies", { session: s, body: { title: "x", graph: { parts: [{ ...part, shape: "cone" }] } } })).status).toBe(400);
    expect(((await call(assemblies.GET as never, "GET", "/api/assemblies", { session: s })).json.items as unknown[]).length).toBe(1);
  });
});
