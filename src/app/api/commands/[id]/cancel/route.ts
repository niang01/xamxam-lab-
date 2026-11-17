import { ok, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireDevice } from "@/server/access";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const c = await sqlOne<{ device_id: string; status: string }>("SELECT device_id, status FROM device_commands WHERE id=$1", [id]);
  if (!c) throw new ApiFailure(404, "Commande introuvable", "err.notFound");
  await requireDevice(c.device_id, u, false);
  if (!["proposed", "confirmed"].includes(c.status)) throw new ApiFailure(409, `Commande non annulable (état : ${c.status})`, "cmd.state");
  await sql("UPDATE device_commands SET status=CASE WHEN status='proposed' THEN 'refused' ELSE 'cancelled' END WHERE id=$1", [id]);
  await audit(u.id, "human", "command.cancel", { kind: "device_command", id });
  return ok({ ok: true });
});
