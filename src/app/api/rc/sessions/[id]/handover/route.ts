import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { notify } from "@/server/settings";

type Ctx = { params: Promise<{ id: string }> };

/** Transfert de contrôle vers un autre pilote disposant des mêmes habilitations requises (journalisé). */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  const s = await sqlOne<{ pilot_id: string; status: string; mode: string; device_id: string }>("SELECT * FROM rc_sessions WHERE id=$1", [id]);
  if (!s || s.pilot_id !== u.id || s.status !== "active") throw new ApiFailure(404, "Session active introuvable", "err.notFound");
  const target = await sqlOne<{ id: string; clearances: string[] }>(`SELECT u.id, COALESCE((SELECT json_agg(kind) FROM clearances c WHERE c.user_id=u.id AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_DATE)),'[]') clearances FROM users u WHERE email=$1 AND status='active'`, [b.email]);
  if (!target) throw new ApiFailure(404, "Pilote introuvable", "err.notFound");
  const need = s.mode === "real" ? ["operation_reelle"] : s.mode === "bench" ? [] : [];
  if (s.mode === "bench" && !target.clearances.some((c) => c === "banc_essai" || c === "operation_reelle")) throw new ApiFailure(403, "Le pilote désigné n'a pas l'habilitation « banc d'essai »", "rc.refused");
  if (need.some((c) => !target.clearances.includes(c))) throw new ApiFailure(403, "Le pilote désigné n'a pas les habilitations requises", "rc.refused");
  await sql("UPDATE rc_sessions SET pilot_id=$2 WHERE id=$1", [id, target.id]);
  await sql("INSERT INTO rc_events(session_id, kind, payload, actor_id) VALUES ($1,'handover',$2,$3)", [id, JSON.stringify({ to: target.id }), u.id]);
  await notify(target.id, "rc.handover", "Contrôle transféré", "Vous êtes désormais le pilote responsable de la session.", "/remote");
  await audit(u.id, "human", "rc.handover", { kind: "rc_session", id }, { to: target.id });
  return ok({ ok: true });
});
