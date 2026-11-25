import { ok, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { bankInventory, searchBank } from "@/lib/bank";
import { BANK_LEVELS } from "@/lib/bank/types";
import { FILIERES } from "@/lib/library";

/** Recherche dans la banque de projets (résumés) + inventaire + favoris de l'utilisateur. */
export const GET = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const iot = sp.get("iot");
  const items = searchBank({ q: sp.get("q") ?? "", filiere: sp.get("filiere") ?? "", level: sp.get("level") ?? "", iot: iot === "1" ? true : iot === "0" ? false : undefined, component: sp.get("composant") ?? "" });
  const favs = new Set((await sql<{ bank_id: string }>("SELECT bank_id FROM bank_favorites WHERE user_id=$1", [u.id])).map((r) => r.bank_id));
  const onlyFav = sp.get("favoris") === "1";
  return ok({
    inventory: bankInventory(), filieres: FILIERES.map((f) => ({ key: f.key, label: f.label })), levels: BANK_LEVELS,
    items: items.filter((p) => !onlyFav || favs.has(p.id)).map((p) => ({ id: p.id, title: p.title, filiere: p.filiere, domain: p.domain, level: p.level, iot: p.iot, components: p.components.length, code: !!p.code, favorite: favs.has(p.id) })),
  });
});
