import { z } from "zod";
import { ok, readInput, endpoint, mustBeSignedIn } from "@/server/api";
import { sql } from "@/server/db";
import { audit } from "@/server/audit";

export const GET = endpoint(async (req) => {
  await mustBeSignedIn(req);
  const sp = new URL(req.url).searchParams;
  const text = (sp.get("q") ?? "").trim();
  const cat = sp.get("category");
  const disc = sp.get("discipline");
  const rows = await sql(`SELECT * FROM components WHERE ($1='' OR name ILIKE '%'||$1||'%' OR description ILIKE '%'||$1||'%' OR COALESCE(mpn,'') ILIKE '%'||$1||'%' OR COALESCE(manufacturer,'') ILIKE '%'||$1||'%')
    AND ($2::text IS NULL OR category=$2) AND ($3::text IS NULL OR discipline=$3) ORDER BY discipline NULLS LAST, category, status DESC, name LIMIT 500`, [text, cat, disc]);
  const cats = await sql<{ category: string; n: number }>("SELECT category, COUNT(*)::int n FROM components GROUP BY category ORDER BY category");
  const disciplines = await sql<{ discipline: string; n: number }>("SELECT discipline, COUNT(*)::int n FROM components WHERE discipline IS NOT NULL GROUP BY discipline ORDER BY discipline");
  return ok({ items: rows, categories: cats, disciplines });
});

/** Ajout d'un composant réel : référence et fiche technique obligatoires ; statut « à vérifier » jusqu'à vérification. */
export const POST = endpoint(async (req) => {
  const u = await mustBeSignedIn(req);
  const b = await readInput(req, z.object({
    category: z.string().trim().min(2).max(60), name: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(2000),
    function: z.string().trim().max(1000).nullable().optional(), manufacturer: z.string().trim().min(1).max(120), mpn: z.string().trim().min(1).max(120),
    datasheet_url: z.string().url().max(500).refine((s) => s.startsWith("https://"), "Lien https requis"),
    discipline: z.enum(["electrique", "electronique", "solaire", "hydraulique", "iot", "cartes", "automatisme", "froid", "reseau", "mecanique", "drone", "genie_civil"]).nullable().optional(),
    specs: z.record(z.string().max(60), z.string().max(120)).default({}), pins: z.array(z.string().max(40)).max(200).default([]), precautions: z.string().max(2000).nullable().optional(),
  }));
  const r = (await sql<{ id: string }>(`INSERT INTO components(category, name, description, function, manufacturer, mpn, datasheet_url, specs, pins, precautions, status, source, created_by, discipline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'to_verify',$11,$12,$13) RETURNING id`,
    [b.category, b.name, b.description, b.function ?? null, b.manufacturer, b.mpn, b.datasheet_url, JSON.stringify(b.specs), JSON.stringify(b.pins), b.precautions ?? null, `Saisi par ${u.display_name} d'après la fiche technique`, u.id, b.discipline ?? null]))[0];
  await audit(u.id, "human", "component.create", { kind: "component", id: r.id }, { mpn: b.mpn });
  return ok({ id: r.id }, 201);
});
