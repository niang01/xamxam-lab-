import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { automationSpec, dryRun } from "@/lib/automation";

type Ctx = { params: Promise<{ id: string }> };

/** Essai à blanc : rejoue l'historique RÉEL (mesures valides) et montre ce qui aurait été déclenché. Aucune action. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const a = await sqlOne<{ spec: unknown; owner_id: string }>("SELECT spec, owner_id FROM automations WHERE id=$1", [id]);
  if (!a || a.owner_id !== u.id) throw new ApiFailure(404, "Scénario introuvable", "err.notFound");
  const s = automationSpec.parse(a.spec);
  const hist = await sql<{ ts: string; value: number; quality: string }>("SELECT ts, value, quality FROM measurements WHERE device_id=$1 AND metric=$2 AND quality='valid' ORDER BY ts DESC LIMIT 2000", [s.trigger.device_id, s.trigger.metric]);
  const fired = dryRun(s, hist.map((h) => ({ ts: new Date(h.ts).toISOString(), value: h.value, quality: h.quality })));
  const report = { at: new Date().toISOString(), readings: hist.length, fired: fired.length, samples: fired.slice(-20) };
  await sql("UPDATE automations SET dry_run=$2 WHERE id=$1", [id, JSON.stringify(report)]);
  return ok(report);
});
