/** Contrôle d'accès aux projets (privés par défaut) et aux appareils. */
import { sqlOne } from "./db";
import { ApiFailure, type User } from "./api";

export type ProjectRole = "owner" | "editor" | "commenter" | "viewer";
const RANK: Record<ProjectRole, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 };

export async function projectRole(projectId: string, user: User | null): Promise<ProjectRole | null> {
  const p = await sqlOne<{ owner_id: string; visibility: string; role: ProjectRole | null }>(
    `SELECT p.owner_id, p.visibility, (SELECT role FROM project_members m WHERE m.project_id=p.id AND m.user_id=$2) AS role FROM projects p WHERE p.id=$1`, [projectId, user?.id ?? null]);
  if (!p) return null;
  if (user && p.owner_id === user.id) return "owner";
  if (p.role) return p.role;
  if (p.visibility === "public") return "viewer";
  return null;
}

/** Exige un rôle minimal ; un projet inaccessible est signalé « introuvable » (ne révèle pas son existence). */
export async function requireProject(projectId: string, user: User, min: ProjectRole): Promise<ProjectRole> {
  const r = await projectRole(projectId, user);
  if (!r) throw new ApiFailure(404, "Projet introuvable", "err.notFound");
  if (RANK[r] < RANK[min]) throw new ApiFailure(403, "Droits insuffisants sur ce projet", "err.forbidden");
  return r;
}

export interface DeviceRow {
  id: string; owner_id: string; project_id: string | null; name: string; hardware: string; protocol: string;
  environment: "virtual" | "bench" | "real"; capabilities: { metrics?: { metric: string; unit?: string; max_age_s?: number }[]; commands?: { action: string; label?: string; max_duration_s: number | null; requires_duration: boolean }[] };
  status: string; firmware_version: string | null; last_seen: string | null; created_at: string;
}

/** Appareil accessible : propriétaire, ou membre éditeur du projet de rattachement (lecture : lecteur). */
export async function requireDevice(deviceId: string, user: User, write: boolean): Promise<DeviceRow> {
  const d = await sqlOne<DeviceRow>("SELECT id, owner_id, project_id, name, hardware, protocol, environment, capabilities, status, firmware_version, last_seen, created_at FROM devices WHERE id=$1", [deviceId]);
  if (!d) throw new ApiFailure(404, "Appareil introuvable", "err.notFound");
  if (d.owner_id === user.id || user.is_admin) return d;
  if (d.project_id) {
    const r = await projectRole(d.project_id, user);
    if (r && (!write || r === "editor" || r === "owner")) return d;
  }
  throw new ApiFailure(404, "Appareil introuvable", "err.notFound");
}
