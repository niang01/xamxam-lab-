import { ok, endpoint } from "@/server/api";
import { closeSession } from "@/server/auth";

export const POST = endpoint(async () => {
  const res = ok({ ok: true });
  closeSession(res);
  return res;
});
