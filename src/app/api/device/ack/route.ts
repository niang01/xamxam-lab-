import { z } from "zod";
import { ok, readInput, endpoint } from "@/server/api";
import { sqlOne } from "@/server/db";
import { acknowledge } from "@/server/iot";
import { requireDeviceToken } from "@/server/deviceAuth";
import { onMissionAck } from "@/server/drones";

const value = z.union([z.string().max(500), z.number(), z.boolean(), z.null(), z.array(z.string().max(200)).max(10)]);

/** Accusé d'exécution : seule source autorisée pour déclarer une commande « exécutée ». */
export const POST = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  const b = await readInput(req, z.object({ id: z.string().uuid(), ok: z.boolean(), state: z.record(z.string().max(40), value).default({}) }));
  await acknowledge(d, b.id, b.ok, b.state);
  const c = await sqlOne<{ action: string; params: { mission_id?: string } }>("SELECT action, params FROM device_commands WHERE id=$1", [b.id]);
  if (c?.action === "mission_start") await onMissionAck(d, c.params, b.ok);
  return ok({ ok: true });
});
