import crypto from "node:crypto";
import { ok, endpoint, uuidParam, ApiFailure } from "@/server/api";
import { sqlOne } from "@/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** Vérification publique d'un certificat : recalcul de l'empreinte à partir des données enregistrées. */
export const GET = endpoint<Ctx>(async (_req, ctx) => {
  const id = await uuidParam(ctx);
  const r = await sqlOne<{ course_id: string; title: string; user_id: string; display_name: string; score: number; issued_at: string | Date; digest: string }>(
    "SELECT c.course_id, k.title, c.user_id, u.display_name, c.score, c.issued_at, c.digest FROM certificates c JOIN courses k ON k.id=c.course_id JOIN users u ON u.id=c.user_id WHERE c.id=$1", [id]);
  if (!r) throw new ApiFailure(404, "Certificat introuvable", "err.notFound");
  const issued = new Date(r.issued_at).toISOString();
  const valid = crypto.createHash("sha256").update(JSON.stringify([r.course_id, r.user_id, r.score, issued])).digest("hex") === r.digest;
  return ok({ id, course: r.title, holder: r.display_name, score: r.score, issued_at: issued, digest: r.digest, valid });
});
