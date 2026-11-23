import { describe, expect, it } from "vitest";
import { call, register } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as fromTemplate from "@/app/api/projects/from-template/route";
import * as bomLine from "@/app/api/projects/[id]/components/[cid]/route";
import * as project from "@/app/api/projects/[id]/route";
import * as diagrams from "@/app/api/diagrams/route";
import * as scenarios from "@/app/api/scenarios/route";
import * as assemblies from "@/app/api/assemblies/route";
import * as chat from "@/app/api/ai/chat/route";
import * as me from "@/app/api/me/route";
import { sql } from "@/server/db";

describe("Suppression du compte (droit à l'effacement)", () => {
  it("après utilisation de tous les espaces, le compte et ses données sont supprimés", async () => {
    const s = await register(registerRoute.POST as never, "efface@test.local", "student");
    const p = await call(fromTemplate.POST as never, "POST", "/api/projects/from-template", { session: s, body: { template_key: "irrigation-automatique", level: "projet_bts", title: "À effacer" } });
    const id = p.json.id as string;
    const pr = await call(project.GET as never, "GET", "/x", { session: s, params: { id } });
    const line = (pr.json.components as { id: string }[])[0].id;
    await call(bomLine.PATCH as never, "PATCH", "/x", { session: s, params: { id, cid: line }, body: { unit_price: 10 } });
    await call(diagrams.POST as never, "POST", "/api/diagrams", { session: s, body: { title: "d", project_id: id, graph: { discipline: "iot", blocks: [], wires: [], notes: [] } } });
    await call(scenarios.POST as never, "POST", "/api/scenarios", { session: s, body: { model: "tank", project_id: id, input: { volumeM3: 10, levelInitPct: 50, pumpFlowM3h: 3, pumpOnBelowPct: 30, pumpOffAbovePct: 95, demandM3h: 0.6, pumpHoursStart: 8, pumpHoursEnd: 17 } } });
    await call(assemblies.POST as never, "POST", "/api/assemblies", { session: s, body: { title: "a", graph: { parts: [] } } });
    await call(chat.POST as never, "POST", "/api/ai/chat", { session: s, body: { question: "calcul pump flowM3h=5 headM=30", lang: "fr" } });
    const r = await call(me.DELETE as never, "DELETE", "/api/me", { session: s });
    expect(r.json).toEqual({ ok: true });
    expect(r.status).toBe(200);
    expect((await sql("SELECT 1 FROM users WHERE email='efface@test.local'")).length).toBe(0);
    expect((await sql("SELECT 1 FROM projects WHERE title='À effacer'")).length).toBe(0);
  });

  it("suppression par l'administrateur : confirmation par l'adresse exigée, jamais son propre compte", async () => {
    const actions = await import("@/app/api/admin/users/[id]/actions/route");
    const admin = await register(registerRoute.POST as never, "admin@test.local");
    const v = await register(registerRoute.POST as never, "victime@test.local");
    await call(fromTemplate.POST as never, "POST", "/api/projects/from-template", { session: v, body: { template_key: "domotique", level: "projet_bts", title: "Tâches" } });
    const vid = (await sql<{ id: string }>("SELECT id FROM users WHERE email='victime@test.local'"))[0].id;
    const aid = (await sql<{ id: string }>("SELECT id FROM users WHERE email='admin@test.local'"))[0].id;
    expect((await call(actions.POST as never, "POST", "/x", { session: v, params: { id: aid }, body: { action: "delete_account", confirm_email: "admin@test.local" } })).status).toBe(403);
    expect((await call(actions.POST as never, "POST", "/x", { session: admin, params: { id: vid }, body: { action: "delete_account", confirm_email: "autre@test.local" } })).status).toBe(400);
    expect((await call(actions.POST as never, "POST", "/x", { session: admin, params: { id: aid }, body: { action: "delete_account", confirm_email: "admin@test.local" } })).status).toBe(400);
    expect((await call(actions.POST as never, "POST", "/x", { session: admin, params: { id: vid }, body: { action: "delete_account", confirm_email: "victime@test.local" } })).json).toEqual({ ok: true, deleted: true });
    expect((await sql("SELECT 1 FROM users WHERE id=$1", [vid])).length).toBe(0);
  });
});
