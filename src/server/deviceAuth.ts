import { ApiFailure, throttle } from "./api";
import { deviceByToken } from "./iot";

/** Authentification d'un appareil : en-tête « Authorization: Bearer <jeton> ». */
export async function requireDeviceToken(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  throttle(req, "device", 240);
  const d = await deviceByToken(token);
  if (!d) throw new ApiFailure(401, "Jeton d'appareil invalide ou appareil désactivé", "iot.badToken");
  return d;
}
