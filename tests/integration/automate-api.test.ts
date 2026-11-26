/** Programmes d'automate enregistrés : création, versions, accès limité à l'auteur, validation. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as plc from "@/app/api/plc/route";
import * as plcId from "@/app/api/plc/[id]/route";
import { LADDER_EXAMPLES, GRAFCET_EXAMPLES } from "@/lib/plc/examples";

let a: Session, b: Session;
beforeAll(async () => { a = await register(registerRoute.POST as never, "auto-a@test.local"); b = await register(registerRoute.POST as never, "auto-b@test.local"); });

describe("API des programmes d'automate", () => {
  it("enregistrement Ladder puis nouvelle version ; relecture identique", async () => {
    const prog = LADDER_EXAMPLES[1];
    const c = await call(plc.POST as never, "POST", "/api/plc", { session: a, body: { kind: "ladder", title: "Étoile-triangle atelier", program: prog } });
    expect(c.status).toBe(201);
    const id = c.json.id as string;
    const v2 = await call(plcId.PUT as never, "PUT", `/api/plc/${id}`, { session: a, params: { id }, body: { kind: "ladder", title: "Étoile-triangle atelier", program: { ...prog, rungs: prog.rungs.slice(0, 3) } } });
    expect(v2.json.version).toBe(2);
    const g = await call(plcId.GET as never, "GET", `/api/plc/${id}`, { session: a, params: { id } });
    expect(g.json.kind).toBe("ladder"); expect((g.json.program as { rungs: unknown[] }).rungs).toHaveLength(3); expect(g.json.versions).toHaveLength(2);
    const list = await call(plc.GET as never, "GET", "/api/plc", { session: a });
    expect((list.json.items as { id: string }[]).map((x) => x.id)).toContain(id);
    // un autre compte ne voit ni ne modifie le programme ; le type ne peut pas changer
    expect((await call(plcId.GET as never, "GET", `/api/plc/${id}`, { session: b, params: { id } })).status).toBe(404);
    expect((await call(plcId.PUT as never, "PUT", `/api/plc/${id}`, { session: a, params: { id }, body: { kind: "grafcet", title: "x", program: GRAFCET_EXAMPLES[0] } })).status).toBe(400);
    expect((await call(plcId.DELETE as never, "DELETE", `/api/plc/${id}`, { session: b, params: { id } })).status).toBe(404);
  });
  it("Grafcet enregistré ; programme invalide refusé", async () => {
    expect((await call(plc.POST as never, "POST", "/api/plc", { session: a, body: { kind: "grafcet", title: "Vérin", program: GRAFCET_EXAMPLES[0] } })).status).toBe(201);
    const bad = await call(plc.POST as never, "POST", "/api/plc", { session: a, body: { kind: "ladder", title: "x", program: { ...LADDER_EXAMPLES[0], rungs: [{ branches: [], out: { kind: "OUT", v: "Q1" } }] } } });
    expect(bad.status).toBe(400);
  });
});
