import { ok, readInput, endpoint, mustBeSignedIn, uuidParam, ApiFailure } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { ALLOWED_LINKS, linkSchema, type EcoKind } from "@/server/eco";
import { requireProject } from "@/server/access";
import { notify } from "@/server/settings";
import { audit } from "@/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = endpoint<Ctx>(async (req, ctx) => {
  const u = await mustBeSignedIn(req);
  const id = await uuidParam(ctx);
  const item = await sqlOne<{ kind: EcoKind; owner_id: string; status: string; title: string; data: { slots?: string[]; deadline?: string } }>("SELECT * FROM eco_items WHERE id=$1", [id]);
  if (!item || item.status === "hidden") throw new ApiFailure(404, "Élément introuvable", "err.notFound");
  const b = await readInput(req, linkSchema);
  if (!ALLOWED_LINKS[item.kind].includes(b.kind)) throw new ApiFailure(400, "Action non prévue pour ce contenu", "err.invalid");
  if (item.status === "closed" && b.kind !== "report") throw new ApiFailure(409, "Contenu clos", "eco.closed");
  let target = u.id; let status = "pending";
  switch (b.kind) {
    case "entry": {
      await requireProject(b.data.project_id, u, "owner");
      if (item.data.deadline && new Date() > new Date(`${item.data.deadline}T23:59:59Z`)) throw new ApiFailure(409, "Date limite dépassée", "eco.closed");
      // Version figée : instantané du projet au moment du dépôt.
      const snap = await sqlOne("SELECT title, description, problem, objectives, specs FROM projects WHERE id=$1", [b.data.project_id]);
      (b.data as Record<string, unknown>).snapshot = snap; status = "done"; break;
    }
    case "booking": if (!(item.data.slots ?? []).includes(b.data.slot)) throw new ApiFailure(400, "Créneau non proposé par le mentor", "err.invalid");
      if (await sqlOne("SELECT 1 FROM eco_links WHERE item_id=$1 AND kind='booking' AND data->>'slot'=$2 AND status IN ('pending','accepted')", [id, b.data.slot])) throw new ApiFailure(409, "Créneau déjà réservé", "eco.slotTaken"); break;
    case "score": {
      const jury = await sqlOne("SELECT 1 FROM eco_links WHERE item_id=$1 AND kind='jury' AND user_id=$2 AND status='accepted'", [id, u.id]);
      if (!jury) throw new ApiFailure(403, "Réservé aux membres du jury", "err.forbidden");
      const entry = await sqlOne<{ user_id: string }>("SELECT user_id FROM eco_links WHERE id=$1 AND item_id=$2 AND kind='entry'", [b.data.entry_id, id]);
      if (!entry) throw new ApiFailure(404, "Dossier introuvable", "err.notFound");
      if (entry.user_id === u.id) throw new ApiFailure(403, "Conflit d'intérêts : vous ne pouvez pas noter votre propre dossier", "eco.conflict");
      await sql("DELETE FROM eco_links WHERE item_id=$1 AND kind='score' AND user_id=$2 AND data->>'entry_id'=$3", [id, u.id, b.data.entry_id]);
      status = "done"; break;
    }
    case "jury": {
      if (item.owner_id !== u.id && !u.is_admin) throw new ApiFailure(403, "Réservé à l'organisateur", "err.forbidden");
      const j = await sqlOne<{ id: string }>("SELECT id FROM users WHERE email=$1", [b.data.email.toLowerCase()]);
      if (!j) throw new ApiFailure(404, "Aucun compte avec cette adresse", "err.notFound");
      target = j.id; status = "accepted"; break;
    }
  }
  const l = (await sql<{ id: string }>("INSERT INTO eco_links(item_id, user_id, kind, data, status) VALUES ($1,$2,$3,$4,$5) RETURNING id", [id, target, b.kind, JSON.stringify(b.data), status]))[0];
  if (b.kind === "report") {
    const n = (await sqlOne<{ n: number }>("SELECT COUNT(DISTINCT user_id)::int n FROM eco_links WHERE item_id=$1 AND kind='report'", [id]))?.n ?? 0;
    if (n >= 3) await sql("UPDATE eco_items SET status='hidden' WHERE id=$1", [id]);
    const admins = await sql<{ id: string }>("SELECT id FROM users WHERE is_admin");
    for (const a of admins) await notify(a.id, "moderation", `Signalement : ${item.title}`, b.data.reason.slice(0, 200), `/news?moderation=1`);
  } else if (b.kind !== "score") {
    await notify(b.kind === "jury" ? target : item.owner_id, `eco.${b.kind}`, `${item.title}`, `${u.display_name} : ${b.kind}`, null);
  }
  await audit(u.id, "human", `eco.link.${b.kind}`, { kind: "eco_item", id }, { link: l.id });
  return ok({ id: l.id }, 201);
});
