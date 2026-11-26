import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn, ApiFailure, throttle } from "@/server/api";
import { sql, sqlOne } from "@/server/db";
import { audit } from "@/server/audit";
import { importRows, IMPORT_COLUMNS } from "@/lib/shop-import";

/** Modèle de fichier CSV. */
export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const body = `${IMPORT_COLUMNS.join(";")}\n`;
  return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="modele-import-boutique.csv"' } });
});

/** Import (ou vérification avec dry_run) d'un fichier CSV de produits par un vendeur inscrit. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  throttle(req, "shop-import", 10, 60 * 60_000);
  const b = await readInput(req, z.object({ csv: z.string().max(2_000_000), dry_run: z.boolean().default(true) }));
  if (!(await sqlOne("SELECT 1 FROM shop_vendors WHERE user_id=$1", [u.id]))) throw new ApiFailure(409, "Créez d'abord votre profil vendeur (onglet Vendeur)", "shop.err.vendor");
  const r = importRows(b.csv);
  if (r.header_errors.length) throw new ApiFailure(400, r.header_errors.join(" ; "), "err.invalid");
  let created = 0;
  if (!b.dry_run) {
    for (const l of r.lines) {
      if (!l.ok || !l.listing) continue;
      const x = l.listing;
      await sql(`INSERT INTO market_listings(seller_id, title, description, category, condition, price_xof, quantity, delivery, specs, status, shop_section, datasheet_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10,$11)`,
        [u.id, x.title, x.description, x.category, x.condition, x.price_xof, x.quantity, JSON.stringify(x.delivery), JSON.stringify(x.specs), l.section, l.datasheet_url ?? null]);
      created++;
    }
    await audit(u.id, "human", "shop.import", { kind: "user", id: u.id }, { created, rejected: r.lines.filter((l) => !l.ok).length });
  }
  return ok({ dry_run: b.dry_run, created, lines: r.lines.map(({ line, ok: good, errors }) => ({ line, ok: good, errors })) });
});
