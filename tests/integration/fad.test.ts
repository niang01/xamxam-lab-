import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as courses from "@/app/api/courses/route";
import * as enroll from "@/app/api/courses/[id]/enroll/route";
import * as resources from "@/app/api/courses/[id]/resources/route";
import * as resource from "@/app/api/fad/resources/[rid]/route";
import * as assignments from "@/app/api/courses/[id]/assignments/route";
import * as assignment from "@/app/api/fad/assignments/[aid]/route";
import * as submission from "@/app/api/fad/submissions/[sid]/route";
import * as me from "@/app/api/fad/me/route";
import { toPdf } from "@/lib/docs/export";

let teacher: Session, learner: Session, outsider: Session, courseId = "";
type H = (r: Request, c: unknown) => Promise<Response>;
const multipart = async (h: unknown, session: Session, params: Record<string, string>, fields: Record<string, string | File>) => {
  const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await (h as H)(new Request("http://localhost/x", { method: "POST", body: fd, headers: { cookie: session.cookie } }), { params: Promise.resolve(params) });
  return { status: r.status, json: await r.json() as Record<string, unknown> };
};

beforeAll(async () => {
  teacher = await register(registerRoute.POST as never, "formateur@test.local", "teacher");
  learner = await register(registerRoute.POST as never, "apprenant@test.local", "student");
  outsider = await register(registerRoute.POST as never, "externe@test.local", "student");
  const c = await call(courses.POST as never, "POST", "/x", { session: teacher, body: { title: "Installations électriques", domain: "Électricité", level: "student", lang: "fr", lessons: [{ title: "Sécurité", body: "…", module: "Module 1" }, { title: "Protections", body: "…", module: "Module 1" }], quiz: [], published: true } });
  courseId = c.json.id as string;
});

describe("FAD", () => {
  it("ressources : documents contrôlés et liens vidéo ; accès réservé aux inscrits et au formateur", async () => {
    const pdf = new File([toPdf("Cours", "Contenu") as BlobPart], "cours.pdf");
    expect((await multipart(resources.POST, learner, { id: courseId }, { title: "Pirate", file: pdf })).status).toBe(403);
    expect((await multipart(resources.POST, teacher, { id: courseId }, { title: "Faux PDF", file: new File(["bonjour"], "faux.pdf") })).json.error).toMatch(/ne correspond pas/);
    expect((await multipart(resources.POST, teacher, { id: courseId }, { title: "Script", file: new File(["x"], "virus.exe") })).status).toBe(400);
    const ok = await multipart(resources.POST, teacher, { id: courseId }, { title: "Support de cours", file: pdf });
    expect(ok.status).toBe(201);
    expect((await multipart(resources.POST, teacher, { id: courseId }, { title: "Vidéo", url: "http://non-securise" })).status).toBe(400);
    expect((await multipart(resources.POST, teacher, { id: courseId }, { title: "Vidéo", url: "https://exemple.org/video" })).status).toBe(201);
    expect((await call(resources.GET as never, "GET", "/x", { session: outsider, params: { id: courseId } })).status).toBe(403);
    await call(enroll.POST as never, "POST", "/x", { session: learner, params: { id: courseId }, body: {} });
    const list = await call(resources.GET as never, "GET", "/x", { session: learner, params: { id: courseId } });
    expect((list.json.items as unknown[]).length).toBe(2);
    const dl = await (resource.GET as never as H)(new Request("http://x", { headers: { cookie: learner.cookie } }), { params: Promise.resolve({ rid: ok.json.id }) });
    expect(dl.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(new Uint8Array(await dl.arrayBuffer()).slice(0, 5))).toBe("%PDF-");
  });

  it("devoir : remise avec fichier, retard signalé, correction bornée au barème, pas de remise après correction", async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    const a = await call(assignments.POST as never, "POST", "/x", { session: teacher, params: { id: courseId }, body: { kind: "tp", title: "TP disjoncteur", instructions: "Rédiger le compte rendu", due_at: past, max_points: 20 } });
    const aid = a.json.id as string;
    expect((await call(assignments.POST as never, "POST", "/x", { session: learner, params: { id: courseId }, body: { kind: "tp", title: "x", instructions: "xxxxx" } })).status).toBe(403);
    expect((await multipart(assignment.POST, outsider, { aid }, { text: "copie" })).status).toBe(403);
    const sub = await multipart(assignment.POST, learner, { aid }, { text: "Compte rendu", file: new File([toPdf("CR", "...") as BlobPart], "cr.pdf") });
    expect(sub.status).toBe(201); expect(sub.json.late).toBe(true);
    const subs = await call(assignment.GET as never, "GET", "/x", { session: teacher, params: { aid } });
    const sid = (subs.json.items as { id: string }[])[0].id;
    expect((await call(assignment.GET as never, "GET", "/x", { session: learner, params: { aid } })).status).toBe(403);
    expect((await call(submission.POST as never, "POST", "/x", { session: teacher, params: { sid }, body: { grade: 25 } })).status).toBe(400);
    expect((await call(submission.POST as never, "POST", "/x", { session: learner, params: { sid }, body: { grade: 20 } })).status).toBe(403);
    expect((await call(submission.POST as never, "POST", "/x", { session: teacher, params: { sid }, body: { grade: 15.5, feedback: "Bon travail" } })).status).toBe(200);
    expect((await multipart(assignment.POST, learner, { aid }, { text: "nouvelle version" })).json.key).toBe("fad.err.graded");
    const mine = (await call(me.GET as never, "GET", "/x", { session: learner })).json as { courses: { done: number; lessons: number }[]; grades: { grade: number; feedback: string }[] };
    expect(mine.courses[0].lessons).toBe(2); expect(mine.grades[0]).toMatchObject({ grade: 15.5, feedback: "Bon travail" });
    const dl = await (submission.GET as never as H)(new Request("http://x", { headers: { cookie: outsider.cookie } }), { params: Promise.resolve({ sid }) });
    expect(dl.status).toBe(403);
  });
});
