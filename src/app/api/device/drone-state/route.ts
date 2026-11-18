import { z } from "zod";
import { ok, readInput, endpoint, ApiFailure } from "@/server/api";
import { requireDeviceToken } from "@/server/deviceAuth";
import { saveState } from "@/server/drones";

const num = z.number().finite().nullable().optional();
const stateSchema = z.object({
  armed: z.boolean().nullable().optional(), mode: z.string().max(30).nullable().optional(),
  lat: num, lon: num, alt_rel_m: num, alt_msl_m: num, groundspeed_ms: num, heading_deg: num, battery_pct: num, battery_v: num,
  gps_fix: num, satellites: num, autopilot: z.string().max(60).nullable().optional(), vehicle: z.string().max(60).nullable().optional(),
  home: z.object({ lat: z.number(), lon: z.number(), alt_msl_m: num }).nullable().optional(),
  last_text: z.array(z.string().max(200)).max(10).optional(),
});

/** Télémétrie d'un drone transmise par le pont MAVLink (jeton de l'appareil). */
export const POST = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  if (d.hardware !== "drone") throw new ApiFailure(400, "Appareil non déclaré comme drone", "drone.err.notDrone");
  const { state } = await readInput(req, z.object({ state: stateSchema }));
  await saveState(d, state as Record<string, unknown>);
  return ok({ ok: true });
});
