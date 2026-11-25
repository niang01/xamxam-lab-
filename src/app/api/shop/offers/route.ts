import { ok, endpoint, mustBeSignedIn, ApiFailure } from "@/server/api";
import { sql } from "@/server/db";
import { requireProject } from "@/server/access";
import { offersFor } from "@/server/shop";
import { bankById } from "@/lib/bank";

/** Offres de la boutique pour chaque composant d'un projet de la banque (?bank=) ou d'un projet personnel (?project=). */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  let lines: { name: string; qty: number }[];
  if (sp.get("bank")) { const p = bankById(sp.get("bank")!); if (!p) throw new ApiFailure(404, "Projet introuvable", "err.notFound"); lines = p.components.map(([name, qty]) => ({ name, qty })); }
  else if (sp.get("project")) { await requireProject(sp.get("project")!, u, "viewer"); lines = await sql<{ name: string; qty: number }>("SELECT name, qty FROM project_components WHERE project_id=$1", [sp.get("project")]); }
  else throw new ApiFailure(400, "Paramètre bank ou project requis", "err.invalid");
  const offers = await offersFor(lines.map((l) => l.name));
  return ok({ lines: lines.map((l) => ({ ...l, offers: offers[l.name] ?? [] })) });
});
