import { describe, expect, it } from "vitest";
import { getDb, sql } from "@/server/db";
import { seed } from "@/server/seed";

describe("Mise à jour de la bibliothèque sur une base existante (cas de la production du 25/11)", () => {
  it("doublons hérités fusionnés, références reportées, aucune erreur, aucun doublon ; 2e passage sans effet", async () => {
    const db = await getDb();
    // État de la production : ancienne ligne réinsérée sous son ancienne catégorie à côté de la ligne mise à jour.
    const dup = (await sql<{ id: string }>(`INSERT INTO components(category, name, description, status, source, mpn) VALUES ('électrotechnique','Disjoncteur','ancienne','generic','x','generic') RETURNING id`))[0].id;
    const u = (await sql<{ id: string }>(`INSERT INTO users(email, password_hash, display_name, profile_kind) VALUES ('v@test.local','x','V','company') RETURNING id`))[0].id;
    const l = (await sql<{ id: string }>(`INSERT INTO market_listings(seller_id, title, category, condition, component_id) VALUES ($1,'Disjoncteur 16 A','component','new',$2) RETURNING id`, [u, dup]))[0].id;
    await sql("DELETE FROM server_keys WHERE name='library_version'");
    await seed(db);
    const rows = await sql<{ id: string; category: string }>("SELECT id, category FROM components WHERE name='Disjoncteur' AND mpn='generic'");
    expect(rows).toHaveLength(1); expect(rows[0].category).toBe("protection");
    expect((await sql<{ component_id: string }>("SELECT component_id FROM market_listings WHERE id=$1", [l]))[0].component_id).toBe(rows[0].id);
    const dups = await sql("SELECT name FROM components WHERE mpn='generic' GROUP BY name HAVING COUNT(*) > 1");
    expect(dups).toEqual([]);
    // Nouveau changement d'empreinte : l'ancienne liste ne recrée pas de doublon
    await sql("DELETE FROM server_keys WHERE name='library_version'");
    await seed(db);
    expect(await sql("SELECT name FROM components WHERE mpn='generic' GROUP BY name HAVING COUNT(*) > 1")).toEqual([]);
  });

  it("doublons retirés de la bibliothèque (état de la production après le 25/11) : fusionnés, références reportées", async () => {
    const db = await getDb();
    const old = (await sql<{ id: string }>(`INSERT INTO components(category, name, description, status, source, mpn, discipline) VALUES ('carte','Arduino Mega 2560','doublon','generic','x','generic','cartes') RETURNING id`))[0].id;
    const u = (await sql<{ id: string }>(`INSERT INTO users(email, password_hash, display_name, profile_kind) VALUES ('w@test.local','x','W','company') RETURNING id`))[0].id;
    const p = (await sql<{ id: string }>(`INSERT INTO projects(owner_id, title) VALUES ($1,'P') RETURNING id`, [u]))[0].id;
    await sql("INSERT INTO project_components(project_id, component_id, name, qty) VALUES ($1,$2,'Arduino Mega 2560',1)", [p, old]);
    await sql("DELETE FROM server_keys WHERE name='library_version'");
    await seed(db);
    expect(await sql("SELECT 1 FROM components WHERE name='Arduino Mega 2560'")).toEqual([]);
    const keep = (await sql<{ id: string }>("SELECT id FROM components WHERE name='Carte Arduino Mega' AND mpn='generic'"))[0].id;
    expect((await sql<{ component_id: string }>("SELECT component_id FROM project_components WHERE project_id=$1", [p]))[0].component_id).toBe(keep);
  });

  it("une erreur de chargement de la bibliothèque ne rend pas la plateforme indisponible", async () => {
    const failing = { driver: "pglite-memory" as const, query: async () => { throw new Error("panne simulée"); }, exec: async () => undefined, close: async () => undefined };
    await expect(seed(failing as never)).resolves.toBeUndefined();
  });
});
