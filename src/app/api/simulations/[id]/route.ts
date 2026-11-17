import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const s = await sqlOne<{ user_id: string; project_id: string | null }>("SELECT * FROM simulations WHERE id=$1", [id]);
  if (!s) throw new ApiFailure(404, "Simulation introuvable", "err.notFound");
  if (s.user_id !== u.id) { if (!s.project_id) throw new ApiFailure(404, "Simulation introuvable", "err.notFound"); await requireProject(s.project_id, u, "viewer"); }
  return ok(s);
});
