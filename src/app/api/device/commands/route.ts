import { ok, endpoint } from "@/server/api";
import { pickup } from "@/server/iot";
import { requireDeviceToken } from "@/server/deviceAuth";

/** L'appareil récupère ses commandes confirmées ; il applique ensuite ses propres limites matérielles. */
export const GET = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  return ok({ commands: await pickup(d), server_time: new Date().toISOString() });
});
