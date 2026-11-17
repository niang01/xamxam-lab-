import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { requireDevice } from "@/server/access";
import { ingest } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Mesures SIMULÉES (démonstration) : marquées « simulated », affichées comme telles, exclues des rapports
 * mesurés et ne déclenchant aucune automatisation. Les valeurs sont celles fournies par l'utilisateur.
 */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ metric: z.string().regex(/^[a-z0-9_.-]{1,40}$/i), unit: z.string().max(20).nullable().optional(), values: z.array(z.number().finite()).min(1).max(500), interval_s: z.number().int().min(1).max(86400) }));
  const now = Date.now();
  const readings = b.values.map((v, i) => ({ metric: b.metric, value: v, unit: b.unit ?? null, ts: new Date(now - (b.values.length - 1 - i) * b.interval_s * 1000).toISOString() }));
  return ok(await ingest(d, readings, "simulator"));
});
