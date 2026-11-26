import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as bank from "@/app/api/bank/route";
import * as bankItem from "@/app/api/bank/[id]/route";
import * as project from "@/app/api/projects/[id]/route";
import * as exercises from "@/app/api/exercises/route";
import * as exam from "@/app/api/exercises/exam/route";
import { makeExercise } from "@/lib/exercises";

let s: Session;
beforeAll(async () => { s = await register(registerRoute.POST as never, "banque@test.local", "student"); });

describe("Banque de projets (API)", () => {
  it("recherche, fiche avec code, favoris, réalisation en projet modifiable", async () => {
    const l = await call(bank.GET as never, "GET", "/api/bank?iot=1&filiere=agriculture", { session: s });
    const items = l.json.items as { id: string }[];
    expect(items.length).toBeGreaterThan(5);
    const id = items[0].id;
    const d = await call(bankItem.GET as never, "GET", "/x", { session: s, params: { id } });
    expect((d.json.code_source as { source: string }).source).toMatch(/#include <Arduino.h>/);
    expect(Object.keys(d.json.component_ids as object).length).toBe((d.json.components as unknown[]).length);
    await call(bankItem.POST as never, "POST", "/x", { session: s, params: { id }, body: { action: "favorite" } });
    expect(((await call(bank.GET as never, "GET", "/api/bank?favoris=1", { session: s })).json.items as unknown[]).length).toBe(1);
    const r = await call(bankItem.POST as never, "POST", "/x", { session: s, params: { id }, body: { action: "realise" } });
    expect(r.status).toBe(201);
    const p = await call(project.GET as never, "GET", "/x", { session: s, params: { id: r.json.id as string } });
    expect((p.json.project as { bank_id: string }).bank_id).toBe(id);
    expect((p.json.components as unknown[]).length).toBe((d.json.components as unknown[]).length);
    expect((p.json.tasks as unknown[]).length).toBeGreaterThan(5);
    expect((await call(bankItem.GET as never, "GET", "/x", { session: s, params: { id: "inexistant" } })).status).toBe(404);
  });
});

describe("Exercices et épreuves (API)", () => {
  it("énoncé sans corrigé, correction avec étapes, progression enregistrée", async () => {
    const q = await call(exercises.GET as never, "GET", "/api/exercises?template=puissance-tri&variant=5", { session: s });
    expect(q.json.answer).toBeUndefined(); expect(q.json.steps).toBeUndefined();
    const ex = makeExercise("puissance-tri", 5)!;
    const ok = await call(exercises.POST as never, "POST", "/x", { session: s, body: { template: "puissance-tri", variant: 5, answer: ex.answer.value } });
    expect(ok.json.correct).toBe(true); expect((ok.json.steps as string[]).join(" ")).toMatch(/√3/);
    await call(exercises.POST as never, "POST", "/x", { session: s, body: { template: "puissance-tri", variant: 5, answer: 1 } });
    const pr = (await call(exercises.GET as never, "GET", "/api/exercises", { session: s })).json.progress as { template: string; tries: number; correct: number }[];
    expect(pr.find((x) => x.template === "puissance-tri")).toEqual({ template: "puissance-tri", tries: 2, correct: 1 });
  });
  it("épreuve : note sur 20 calculée par le serveur", async () => {
    const e = await call(exam.GET as never, "GET", "/api/exercises/exam?seed=77&n=4", { session: s });
    const qs = e.json.questions as { id: string }[];
    const answers = qs.map((q, i) => { const [t, v] = q.id.split("#"); return i < 2 ? makeExercise(t, Number(v))!.answer.value : null; });
    const r = await call(exam.POST as never, "POST", "/x", { session: s, body: { seed: 77, n: 4, filiere: null, answers } });
    expect(r.json.score).toBe(10);
  });
});

import * as dossier from "@/app/api/bank/[id]/dossier/route";
describe("Banque : progression et dossier exporté", () => {
  it("en cours → terminé ; filtre ; dossier Word et PDF", async () => {
    const s = await register(registerRoute.POST as never, "progres@test.local");
    const id = (await import("@/lib/bank")).BANK[5].id;
    expect((await call(bankItem.POST as never, "POST", "/x", { session: s, params: { id }, body: { action: "en_cours" } })).status).toBe(200);
    expect((await call(bankItem.GET as never, "GET", "/x", { session: s, params: { id } })).json.progress).toBe("en_cours");
    await call(bankItem.POST as never, "POST", "/x", { session: s, params: { id }, body: { action: "termine" } });
    const l = await call(bank.GET as never, "GET", "/api/bank?progression=termine", { session: s });
    expect((l.json.items as { id: string }[]).map((x) => x.id)).toEqual([id]);
    expect((l.json.progress as { termine: number }).termine).toBe(1);
    const res = await (dossier.GET as unknown as (r: Request, c: unknown) => Promise<Response>)(new Request("http://localhost/x?format=docx", { headers: { cookie: s.cookie } }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200); expect(Buffer.from(await res.arrayBuffer()).subarray(0, 2).toString()).toBe("PK");
  });
});
