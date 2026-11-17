import { ok, endpoint, sessionUser } from "@/server/api";
import { publicUser } from "@/server/auth";

export const GET = endpoint(async (req) => {
  const u = await sessionUser(req);
  return ok({ user: u ? publicUser(u) : null });
});
