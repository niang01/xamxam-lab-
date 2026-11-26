import { describe, expect, it } from "vitest";
import { call, register } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as projects from "@/app/api/projects/route";
import * as calc from "@/app/api/calc/[kind]/route";
import * as backupRoute from "@/app/api/admin/backup/route";
import { getDb, migrate, openDb } from "@/server/db";
import { seed } from "@/server/seed";
import { exportBackup, restoreBackup, type Backup } from "@/server/backup";
import { auditHash } from "@/server/audit";
import { trialTag } from "@/server/licensing";
import { loadIntegrityKey } from "@/server/keys";

describe("Sauvegarde et restauration", () => {
  it("aller-retour complet vers une base neuve, compteurs et chaîne d'audit préservés ; refus d'écraser ; refus d'un fichier altéré", async () => {
    const R = registerRoute.POST as never;
    const admin = await register(R, "admin@test.local");
    const eng = await register(R, "eng@test.local");
    const p = await call(projects.POST as never, "POST", "/x", { session: eng, body: { title: "Projet sauvegardé" } });
    await call(calc.POST as never, "POST", "/x", { session: eng, params: { kind: "ohm" }, body: { project_id: p.json.id, input: { u: 1, r: 2 } } });
    expect((await call(backupRoute.GET as never, "GET", "/x", { session: eng })).status).toBe(403);
    const dl = await call(backupRoute.GET as never, "GET", "/x", { session: admin });
    expect((dl.json as unknown as Backup).format).toBe("xamxam-backup-v1");

    const b = await exportBackup(await getDb());
    const target = await openDb(); await migrate(target); await seed(target);
    const counts = await restoreBackup(target, b);
    expect(counts.users).toBe(2);
    expect(counts.projects).toBe(1);
    // Tables ajoutées depuis la v1 : présentes ; essais re-signés avec la clé de la base cible (sinon « altéré »).
    for (const t of ["trials", "licences", "shop_orders", "documents", "studies", "user_devices", "course_assignments"]) expect(counts, t).toHaveProperty(t);
    expect(counts.trials).toBe(2);
    const trial = (await target.query<{ user_id: string; started_at: string; ends_at: string; integrity: string }>("SELECT * FROM trials LIMIT 1")).rows[0];
    expect(trial.integrity).toBe(trialTag(trial.user_id, trial.started_at, trial.ends_at));
    expect(Object.keys(counts)).not.toContain("server_keys");
    const users = (await target.query<{ email: string }>("SELECT email FROM users ORDER BY email")).rows.map((r) => r.email);
    expect(users).toEqual(["admin@test.local", "eng@test.local"]);
    // Chaîne d'audit recalculée dans la base restaurée.
    const rows = (await target.query<{ actor_id: string | null; actor_kind: string; action: string; object_kind: string | null; object_id: string | null; details: unknown; prev_hash: string | null; hash: string; created_at: string | Date }>("SELECT * FROM audit_log ORDER BY id")).rows;
    let prev: string | null = null;
    for (const r of rows) { expect(auditHash(prev, { ...r, created_at: new Date(r.created_at).toISOString() })).toBe(r.hash); prev = r.hash; }
    // Les compteurs continuent après la restauration.
    await target.query("INSERT INTO audit_log(actor_kind, action, hash) VALUES ('system','test','x')");
    await expect(restoreBackup(target, b)).rejects.toThrow(/déjà des comptes/);
    const empty = await openDb(); await migrate(empty);
    await expect(restoreBackup(empty, { ...b, tables: { ...b.tables, users: [] } })).rejects.toThrow(/altéré/);
    await loadIntegrityKey(await getDb()); // la clé d'intégrité active redevient celle de la base de l'application
    await Promise.all([target.close(), empty.close()]);
  }, 60000);
});
