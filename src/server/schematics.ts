import { sqlOne } from "./db";
import { ApiFailure, type User } from "./api";
import { requireProject } from "./access";
import type { Graph } from "@/lib/spice/netlist";

export interface SchematicRow { id: string; project_id: string | null; owner_id: string; lab: string; title: string; version: number; graph: Graph; updated_at: string }

export async function requireSchematic(id: string, u: User, write: boolean): Promise<SchematicRow> {
  const s = await sqlOne<SchematicRow>("SELECT * FROM schematics WHERE id=$1", [id]);
  if (!s) throw new ApiFailure(404, "Schéma introuvable", "err.notFound");
  if (s.owner_id === u.id) return s;
  if (!s.project_id) throw new ApiFailure(404, "Schéma introuvable", "err.notFound");
  await requireProject(s.project_id, u, write ? "editor" : "viewer");
  return s;
}
