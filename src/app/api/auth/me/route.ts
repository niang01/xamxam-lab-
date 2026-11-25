import { ok, endpoint, sessionUser } from "@/server/api";
import { ensureDeviceCookie, publicUser } from "@/server/auth";
import { cachedEntitlement } from "@/server/licensing";
import { announceAdminSetup } from "@/server/accounts";

export const GET = endpoint(async (req) => {
  const u = await sessionUser(req);
  void announceAdminSetup().catch(() => undefined);
  if (!u) return ok({ user: null });
  const e = await cachedEntitlement(u.id, u.is_admin);
  // Sessions ouvertes avant la gestion des appareils : l'identifiant d'appareil est attribué ici.
  const res = ok({ user: { ...publicUser(u), access: { state: e.state, allowed: e.allowed, trial_ends_at: e.trial?.ends_at ?? null, days_left: e.licence?.days_left ?? e.trial?.days_left ?? null } } });
  ensureDeviceCookie(res, req);
  return res;
});
