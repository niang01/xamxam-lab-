import { ok, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { requireDevice } from "@/server/access";
import { randomToken, sha256 } from "@/server/security/crypto";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Nouveau jeton : l'ancien cesse immédiatement de fonctionner. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const d = await requireDevice(await uuidParam(ctx), u, true);
  const token = randomToken();
  await sql("UPDATE devices SET token_hash=$2 WHERE id=$1", [d.id, sha256(token)]);
  await audit(u.id, "human", "device.token", { kind: "device", id: d.id });
  return ok({ token });
});
