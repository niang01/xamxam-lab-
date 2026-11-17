import { ok, endpoint } from "@/server/api";
import { requireDeviceToken } from "@/server/deviceAuth";

/** Identité de l'appareil porteur du jeton (utilisée par la passerelle MQTT pour authentifier une connexion). */
export const GET = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  return ok({ id: d.id, name: d.name, environment: d.environment });
});
