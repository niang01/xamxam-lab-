/** Logiciels de dimensionnement : calcul serveur, tableau normatif, enregistrement, exports, projet, boutique, accès. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as studies from "@/app/api/studies/route";
import * as study from "@/app/api/studies/[id]/route";
import * as exportRoute from "@/app/api/studies/[id]/export/route";
import * as tables from "@/app/api/normative-tables/route";
import * as projects from "@/app/api/projects/route";
import * as bom from "@/app/api/projects/[id]/components/route";
import * as offers from "@/app/api/shop/offers/route";
import { ELECTRICAL } from "@/lib/studies/electrical";

const R = registerRoute.POST as never;
let admin: Session, user: Session, other: Session, tableId: string;

async function raw(h: unknown, url: string, s: Session, params: Record<string, string>) {
  const res = await (h as (r: Request, c: unknown) => Promise<Response>)(new Request(`http://localhost${url}`, { headers: { cookie: s.cookie } }), { params: Promise.resolve(params) });
  return { status: res.status, type: res.headers.get("content-type") ?? "", body: new Uint8Array(await res.arrayBuffer()) };
}

beforeAll(async () => {
  admin = await register(R, "admin@test.local");
  user = await register(R, "ingenieur@test.local");
  other = await register(R, "autre@test.local");
  // Tableau d'ESSAI saisi par l'administrateur (valeurs de test, pas une table normative réelle).
  const t = await call(tables.POST as never, "POST", "/x", { session: admin, body: { standard: "Tableau d'essai", table_ref: "T-test", description: "Valeurs de test", validated_by_name: "Test", rows: [{ s: 1.5, iz: 15 }, { s: 2.5, iz: 21 }, { s: 4, iz: 28 }, { s: 6, iz: 36 }] } });
  tableId = t.json.id as string;
});

describe("Études de dimensionnement", () => {
  it("liste des logiciels ; calcul sans tableau → donnée manquante ; avec tableau → résultats", async () => {
    const l = await call(studies.GET as never, "GET", "/x", { session: user });
    expect((l.json.software as { key: string }[]).map((s) => s.key)).toContain("installation-electrique");
    const without = await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "installation-electrique", input: ELECTRICAL.example } });
    expect((without.json.result as { missing: string[] }).missing.join()).toContain("tableau normatif");
    const r = await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "installation-electrique", input: ELECTRICAL.example, table_id: tableId } });
    const res = r.json.result as { ok: boolean; bom: unknown[]; references: string[] };
    expect(res.ok).toBe(true); expect(res.bom.length).toBeGreaterThan(5);
    expect(res.references.join()).toContain("Tableau d'essai — T-test");
    expect((await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "inconnu", input: {} } })).status).toBe(404);
    expect((await call(studies.POST as never, "POST", "/x", { session: null, body: { software: "installation-electrique", input: {} } })).status).toBe(401);
  });

  it("enregistrement, modification (nouveau calcul), exports Word/Excel/PDF/Markdown, accès réservé", async () => {
    const s = await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "installation-electrique", input: ELECTRICAL.example, table_id: tableId, save: true, title: "Villa R+1" } });
    expect(s.status).toBe(201);
    const id = s.json.id as string;
    const p = await call(study.PATCH as never, "PATCH", "/x", { session: user, params: { id }, body: { input: { ...ELECTRICAL.example, du_max: null } } });
    expect((p.json.result as { missing: string[] }).missing.join()).toContain("chute de tension maximale");
    await call(study.PATCH as never, "PATCH", "/x", { session: user, params: { id }, body: { input: ELECTRICAL.example } });
    const docx = await raw(exportRoute.GET, `/x?format=docx`, user, { id });
    expect(docx.status).toBe(200); expect(Buffer.from(docx.body.subarray(0, 2)).toString()).toBe("PK");
    const xlsx = await raw(exportRoute.GET, `/x?format=xlsx`, user, { id });
    expect(xlsx.type).toContain("spreadsheet");
    const pdf = await raw(exportRoute.GET, `/x?format=pdf`, user, { id });
    expect(Buffer.from(pdf.body.subarray(0, 5)).toString()).toBe("%PDF-");
    const md = await raw(exportRoute.GET, `/x?format=md`, user, { id });
    const text = Buffer.from(md.body).toString();
    expect(text).toContain("# Villa R+1"); expect(text).toContain("## 4. Nomenclature"); expect(text).toContain("Interrupteur différentiel");
    expect((await call(study.GET as never, "GET", "/x", { session: other, params: { id } })).status).toBe(404);
    expect((await raw(exportRoute.GET, `/x?format=md`, other, { id })).status).toBe(404);
  });

  it("nomenclature → projet (budget) et → offres de la boutique ; suppression", async () => {
    const s = await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "installation-electrique", input: ELECTRICAL.example, table_id: tableId, save: true, title: "Atelier" } });
    const id = s.json.id as string;
    const pr = await call(projects.POST as never, "POST", "/x", { session: user, body: { title: "Atelier de menuiserie" } });
    const pid = pr.json.id as string;
    expect((await call(study.POST as never, "POST", "/x", { session: other, params: { id }, body: { project_id: pid } })).status).toBe(404);
    const sent = await call(study.POST as never, "POST", "/x", { session: user, params: { id }, body: { project_id: pid } });
    expect(sent.status).toBe(201);
    const lines = (await call(bom.GET as never, "GET", "/x", { session: user, params: { id: pid } })).json.items as { name: string; component_id: string | null }[];
    expect(lines.find((l) => l.name === "Disjoncteur")?.component_id).toBeTruthy();
    const o = await call(offers.GET as never, "GET", `/api/shop/offers?study=${id}`, { session: user });
    expect((o.json.lines as { name: string; offers: unknown[] }[]).length).toBeGreaterThan(5);
    expect((await call(offers.GET as never, "GET", `/api/shop/offers?study=${id}`, { session: other })).status).toBe(404);
    expect((await call(study.DELETE as never, "DELETE", "/x", { session: user, params: { id } })).status).toBe(200);
    expect((await call(study.GET as never, "GET", "/x", { session: user, params: { id } })).status).toBe(404);
  });
});

import { searchPlaces } from "@/server/integrations/geo";
describe("Recherche de lieux (géocodage)", () => {
  it("réponse du service transformée ; échec signalé sans position inventée", async () => {
    const ok = (async () => new Response(JSON.stringify({ results: [{ name: "Thiès", admin1: "Thiès", country: "Sénégal", country_code: "SN", latitude: 14.7886, longitude: -16.926, elevation: 79 }] }), { status: 200 })) as unknown as typeof fetch;
    const r = await searchPlaces("Thi", "fr", ok);
    expect(r).toEqual([{ name: "Thiès", admin1: "Thiès", country: "Sénégal", country_code: "SN", lat: 14.7886, lon: -16.926, elevation: 79 }]);
    const ko = (async () => new Response("err", { status: 503 })) as unknown as typeof fetch;
    await expect(searchPlaces("Thi", "fr", ko)).rejects.toThrow("503");
    const empty = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    expect(await searchPlaces("zzz", "fr", empty)).toEqual([]);
  });
});

import * as chat from "@/app/api/ai/chat/route";
describe("Aláji IA avec le contexte d'une étude", () => {
  it("le résumé des résultats est fourni à Aláji ; étude d'un autre compte refusée", async () => {
    const s = await call(studies.POST as never, "POST", "/x", { session: user, body: { software: "installation-electrique", input: { ...ELECTRICAL.example, du_max: 1 }, table_id: tableId, save: true, title: "Étude pour Aláji" } });
    const r = await call(chat.POST as never, "POST", "/x", { session: user, body: { question: "Explique-moi les résultats", study_id: s.json.id, lang: "fr" } });
    expect(r.status).toBe(200);
    const answer = r.json.answer as string;
    expect(answer).toContain("Étude « Étude pour Aláji »"); expect(answer).toContain("Puissance appelée");
    expect((await call(chat.POST as never, "POST", "/x", { session: other, body: { question: "x", study_id: s.json.id, lang: "fr" } })).status).toBe(404);
  });
});
