import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { iceServers } from "@/server/rtc";

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const servers = iceServers();
  return ok({ iceServers: servers, relay: servers.some((s) => s.username), note: servers.length ? null : "Aucun serveur STUN/TURN configuré : appels possibles uniquement au sein d'un même réseau local." });
});
