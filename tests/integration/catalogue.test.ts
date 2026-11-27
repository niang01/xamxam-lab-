/** Catalogue en base : chargement idempotent, filtres, fiche détaillée, références d'utilisateurs conservées. */
import { beforeAll, describe, expect, it } from "vitest";
import { call, register, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as components from "@/app/api/components/route";
import * as componentId from "@/app/api/components/[id]/route";
import { getDb, sql } from "@/server/db";
import { seed, loadCatalogue } from "@/server/seed";

let u: Session;
beforeAll(async () => { u = await register(registerRoute.POST as never, "catalogue@test.local"); });

describe("Catalogue de références réelles", () => {
  it("toutes les références du fichier sont chargées (statut « catalogue »), avec fabricant, fiche technique et brochage", async () => {
    const n = (await sql<{ n: number }>("SELECT COUNT(*)::int AS n FROM components WHERE status='catalogue'"))[0].n;
    expect(n).toBe(loadCatalogue().length);
    const r = await call(components.GET as never, "GET", "/api/components?kind=catalogue&manufacturer=Espressif%20Systems", { session: u });
    const items = r.json.items as { name: string; manufacturer: string; datasheet_url: string }[];
    expect(items.length).toBeGreaterThan(5);
    expect(items.every((x) => x.manufacturer === "Espressif Systems" && x.datasheet_url.startsWith("http"))).toBe(true);
    expect((r.json.totals as { catalogue: number }).catalogue).toBe(n);
  });
  it("recherche par référence (LM317) et fiche détaillée : brochage, empreinte, sources, aucune offre inventée", async () => {
    const r = await call(components.GET as never, "GET", "/api/components?kind=catalogue&q=LM317", { session: u });
    const lm = (r.json.items as { id: string; name: string }[]).find((x) => x.name.startsWith("LM317"))!;
    expect(lm).toBeTruthy();
    const d = await call(componentId.GET as never, "GET", `/api/components/${lm.id}`, { session: u, params: { id: lm.id } });
    const c = d.json as { pinout: { pins: { name: string }[] }; footprint: string; sources: { label: string }[]; offers: unknown[]; manufacturer: string };
    expect(c.pinout.pins.map((p) => p.name).sort()).toEqual(["ADJ", "VI", "VO"]);
    expect(c.footprint).toMatch(/TO-220/);
    expect(c.sources[0].label).toMatch(/KiCad/);
    expect(c.offers).toEqual([]);
  });
  it("carte avec brochage interactif (ESP32 Wroom DevKit uPesy) reliée à sa fiche", async () => {
    const row = (await sql<{ pinout: { board: string } }>("SELECT pinout FROM components WHERE catalogue_key='upesy-esp32-wroom-devkit'"))[0];
    expect(row.pinout.board).toBe("upesy-esp32-wroom-devkit");
  });
  it("nouveau chargement : identifiants stables, références ajoutées par les utilisateurs conservées", async () => {
    await call(components.POST as never, "POST", "/api/components", { session: u, body: { category: "capteur", name: "Capteur maison", description: "Ajouté par un utilisateur", manufacturer: "Atelier", mpn: "X-1", datasheet_url: "https://example.org/x1.pdf" } });
    const before = (await sql<{ id: string }>("SELECT id FROM components WHERE catalogue_key='kicad-mcu-module-arduino-uno-r3'"))[0].id;
    await sql("UPDATE server_keys SET value='ancienne' WHERE name='catalogue_version'");
    await seed(await getDb());
    expect((await sql<{ id: string }>("SELECT id FROM components WHERE catalogue_key='kicad-mcu-module-arduino-uno-r3'"))[0].id).toBe(before);
    expect(await sql("SELECT 1 FROM components WHERE mpn='X-1'")).toHaveLength(1);
  });
});
