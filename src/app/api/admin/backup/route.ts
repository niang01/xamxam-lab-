import { endpoint, mustBeAdmin } from "@/server/api";
import { getDb } from "@/server/db";
import { exportBackup } from "@/server/backup";
import { audit } from "@/server/audit";

/** Téléchargement d'une sauvegarde complète (administrateur). Contient des données personnelles : à conserver chiffrée. */
export const GET = endpoint(async (req) => {
  const u = await mustBeAdmin(req);
  await audit(u.id, "human", "backup.download", null);
  const b = await exportBackup(await getDb());
  return new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="xamxam-${b.created_at.slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
});
