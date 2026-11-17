import { ok, endpoint, mustBeSignedIn, uuidParam } from "@/server/api";
import { confirmCommand } from "@/server/iot";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  await confirmCommand(await uuidParam(ctx), u);
  return ok({ ok: true });
});
