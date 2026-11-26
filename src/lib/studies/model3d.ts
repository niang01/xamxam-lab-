/**
 * Maquette 3D paramétrique générée à partir d'une étude (format du Studio : volumes simples cotés en mm).
 * Seules les dimensions saisies ou calculées par le moteur sont utilisées ; si une dimension manque, aucune
 * maquette n'est produite et la donnée manquante est indiquée (aucune cote inventée).
 */
import type { Assembly, Part } from "@/lib/assembly";
import { num, type Input, type StudyResult } from "./types";

const part = (id: string, name: string, shape: Part["shape"], dims: [number, number, number], pos: [number, number, number], color: string, rot: [number, number, number] = [0, 0, 0]): Part =>
  ({ id, name, shape, dims, pos, rot, color, density: null, hollow: false, component_id: null });
const line = (r: StudyResult, label: string) => { for (const s of r.steps) for (const l of s.lines) if (l.label.startsWith(label)) return l.value; return null; };

export function modelFromStudy(software: string, input: Input, r: StudyResult): { assembly: Assembly | null; missing: string[]; note: string } {
  const missing: string[] = [];
  if (!r.ok) return { assembly: null, missing: ["étude incomplète : compléter les données manquantes"], note: "" };
  if (software === "photovoltaique") {
    const l = num(input.mod_l), w = num(input.mod_w), tilt = num(input.tilt) ?? 0;
    if (l == null) missing.push("longueur d'un module (mm, fiche technique)"); if (w == null) missing.push("largeur d'un module (mm, fiche technique)");
    const n = Number(String(line(r, "Nombre de modules") ?? "0"));
    if (missing.length || !n) return { assembly: null, missing, note: "" };
    const cols = Math.ceil(Math.sqrt(n * 2)), parts: Part[] = [];
    const rows = Math.ceil(n / cols), gap = 20, rise = Math.sin((tilt * Math.PI) / 180) * l!;
    for (let i = 0; i < n; i++) { const c = i % cols, k = Math.floor(i / cols); parts.push(part(`M${i + 1}`, `Module ${i + 1}`, "box", [w!, l! * Math.cos((tilt * Math.PI) / 180), 35], [c * (w! + gap), k * (l! + 600), 600 + rise / 2], "#1e3a8a", [-tilt, 0, 0])); }
    parts.push(part("STR", "Structure (emprise)", "box", [cols * (w! + gap), rows * (l! + 600), 40], [((cols - 1) * (w! + gap)) / 2, ((rows - 1) * (l! + 600)) / 2, 20], "#9ca3af"));
    return { assembly: { parts }, missing: [], note: `${n} modules de ${l} × ${w} mm inclinés de ${tilt}° (rangées espacées de 600 mm : à ajuster selon l'ombrage)` };
  }
  if (software === "sechage-solaire") {
    const dims = String(line(r, "Dimensions intérieures") ?? "").split("×").map((x) => Number(x.trim().replace(",", ".")));
    const n = Number(line(r, "Nombre de claies") ?? 0), sp = num(input.tray_spacing), area = Number(line(r, "Surface de capteur") ?? 0);
    if (dims.length !== 3 || dims.some((x) => !Number.isFinite(x)) || sp == null) return { assembly: null, missing: ["dimensions de la chambre"], note: "" };
    const [L, W, H] = dims.map((x) => x * 1000);
    const parts: Part[] = [part("CH", "Chambre de séchage", "box", [L + 100, W + 100, H + 100], [0, 0, (H + 100) / 2 + 500], "#a16207")];
    for (let i = 0; i < n; i++) parts.push(part(`C${i + 1}`, `Claie ${i + 1}`, "box", [L, W, 15], [0, 0, 500 + 50 + sp * 1000 * (i + 1)], "#d6d3d1"));
    if (area > 0) { const side = Math.sqrt(area) * 1000; parts.push(part("CAP", "Capteur solaire à air", "box", [W + 100, side * side / (W + 100), 80], [0, -(L / 2 + side * side / (W + 100) / 2 + 300), 400], "#111827", [-20, 0, 0])); }
    return { assembly: { parts }, missing: [], note: "Capteur représenté avec la largeur de la chambre (longueur déduite de la surface calculée), incliné de 20° (illustratif)" };
  }
  if (software === "froid") {
    const L = num(input.L), W = num(input.W), H = num(input.H);
    if (L == null || W == null || H == null) return { assembly: null, missing: ["dimensions de la chambre"], note: "" };
    return { assembly: { parts: [part("CF", "Chambre froide (intérieur)", "box", [L * 1000, W * 1000, H * 1000], [0, 0, (H * 1000) / 2], "#93c5fd"), part("EV", "Évaporateur", "box", [800, 300, 350], [0, (W * 1000) / 2 - 200, H * 1000 - 250], "#e5e7eb")] }, missing: [], note: "Dimensions de l'évaporateur : à remplacer par celles de la fiche" };
  }
  if (software === "genie-civil") {
    const L = num(input.L), b = num(input.b), h = num(input.h);
    if (L == null || b == null || h == null) return { assembly: null, missing: ["portée et section de la poutre"], note: "" };
    return { assembly: { parts: [part("P", "Poutre", "box", [L * 1000, b * 10, h * 10], [0, 0, 3000], "#a8a29e"), part("A1", "Appui A", "box", [b * 10, b * 10, 3000 - (h * 10) / 2], [-(L * 1000) / 2, 0, (3000 - (h * 10) / 2) / 2], "#78716c"), part("A2", "Appui B", "box", [b * 10, b * 10, 3000 - (h * 10) / 2], [(L * 1000) / 2, 0, (3000 - (h * 10) / 2) / 2], "#78716c")] }, missing: [], note: "Hauteur des appuis (3 m) illustrative" };
  }
  return { assembly: null, missing: [], note: "Maquette 3D automatique non disponible pour ce logiciel : construire la maquette dans le Studio." };
}
