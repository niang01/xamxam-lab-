/** Cours intégrés publiés dans l'Academy : visibles par tous, inscription, évaluation, certificat ; identifiants stables. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as courses from "@/app/api/courses/route";
import * as enroll from "@/app/api/courses/[id]/enroll/route";
import * as submit from "@/app/api/courses/[id]/submit/route";
import { BUILTIN_COURSES } from "@/lib/courses-builtin";
import { getDb, sql } from "@/server/db";
import { seed } from "@/server/seed";

let u: Session;
beforeAll(async () => { u = await register(registerRoute.POST as never, "eleve@test.local", "student"); });

describe("Cours intégrés", () => {
  it("les 12 cours sont publiés, signés « XAM-XAM LAB », en tête du catalogue", async () => {
    const r = await call(courses.GET as never, "GET", "/api/courses", { session: u });
    const items = r.json.items as { id: string; title: string; author: string; builtin: boolean; published: boolean }[];
    const built = items.filter((x) => x.builtin);
    expect(built).toHaveLength(12);
    expect(built.every((x) => x.author === "XAM-XAM LAB" && x.published)).toBe(true);
    expect(items[0].builtin).toBe(true);
  });
  it("inscription, quiz réussi et certificat ; re-chargement du contenu sans changer l'identifiant", async () => {
    const id = (await sql<{ id: string }>("SELECT id FROM courses WHERE builtin_key='automatisme-programmation'"))[0].id;
    expect((await call(enroll.POST as never, "POST", `/api/courses/${id}/enroll`, { session: u, params: { id } })).status).toBe(200);
    const answers = BUILTIN_COURSES.find((c) => c.key === "automatisme-programmation")!.quiz.map((q) => q.answer);
    const s = await call(submit.POST as never, "POST", `/api/courses/${id}/submit`, { session: u, params: { id }, body: { answers } });
    expect(s.json.score).toBe(100); expect(s.json.certificate).not.toBeNull();
    // Nouvelle version du contenu : mise à jour en place (inscription et certificat conservés)
    await sql("UPDATE server_keys SET value='ancienne' WHERE name='courses_version'");
    await seed(await getDb());
    expect((await sql<{ id: string }>("SELECT id FROM courses WHERE builtin_key='automatisme-programmation'"))[0].id).toBe(id);
    expect((await sql("SELECT 1 FROM certificates WHERE course_id=$1", [id]))).toHaveLength(1);
    expect((await sql<{ n: number }>("SELECT COUNT(*)::int AS n FROM courses WHERE builtin_key IS NOT NULL"))[0].n).toBe(12);
  });
});
