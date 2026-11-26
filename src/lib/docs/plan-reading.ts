/**
 * Lecture d'un plan, d'un cahier des charges ou d'une photographie (texte extrait, y compris par OCR) :
 * équipements nommés (rapprochés de la bibliothèque), repères normalisés (QF1, KM2…), dimensions lisibles,
 * schéma proposable. Rien n'est déduit qui ne soit écrit : une dimension non lisible n'est pas estimée.
 */
import { LIBRARY } from "@/lib/library";
import { guessGenerator } from "@/lib/schematics-gen";

export interface PlanReading { equipment: { name: string; count: number; discipline: string }[]; references: string[]; dimensions: string[]; generator: string | null; missing: string[] }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOP = new Set(["de", "du", "des", "la", "le", "les", "a", "et", "d", "l", "en", "pour", "par", "sur", "au", "aux", "un", "une"]);
/** Mots significatifs du nom (sans parenthèses ni mots outils). */
const WORDS = (name: string) => norm(name.replace(/\(.*?\)/g, "")).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !STOP.has(w)).slice(0, 4);
const ROOT = (name: string) => WORDS(name).join(" ");

/** Repères d'appareils courants (usage des schémas électriques). */
const REF = /\b(QF|KM|KA|KT|FU|QS|Q|F|S|H|M|T|X|U|K|R|C|D|L|PV|BAT|INV)(\d{1,3})\b/g;
const DIM = /(?:Ø\s?)?\b\d+(?:[.,]\d+)?\s?(?:m³\/h|L\/s|kVA|kW|mm|cm|km|m²|m2|m³|m3|bar|°C|m|W|A|V)(?![\w²³])|\b\d+\s?[x×]\s?\d+(?:\s?[x×]\s?\d+)?\s?(?:mm|cm|m)\b/g;

export function readPlan(text: string): PlanReading {
  const t = norm(text);
  const equipment = LIBRARY.map((c) => {
    const w = WORDS(c.name);
    if (!w.length || (w.length === 1 && w[0].length < 6)) return null;
    // Tous les mots significatifs, dans l'ordre, séparés au plus par des mots outils (« capteur de niveau à flotteur »).
    const re = new RegExp(`\\b${w.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?:[\\s'-]+(?:de|du|des|la|le|les|a|d|l|en|au|aux)?)*[\\s'-]+")}`, "g");
    const n = (t.match(re) ?? []).length;
    return n ? { name: c.name, count: n, discipline: c.discipline } : null;
  }).filter(Boolean) as PlanReading["equipment"];
  // Un même mot racine peut correspondre à plusieurs fiches : garder la plus spécifique par racine.
  const best = new Map<string, PlanReading["equipment"][number]>();
  for (const e of equipment) { const k = ROOT(e.name); const cur = best.get(k); if (!cur || e.name.length < cur.name.length) best.set(k, e); }
  const references = [...new Set([...text.matchAll(REF)].map((m) => m[0]))].slice(0, 60);
  const dimensions = [...new Set((text.match(DIM) ?? []).map((x) => x.replace(/\s+/g, " ").trim()))].slice(0, 60);
  const generator = guessGenerator(text);
  const missing: string[] = [];
  if (!dimensions.length) missing.push("aucune dimension lisible : cotes à saisir");
  if (!best.size && !references.length) missing.push("aucun équipement reconnu : vérifier la lecture (OCR) ou saisir la liste");
  return { equipment: [...best.values()].sort((a, b) => b.count - a.count).slice(0, 40), references, dimensions, generator, missing };
}
