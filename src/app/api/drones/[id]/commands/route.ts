import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { proposeDroneCommand, requireDrone } from "@/server/drones";
import { DRONE_ACTIONS } from "@/lib/drone";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDrone(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ action: z.enum(DRONE_ACTIONS), params: z.record(z.string(), z.unknown()).default({}), reason: z.string().max(300).nullable().default(null), confirm: z.boolean().default(false) }));
  return ok(await proposeDroneCommand(u, d, b.action, b.params, b.reason, b.confirm), 201);
});
