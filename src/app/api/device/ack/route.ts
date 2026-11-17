import { z } from "zod";
import { ok, readInput, endpoint } from "@/server/api";
import { acknowledge } from "@/server/iot";
import { requireDeviceToken } from "@/server/deviceAuth";

/** Accusé d'exécution : seule source autorisée pour déclarer une commande « exécutée ». */
export const POST = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  const b = await readInput(req, z.object({ id: z.string().uuid(), ok: z.boolean(), state: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).default({}) }));
  await acknowledge(d, b.id, b.ok, b.state);
  return ok({ ok: true });
});
