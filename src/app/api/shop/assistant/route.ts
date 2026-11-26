import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, throttle } from "@/server/api";
import { mareme } from "@/server/mareme";

/** Marème IA : réponses construites à partir du catalogue réel, des commandes de l'utilisateur et de ses études. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "mareme", 60);
  const b = await readInput(req, z.object({ message: z.string().trim().min(1).max(500), study: z.string().uuid().nullable().optional(), project: z.string().uuid().nullable().optional() }));
  return ok(await mareme(u, b.message, { study: b.study ?? null, project: b.project ?? null }));
});
