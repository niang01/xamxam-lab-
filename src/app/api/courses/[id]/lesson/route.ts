import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { loadCourse } from "@/server/courses";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const c = await loadCourse(await uuidParam(ctx), u);
  const b = await readInput(req, z.object({ index: z.number().int().min(0).max(c.lessons.length - 1) }));
  await sql(`INSERT INTO enrollments(course_id, user_id, lessons_done) VALUES ($1,$2,$3) ON CONFLICT (course_id, user_id)
    DO UPDATE SET lessons_done=(SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements(enrollments.lessons_done || EXCLUDED.lessons_done) v)`, [c.id, u.id, JSON.stringify([b.index])]);
  return ok({ ok: true });
});
