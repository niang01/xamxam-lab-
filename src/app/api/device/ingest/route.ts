import { ok, readInput, endpoint } from "@/server/api";
import { sql } from "@/server/db";
import { readingsSchema } from "@/server/schemas";
import { ingest } from "@/server/iot";
import { requireDeviceToken } from "@/server/deviceAuth";

/** Ingestion HTTPS des mesures par l'appareil (jeton propre à l'appareil). */
export const POST = endpoint(async (req) => {
  const d = await requireDeviceToken(req);
  const b = await readInput(req, readingsSchema);
  if (b.firmware) await sql("UPDATE devices SET firmware_version=$2 WHERE id=$1", [d.id, b.firmware]);
  return ok(await ingest(d, b.readings, "device"));
});
