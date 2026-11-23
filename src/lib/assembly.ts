/**
 * Maquette 3D paramétrique (assemblage de volumes simples) : géométrie exacte des primitives, masse à partir de la
 * masse volumique SAISIE, centre de gravité. Ce n'est pas une CAO volumique ni un calcul de résistance.
 */
import { z } from "zod";

const v3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export const partSchema = z.object({
  id: z.string().min(1).max(40), name: z.string().min(1).max(120), component_id: z.string().uuid().nullable().optional(),
  shape: z.enum(["box", "cylinder", "sphere"]),
  dims: v3,                 // mm — box : L, l, h ; cylinder : diamètre, hauteur, (inutilisé) ; sphere : diamètre
  pos: v3,                  // mm (centre)
  rot: v3,                  // degrés (X, Y, Z)
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  density: z.number().finite().nonnegative().nullable(), // kg/m³ (saisie) ; null = masse non calculée
  hollow: z.boolean().default(false),                    // pièce creuse : masse non calculée (épaisseur inconnue)
});
export const assemblySchema = z.object({ parts: z.array(partSchema).max(300) });
export type Part = z.infer<typeof partSchema>;
export type Assembly = z.infer<typeof assemblySchema>;

/** Volume en m³ (dimensions en mm). */
export function volumeM3(p: Pick<Part, "shape" | "dims">): number {
  const [a, b, c] = p.dims.map((x) => x / 1000);
  if (p.shape === "box") return a * b * c;
  if (p.shape === "cylinder") return Math.PI * (a / 2) ** 2 * b;
  return (4 / 3) * Math.PI * (a / 2) ** 3;
}

export interface MassReport { totalKg: number | null; cog: [number, number, number] | null; parts: { id: string; name: string; volumeM3: number; massKg: number | null }[]; missing: string[] }

export function massReport(a: Assembly): MassReport {
  const parts = a.parts.map((p) => ({ id: p.id, name: p.name, volumeM3: volumeM3(p), massKg: p.density == null || p.hollow ? null : volumeM3(p) * p.density }));
  const missing = a.parts.filter((p) => p.density == null || p.hollow).map((p) => (p.hollow ? `${p.name} : pièce creuse (masse à saisir d'après la fiche)` : `${p.name} : masse volumique`));
  if (missing.length || !parts.length) return { totalKg: null, cog: null, parts, missing };
  const total = parts.reduce((s, p) => s + p.massKg!, 0);
  const cog = [0, 1, 2].map((k) => a.parts.reduce((s, p, i) => s + p.pos[k] * parts[i].massKg!, 0) / (total || 1)) as [number, number, number];
  return { totalKg: total, cog: cog.map((x) => Math.round(x * 10) / 10) as [number, number, number], parts, missing };
}

/** Masses volumiques usuelles (valeurs moyennes de référence, à confirmer selon la nuance exacte). */
export const DENSITIES: { name: string; kgm3: number }[] = [
  { name: "Acier", kgm3: 7850 }, { name: "Aluminium", kgm3: 2700 }, { name: "Cuivre", kgm3: 8960 }, { name: "Béton", kgm3: 2400 },
  { name: "Bois (pin, sec)", kgm3: 500 }, { name: "PVC rigide", kgm3: 1400 }, { name: "ABS / PLA (impression 3D, plein)", kgm3: 1050 }, { name: "Eau", kgm3: 1000 },
];
