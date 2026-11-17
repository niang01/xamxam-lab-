import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice } from "@/server/access";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const items = await sql(`SELECT s.*, d.name AS device_name, d.hardware, u.display_name AS pilot_name FROM rc_sessions s JOIN devices d ON d.id=s.device_id JOIN users u ON u.id=s.pilot_id
    WHERE s.pilot_id=$1 OR d.owner_id=$1 ORDER BY s.started_at DESC LIMIT 50`, [u.id]);
  return ok({ items });
});

/**
 * Ouverture d'une session : le mode est celui de l'appareil (virtuel, banc, réel) — une session ne change jamais de mode.
 * Banc : habilitation banc ou opération réelle. Réel : habilitation « opération réelle », référence d'autorisation
 * (et habilitation télépilote pour un drone). Check-list pré-opération entièrement cochée.
 */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({ device_id: z.string().uuid(), authorization_ref: z.string().trim().max(200).nullable().optional(), checklist: z.array(z.object({ item: z.string().max(200), checked: z.boolean() })).max(30) }));
  const d = await requireDevice(b.device_id, u, true);
  if (d.status !== "active") throw new ApiFailure(409, "Appareil désactivé", "rc.deviceDisabled");
  const missing: string[] = [];
  if (d.environment === "bench" && !u.clearances.includes("banc_essai") && !u.clearances.includes("operation_reelle")) missing.push("habilitation « banc d'essai »");
  if (d.environment === "real") {
    if (!u.clearances.includes("operation_reelle")) missing.push("habilitation « opération réelle »");
    if (!b.authorization_ref) missing.push("référence de l'autorisation d'opération");
    if (d.hardware === "drone" && !u.clearances.includes("telepilote_drone")) missing.push("habilitation « télépilote drone » (autorisation ANACIM)");
  }
  if (d.environment !== "virtual" && (!b.checklist.length || b.checklist.some((c) => !c.checked))) missing.push("check-list pré-opération complète");
  if (missing.length) throw new ApiFailure(403, `Session refusée : ${missing.join(" ; ")}`, "rc.refused", missing);
  const active = await sql("SELECT 1 FROM rc_sessions WHERE device_id=$1 AND status='active'", [d.id]);
  if (active.length) throw new ApiFailure(409, "Une session est déjà active sur cet appareil (un seul pilote à la fois)", "rc.busy");
  const s = (await sql<{ id: string }>("INSERT INTO rc_sessions(device_id, mode, pilot_id, authorization_ref, checklist) VALUES ($1,$2,$3,$4,$5) RETURNING id", [d.id, d.environment, u.id, b.authorization_ref ?? null, JSON.stringify(b.checklist)]))[0];
  await sql("INSERT INTO rc_events(session_id, kind, payload, actor_id) VALUES ($1,'start',$2,$3)", [s.id, JSON.stringify({ mode: d.environment }), u.id]);
  await audit(u.id, "human", "rc.start", { kind: "rc_session", id: s.id }, { device: d.id, mode: d.environment });
  return ok({ id: s.id }, 201);
});
