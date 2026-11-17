import { z } from "zod";
import { ok, readInput, endpoint, mustBeAdmin, uuidParam } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Vérification d'un composant (administrateur) : contrôle des caractéristiques contre la fiche technique. */
export const PATCH = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeAdmin(req);
  const id = await uuidParam(ctx);
  const b = await readInput(req, z.object({ status: z.enum(["verified", "to_verify"]) }));
  await sql("UPDATE components SET status=$1 WHERE id=$2 AND status<>'generic'", [b.status, id]);
  await audit(u.id, "human", "component.status", { kind: "component", id }, { status: b.status });
  return ok({ ok: true });
});
