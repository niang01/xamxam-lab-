/** Accès aux documents d'un utilisateur (jamais ceux d'un autre compte). */
import { ApiFailure } from "../api";
import { sqlOne } from "../db";
import type { DocReport } from "./process";

export type Doc = { id: string; filename: string; kind: string; pages: number | null; ocr: boolean; extracted_text: string; tables: string[][][]; report: DocReport; instructions: string | null; created_at: string; size_bytes: number };

export async function myDocument(id: string, userId: string): Promise<Doc> {
  const d = await sqlOne<Doc>("SELECT * FROM documents WHERE id=$1 AND user_id=$2", [id, userId]);
  if (!d) throw new ApiFailure(404, "Document introuvable", "err.notFound");
  return d;
}
