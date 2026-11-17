import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { requireProject } from "@/server/access";
import { cleanupRoom, peers } from "@/server/rtc";

type Ctx = { params: Promise<{ id: string }> };

async function myPeer(projectId: string, peerId: string, userId: string) {
  const p = await sqlOne("SELECT 1 FROM rtc_peers WHERE id=$1 AND project_id=$2 AND user_id=$3", [peerId, projectId, userId]);
  if (!p) throw new ApiFailure(404, "Participant introuvable (session de réunion expirée)", "rtc.gone");
}

/** Relevé : présence (battement), participants, messages adressés à ce pair après `after`. */
export const GET = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const sp = new URL(req.url).searchParams;
  const peer = z.string().uuid().parse(sp.get("peer"));
  const after = z.coerce.number().int().min(0).catch(0).parse(sp.get("after"));
  await requireProject(id, u, "viewer");
  await myPeer(id, peer, u.id);
  await sql("UPDATE rtc_peers SET last_seen=now() WHERE id=$1", [peer]);
  await cleanupRoom(id);
  const signals = await sql("SELECT id, from_peer, kind, payload FROM rtc_signals WHERE to_peer=$1 AND id > $2 ORDER BY id LIMIT 200", [peer, after]);
  return ok({ peers: (await peers(id)).filter((x) => x.id !== peer), signals });
});

/** Envoi d'une offre, d'une réponse ou d'un candidat ICE à un autre participant de la même salle. */
export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ from: z.string().uuid(), to: z.string().uuid(), kind: z.enum(["offer", "answer", "ice"]), payload: z.record(z.string(), z.unknown()) }));
  if (JSON.stringify(b.payload).length > 64_000) throw new ApiFailure(413, "Message de signalisation trop volumineux", "err.invalid");
  await requireProject(id, u, "viewer");
  await myPeer(id, b.from, u.id);
  if (!(await sqlOne("SELECT 1 FROM rtc_peers WHERE id=$1 AND project_id=$2", [b.to, id]))) throw new ApiFailure(404, "Destinataire absent", "rtc.gone");
  await sql("INSERT INTO rtc_signals(project_id, from_peer, to_peer, kind, payload) VALUES ($1,$2,$3,$4,$5)", [id, b.from, b.to, b.kind, JSON.stringify(b.payload)]);
  return ok({ ok: true });
});
