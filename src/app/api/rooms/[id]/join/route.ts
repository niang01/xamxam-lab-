import { ok, endpoint, mustBeSignedIn, uuidParam, throttle } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { cleanupRoom, peers } from "@/server/rtc";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Rejoindre la salle du projet (membres uniquement) : renvoie l'identifiant de pair et les participants présents. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  throttle(req, "rtc-join", 20);
  await requireProject(id, u, "viewer");
  await cleanupRoom(id);
  const p = (await sql<{ id: string }>("INSERT INTO rtc_peers(project_id, user_id, display_name) VALUES ($1,$2,$3) RETURNING id", [id, u.id, u.display_name]))[0];
  await audit(u.id, "human", "meeting.join", { kind: "project", id });
  return ok({ peer_id: p.id, peers: (await peers(id)).filter((x) => x.id !== p.id) });
});
