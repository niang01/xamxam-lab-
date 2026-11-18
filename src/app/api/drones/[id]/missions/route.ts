import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { createMission, requireDrone } from "@/server/drones";
import { waypoint } from "@/lib/drone";

type Ctx = { params: Promise<{ id: string }> };

/** Préparation de mission : validation (plafond, géorepérage, autonomie) et instantané des conditions prévues. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDrone(await uuidParam(ctx), u, true);
  const b = await readInput(req, z.object({ name: z.string().trim().min(2).max(100), waypoints: z.array(waypoint).min(1).max(100), home: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).nullable().default(null) }));
  return ok(await createMission(u, d, b.name, b.waypoints, b.home), 201);
});
