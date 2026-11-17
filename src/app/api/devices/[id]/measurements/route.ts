import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice } from "@/server/access";
import { readingsSchema } from "@/server/schemas";
import { ingest } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, false);
  const sp = new URL(req.url).searchParams;
  const metric = sp.get("metric");
  const lim = z.coerce.number().int().min(1).max(5000).catch(500).parse(sp.get("limit"));
  const rows = await sql(`SELECT metric, ts, value, unit, quality, source FROM (SELECT * FROM measurements WHERE device_id=$1 AND ($2::text IS NULL OR metric=$2) ORDER BY ts DESC LIMIT $3) x ORDER BY ts ASC`, [d.id, metric, lim]);
  return ok({ items: rows });
});

/** Mesures relayées depuis le navigateur (Web Serial) par l'utilisateur connecté. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, true);
  const b = await readInput(req, readingsSchema);
  return ok(await ingest(d, b.readings, "web_serial"));
});
