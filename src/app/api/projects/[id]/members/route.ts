import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Inviter un utilisateur inscrit (par adresse) avec un rôle. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "owner");
  const b = await readInput(req, z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["editor", "commenter", "viewer"]) }));
  const target = await sqlOne<{ id: string }>("SELECT id FROM users WHERE email=$1 AND status='active'", [b.email]);
  if (!target) throw new ApiFailure(404, "Aucun compte avec cette adresse", "err.notFound");
  await sql(`INSERT INTO project_members(project_id, user_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id, user_id) DO UPDATE SET role=EXCLUDED.role`, [id, target.id, b.role]);
  const p = await sqlOne<{ title: string }>("SELECT title FROM projects WHERE id=$1", [id]);
  await notify(target.id, "project.invite", `Projet « ${p?.title} »`, `Vous avez été ajouté(e) comme ${b.role}.`, `/projects/${id}`);
  await audit(u.id, "human", "project.member.add", { kind: "project", id }, { member: target.id, role: b.role });
  return ok({ ok: true });
});

export const DELETE = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  await requireProject(id, u, "owner");
  const userId = z.string().uuid().parse(new URL(req.url).searchParams.get("user"));
  if (userId === u.id) throw new ApiFailure(400, "Le propriétaire ne peut pas se retirer", "err.forbidden");
  await sql("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 AND role<>'owner'", [id, userId]);
  await audit(u.id, "human", "project.member.remove", { kind: "project", id }, { member: userId });
  return ok({ ok: true });
});
