import { ok, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { loadCourse } from "@/server/courses";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  await sql("INSERT INTO enrollments(course_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [c.id, u.id]);
  return ok({ ok: true });
});
