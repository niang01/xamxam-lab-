/**
 * Génération de schémas techniques paramétrés (format des Schémas 2D, src/lib/diagram.ts) :
 * démarrage direct (puissance et commande), étoile-triangle, inversion de sens de marche, unifilaire photovoltaïque,
 * câblage IoT, réseau informatique en étoile, pompage hydraulique, circuit pneumatique, architecture logicielle IoT.
 * Chaque schéma est accompagné de contrôles de logique calculés sur le graphe (chemins conducteurs, éléments en série,
 * verrouillages). Repères selon l'usage courant (QF, KM, F, S, H, KA, M). Les calibres et sections ne sont PAS choisis
 * à la place de l'ingénieur : le courant d'emploi est calculé et la gamme normalisée est indiquée à titre de suggestion.
 */
import type { Block, Diagram } from "./diagram";

export interface GenParam { key: string; label: string; unit: string; type: "number" | "int" | "text"; default: number | string; min?: number; max?: number }
export interface Generated { diagram: Diagram; title: string; description: string[]; checks: { ok: boolean; text: string }[]; warnings: string[] }
export interface Generator { kind: string; title: string; discipline: string; params: GenParam[]; build: (p: Record<string, number | string>) => Generated }

type B = Omit<Block, "rot" | "params"> & { rot?: Block["rot"]; params?: Record<string, string> };
const blk = (b: B): Block => ({ rot: 0, params: {}, component_id: null, ...b });
class G {
  blocks: Block[] = []; wires: Diagram["wires"] = []; notes: Diagram["notes"] = [];
  add(b: B) { this.blocks.push(blk(b)); return b.id; }
  w(a: string, b: string, label?: string) {
    const end = (s: string) => { const [id, pin] = s.split("."); const bl = this.blocks.find((x) => x.id === id); if (!bl) throw new Error(`bloc ${id}`); const i = bl.pins.indexOf(pin); if (i < 0) throw new Error(`broche ${s}`); return { block: id, pin: i }; };
    this.wires.push({ a: end(a), b: end(b), ...(label ? { label } : {}) });
  }
  note(x: number, y: number, text: string) { this.notes.push({ x, y, text }); }
  out(discipline: string): Diagram { return { discipline, blocks: this.blocks, wires: this.wires, notes: this.notes }; }
}

// ------------------------------------------------------------ Contrôles de logique (graphe conducteur)
/** Graphe où chaque liaison et chaque élément « passant » relient des broches. `closed` : paires internes conductrices. */
export function conducts(d: Diagram, from: string, to: string, closed: [string, string][], removed: string[] = []): boolean {
  const key = (b: string, p: number) => `${b}:${p}`;
  const pinKey = (s: string) => { const [id, pin] = s.split("."); const b = d.blocks.find((x) => x.id === id)!; return key(id, b.pins.indexOf(pin)); };
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => { adj.set(a, [...(adj.get(a) ?? []), b]); adj.set(b, [...(adj.get(b) ?? []), a]); };
  for (const w of d.wires) link(key(w.a.block, w.a.pin), key(w.b.block, w.b.pin));
  for (const [a, b] of closed) if (!removed.some((r) => a.startsWith(r + ".") || b.startsWith(r + "."))) link(pinKey(a), pinKey(b));
  const start = pinKey(from), goal = pinKey(to), seen = new Set([start]), q = [start];
  while (q.length) { const n = q.shift()!; if (n === goal) return true; for (const m of adj.get(n) ?? []) if (!seen.has(m)) { seen.add(m); q.push(m); } }
  return false;
}
const inSeries = (d: Diagram, from: string, to: string, closed: [string, string][], el: string) => conducts(d, from, to, closed) && !conducts(d, from, to, closed, [el]);

const SERIES = [1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630];
/** Courant d'emploi d'un moteur triphasé : Ib = P / (√3 · U · cos φ · η). */
export const motorCurrent = (pW: number, u: number, cos: number, eta: number) => pW / (Math.sqrt(3) * u * cos * eta);
const nextRating = (i: number) => SERIES.find((x) => x >= i) ?? null;
const num = (p: Record<string, number | string>, k: string) => Number(p[k]);

function motorHeader(p: Record<string, number | string>) {
  const ib = motorCurrent(num(p, "pkW") * 1000, num(p, "u"), num(p, "cos"), num(p, "eta"));
  return { ib, text: `Moteur ${p.pkW} kW, ${p.u} V triphasé, cos φ = ${p.cos}, η = ${p.eta} → Ib = P / (√3·U·cos φ·η) = ${ib.toFixed(2)} A (calcul). Calibre normalisé immédiatement supérieur : ${nextRating(ib) ?? "hors gamme"} A — suggestion à valider (courbe, pouvoir de coupure, section et sélectivité selon la norme applicable).` };
}
const MOTOR_PARAMS: GenParam[] = [
  { key: "pkW", label: "Puissance utile du moteur", unit: "kW", type: "number", default: 5.5, min: 0.1, max: 500 },
  { key: "u", label: "Tension entre phases", unit: "V", type: "number", default: 400, min: 100, max: 1000 },
  { key: "cos", label: "Facteur de puissance cos φ", unit: "", type: "number", default: 0.85, min: 0.1, max: 1 },
  { key: "eta", label: "Rendement η", unit: "", type: "number", default: 0.88, min: 0.1, max: 1 },
];

function dolPower(g: G, x0 = -300) {
  g.add({ id: "NET", name: "Réseau triphasé", symbol: "NET", label: "L1-L2-L3", pins: ["L1", "L2", "L3", "PE"], x: x0, y: 0 });
  g.add({ id: "QF1", name: "Disjoncteur moteur", symbol: "QF", label: "QF1", pins: ["1", "3", "5", "2", "4", "6"], x: x0 + 220, y: 0 });
  g.add({ id: "KM1", name: "Contacteur", symbol: "KM", label: "KM1", pins: ["1", "3", "5", "2", "4", "6"], x: x0 + 440, y: 0 });
  g.add({ id: "F1", name: "Relais thermique", symbol: "F", label: "F1", pins: ["1", "3", "5", "2", "4", "6"], x: x0 + 660, y: 0 });
  g.add({ id: "M1", name: "Moteur asynchrone triphasé", symbol: "M3", label: "M1", pins: ["U", "V", "W", "PE"], x: x0 + 880, y: 0 });
  g.w("NET.L1", "QF1.1"); g.w("NET.L2", "QF1.3"); g.w("NET.L3", "QF1.5");
  g.w("QF1.2", "KM1.1"); g.w("QF1.4", "KM1.3"); g.w("QF1.6", "KM1.5");
  g.w("KM1.2", "F1.1"); g.w("KM1.4", "F1.3"); g.w("KM1.6", "F1.5");
  g.w("F1.2", "M1.U"); g.w("F1.4", "M1.V"); g.w("F1.6", "M1.W"); g.w("NET.PE", "M1.PE", "PE");
}
const POWER_CLOSED = (km: string[]): [string, string][] => [
  ["QF1.1", "QF1.2"], ["QF1.3", "QF1.4"], ["QF1.5", "QF1.6"], ["F1.1", "F1.2"], ["F1.3", "F1.4"], ["F1.5", "F1.6"],
  ...km.flatMap((k) => [[`${k}.1`, `${k}.2`], [`${k}.3`, `${k}.4`], [`${k}.5`, `${k}.6`]] as [string, string][]),
];

function dolControl(g: G, y0 = 300) {
  g.add({ id: "PH", name: "Alimentation de commande", symbol: "AL", label: "L-N", pins: ["L", "N"], x: -300, y: y0 });
  g.add({ id: "FU1", name: "Fusible", symbol: "FU", label: "FU1", pins: ["1", "2"], x: -120, y: y0 });
  g.add({ id: "F1C", name: "Contact du relais thermique", symbol: "F", label: "F1 (95-96)", pins: ["95", "96"], x: 40, y: y0 });
  g.add({ id: "S0", name: "Bouton arrêt (NF)", symbol: "S", label: "S0", pins: ["1", "2"], x: 200, y: y0 });
  g.add({ id: "S1", name: "Bouton marche (NO)", symbol: "S", label: "S1", pins: ["3", "4"], x: 360, y: y0 });
  g.add({ id: "KM1A", name: "Contact d'auto-maintien KM1", symbol: "KM", label: "KM1 (13-14)", pins: ["13", "14"], x: 360, y: y0 + 120 });
  g.add({ id: "KM1B", name: "Bobine du contacteur", symbol: "KM", label: "KM1 (A1-A2)", pins: ["A1", "A2"], x: 540, y: y0 });
  g.add({ id: "H1", name: "Voyant de marche", symbol: "H", label: "H1", pins: ["X1", "X2"], x: 540, y: y0 + 160 });
  g.add({ id: "KM1C", name: "Contact de signalisation KM1", symbol: "KM", label: "KM1 (23-24)", pins: ["23", "24"], x: 360, y: y0 + 240 });
  g.w("PH.L", "FU1.1"); g.w("FU1.2", "F1C.95"); g.w("F1C.96", "S0.1"); g.w("S0.2", "S1.3"); g.w("S1.4", "KM1B.A1");
  g.w("S0.2", "KM1A.13"); g.w("KM1A.14", "KM1B.A1"); g.w("KM1B.A2", "PH.N");
  g.w("S0.2", "KM1C.23"); g.w("KM1C.24", "H1.X1"); g.w("H1.X2", "PH.N");
}

export const GENERATORS: Generator[] = [
  {
    kind: "tableau_unifilaire", title: "Unifilaire d'un tableau électrique (départs dimensionnés)", discipline: "electrique",
    params: [
      { key: "circuits", label: "Départs « nom/calibre A/section mm² » séparés par « ; »", unit: "", type: "text", default: "Éclairage/10/1.5;Prises/16/2.5" },
      { key: "main", label: "Calibre de l'appareil général", unit: "A", type: "number", default: 32, min: 1, max: 4000 },
      { key: "rcd", label: "Nombre d'interrupteurs différentiels", unit: "", type: "int", default: 1, min: 1, max: 8 },
      { key: "idn", label: "Sensibilité des différentiels", unit: "mA", type: "number", default: 30, min: 1, max: 3000 },
    ],
    build: (p) => {
      const g = new G();
      const circuits = String(p.circuits).split(";").map((c) => c.trim()).filter(Boolean).slice(0, 24).map((c) => { const [name, inA, s] = c.split("/"); return { name: (name ?? "").trim() || "Départ", inA: (inA ?? "").trim(), s: (s ?? "").trim() }; });
      const nR = Math.max(1, Math.min(8, Math.round(num(p, "rcd")), circuits.length || 1));
      g.add({ id: "SRC", name: "Arrivée réseau (après compteur)", symbol: "AL", label: "Réseau", pins: ["L", "N"], x: -420, y: 0 });
      g.add({ id: "QG", name: `Appareil général ${p.main} A`, symbol: "QF", label: "Q0", pins: ["L", "N", "L'", "N'"], x: -200, y: 0, params: { in: `${p.main} A` } });
      g.w("SRC.L", "QG.L"); g.w("SRC.N", "QG.N");
      const closed: [string, string][] = [["QG.L", "QG.L'"]];
      for (let r = 1; r <= nR; r++) {
        g.add({ id: `ID${r}`, name: `Interrupteur différentiel ${p.idn} mA`, symbol: "ID", label: `Q${r}0`, pins: ["L", "N", "L'", "N'"], x: 40, y: (r - 1) * 260, params: { idn: `${p.idn} mA` } });
        g.w("QG.L'", `ID${r}.L`); g.w("QG.N'", `ID${r}.N`); closed.push([`ID${r}.L`, `ID${r}.L'`]);
      }
      circuits.forEach((c, i) => {
        const r = (i % nR) + 1, id = `C${i + 1}`;
        g.add({ id: `QF${i + 1}`, name: `Disjoncteur ${c.inA} A — ${c.name}`, symbol: "QF", label: `Q${r}${i + 1}`, pins: ["1", "2"], x: 300, y: i * 110, params: { in: `${c.inA} A` } });
        g.add({ id, name: `${c.name} (${c.s} mm²)`, symbol: "E", label: id, pins: ["L", "N"], x: 560, y: i * 110, params: { s: `${c.s} mm²` } });
        g.w(`ID${r}.L'`, `QF${i + 1}.1`); g.w(`QF${i + 1}.2`, `${id}.L`, `${c.s} mm²`); g.w(`ID${r}.N'`, `${id}.N`);
        closed.push([`QF${i + 1}.1`, `QF${i + 1}.2`]);
      });
      const d = g.out("electrique");
      return {
        diagram: d, title: `Unifilaire — ${circuits.length} départ(s), ${nR} différentiel(s)`,
        description: [`Arrivée → appareil général ${p.main} A → ${nR} interrupteur(s) différentiel(s) ${p.idn} mA → ${circuits.length} départ(s).`, "Calibres et sections issus de l'étude « Installation électrique » (Logiciels de dimensionnement)."],
        checks: [
          { ok: circuits.every((_, i) => conducts(d, "SRC.L", `C${i + 1}.L`, closed)), text: "Chaque départ est alimenté depuis l'arrivée à travers l'appareil général" },
          { ok: circuits.every((_, i) => !conducts(d, "SRC.L", `C${i + 1}.L`, closed, [`QF${i + 1}`])), text: "Chaque départ est protégé par son disjoncteur (aucun chemin sans lui)" },
          { ok: circuits.every((_, i) => !conducts(d, "SRC.L", `C${i + 1}.L`, closed, Array.from({ length: nR }, (_, r) => `ID${r + 1}`))), text: "Chaque départ est placé en aval d'un interrupteur différentiel" },
        ],
        warnings: ["Répartition des départs entre différentiels faite dans l'ordre : à adapter aux règles de la norme applicable (nombre de circuits par différentiel, type AC/A/F)."],
      };
    },
  },
  {
    kind: "demarrage_direct", title: "Démarrage direct d'un moteur triphasé (puissance et commande)", discipline: "electrique", params: MOTOR_PARAMS,
    build: (p) => {
      const g = new G(); dolPower(g); dolControl(g);
      const d = g.out("electrique"); const h = motorHeader(p);
      // Contrôles : alimentation de la bobine quand S1 est appuyé ; F1 95-96 et S0 en série ; auto-maintien en parallèle de S1.
      const rest: [string, string][] = [["FU1.1", "FU1.2"], ["F1C.95", "F1C.96"], ["S0.1", "S0.2"]];
      const pressed: [string, string][] = [...rest, ["S1.3", "S1.4"]];
      const held: [string, string][] = [...rest, ["KM1A.13", "KM1A.14"]];
      const checks = [
        { ok: !conducts(d, "PH.L", "KM1B.A1", rest), text: "Au repos (S1 relâché, KM1 retombé), la bobine KM1 n'est pas alimentée" },
        { ok: conducts(d, "PH.L", "KM1B.A1", pressed), text: "Appui sur S1 : la bobine KM1 est alimentée" },
        { ok: conducts(d, "PH.L", "KM1B.A1", held), text: "Auto-maintien : KM1 (13-14) maintient la bobine après relâchement de S1" },
        { ok: inSeries(d, "PH.L", "KM1B.A1", held, "S0"), text: "Le bouton d'arrêt S0 (NF) est en série : son ouverture coupe la bobine" },
        { ok: inSeries(d, "PH.L", "KM1B.A1", held, "F1C"), text: "Le contact F1 (95-96) du relais thermique est en série avec la bobine" },
        { ok: conducts(d, "NET.L1", "M1.U", POWER_CLOSED(["KM1"])) && !conducts(d, "NET.L1", "M1.U", POWER_CLOSED([])), text: "Puissance : le moteur n'est alimenté que lorsque KM1 est fermé" },
      ];
      return { diagram: d, title: `Démarrage direct — moteur ${p.pkW} kW`, description: [h.text, "Circuit de puissance : QF1 → KM1 → F1 → M1 ; circuit de commande : FU1 → F1 (95-96) → S0 → S1 // KM1 (13-14) → KM1 (A1-A2)."], checks, warnings: h.ib > 30 ? ["Courant élevé : un démarrage direct peut provoquer une chute de tension importante au démarrage ; étudier un démarreur progressif ou étoile-triangle."] : [] };
    },
  },
  {
    kind: "etoile_triangle", title: "Démarrage étoile-triangle (puissance)", discipline: "electrique", params: [...MOTOR_PARAMS, { key: "t", label: "Temporisation étoile → triangle", unit: "s", type: "number", default: 5, min: 1, max: 60 }],
    build: (p) => {
      const g = new G();
      g.add({ id: "NET", name: "Réseau triphasé", symbol: "NET", label: "L1-L2-L3", pins: ["L1", "L2", "L3", "PE"], x: -300, y: 0 });
      g.add({ id: "QF1", name: "Disjoncteur moteur", symbol: "QF", label: "QF1", pins: ["1", "3", "5", "2", "4", "6"], x: -80, y: 0 });
      g.add({ id: "KM1", name: "Contacteur de ligne", symbol: "KM", label: "KM1", pins: ["1", "3", "5", "2", "4", "6"], x: 140, y: 0 });
      g.add({ id: "F1", name: "Relais thermique", symbol: "F", label: "F1", pins: ["1", "3", "5", "2", "4", "6"], x: 360, y: 0 });
      g.add({ id: "M1", name: "Moteur 6 bornes", symbol: "M3", label: "M1", pins: ["U1", "V1", "W1", "W2", "U2", "V2"], x: 600, y: 0 });
      g.add({ id: "KM3", name: "Contacteur triangle", symbol: "KM", label: "KM3", pins: ["1", "3", "5", "2", "4", "6"], x: 600, y: 260 });
      g.add({ id: "KM2", name: "Contacteur étoile", symbol: "KM", label: "KM2", pins: ["1", "3", "5", "2", "4", "6"], x: 860, y: 0 });
      g.add({ id: "KA1", name: "Relais temporisé", symbol: "KA", label: "KA1", pins: ["A1", "A2", "15", "16", "18"], x: 140, y: 260, params: { t: String(p.t) } });
      g.w("NET.L1", "QF1.1"); g.w("NET.L2", "QF1.3"); g.w("NET.L3", "QF1.5");
      g.w("QF1.2", "KM1.1"); g.w("QF1.4", "KM1.3"); g.w("QF1.6", "KM1.5");
      g.w("KM1.2", "F1.1"); g.w("KM1.4", "F1.3"); g.w("KM1.6", "F1.5");
      g.w("F1.2", "M1.U1"); g.w("F1.4", "M1.V1"); g.w("F1.6", "M1.W1");
      // Triangle : U2-W1... par KM3 (alimente W2, U2, V2 depuis L1, L2, L3 après F1) ; étoile : KM2 court-circuite U2-V2-W2.
      g.w("F1.2", "KM3.1"); g.w("F1.4", "KM3.3"); g.w("F1.6", "KM3.5");
      g.w("KM3.2", "M1.W2"); g.w("KM3.4", "M1.U2"); g.w("KM3.6", "M1.V2");
      g.w("M1.U2", "KM2.1"); g.w("M1.V2", "KM2.3"); g.w("M1.W2", "KM2.5"); g.w("KM2.2", "KM2.4"); g.w("KM2.4", "KM2.6");
      const d = g.out("electrique"); const h = motorHeader(p);
      const base: [string, string][] = [["QF1.1", "QF1.2"], ["QF1.3", "QF1.4"], ["QF1.5", "QF1.6"], ["KM1.1", "KM1.2"], ["KM1.3", "KM1.4"], ["KM1.5", "KM1.6"], ["F1.1", "F1.2"], ["F1.3", "F1.4"], ["F1.5", "F1.6"]];
      const km3: [string, string][] = [["KM3.1", "KM3.2"], ["KM3.3", "KM3.4"], ["KM3.5", "KM3.6"]];
      const km2: [string, string][] = [["KM2.1", "KM2.2"], ["KM2.3", "KM2.4"], ["KM2.5", "KM2.6"]];
      const checks = [
        { ok: conducts(d, "M1.U2", "M1.V2", km2) && conducts(d, "M1.V2", "M1.W2", km2) && !conducts(d, "M1.U2", "M1.V2", []), text: "Étoile : KM2 fermé réunit U2, V2 et W2 (point étoile) ; ouvert, elles sont séparées" },
        { ok: conducts(d, "M1.U1", "M1.W2", km3) && conducts(d, "M1.V1", "M1.U2", km3) && conducts(d, "M1.W1", "M1.V2", km3) && !conducts(d, "M1.U1", "M1.W2", []), text: "Triangle : KM3 fermé couple U1-W2, V1-U2, W1-V2" },
        { ok: conducts(d, "NET.L1", "NET.L2", [...base, ...km2, ...km3]), text: "KM2 et KM3 fermés ensemble = court-circuit entre phases : verrouillage électrique et mécanique KM2/KM3 OBLIGATOIRE (contacts NF croisés)" },
      ];
      return { diagram: d, title: `Démarrage étoile-triangle — moteur ${p.pkW} kW`, description: [h.text, `Séquence : KM1 + KM2 (étoile) pendant ${p.t} s (KA1), puis KM2 s'ouvre et KM3 se ferme (triangle). Le moteur doit être prévu pour fonctionner en triangle sous la tension du réseau.`], checks, warnings: ["Le circuit de commande (temporisation, verrouillages KM2/KM3) est à compléter dans l'éditeur ; le contrôle ci-dessus montre pourquoi le verrouillage est indispensable."] };
    },
  },
  {
    kind: "inversion_sens", title: "Inversion du sens de marche (puissance)", discipline: "electrique", params: MOTOR_PARAMS,
    build: (p) => {
      const g = new G();
      g.add({ id: "NET", name: "Réseau triphasé", symbol: "NET", label: "L1-L2-L3", pins: ["L1", "L2", "L3", "PE"], x: -300, y: 0 });
      g.add({ id: "QF1", name: "Disjoncteur moteur", symbol: "QF", label: "QF1", pins: ["1", "3", "5", "2", "4", "6"], x: -80, y: 0 });
      g.add({ id: "KM1", name: "Contacteur avant", symbol: "KM", label: "KM1", pins: ["1", "3", "5", "2", "4", "6"], x: 160, y: -140 });
      g.add({ id: "KM2", name: "Contacteur arrière", symbol: "KM", label: "KM2", pins: ["1", "3", "5", "2", "4", "6"], x: 160, y: 140 });
      g.add({ id: "F1", name: "Relais thermique", symbol: "F", label: "F1", pins: ["1", "3", "5", "2", "4", "6"], x: 400, y: 0 });
      g.add({ id: "M1", name: "Moteur asynchrone triphasé", symbol: "M3", label: "M1", pins: ["U", "V", "W", "PE"], x: 640, y: 0 });
      g.w("NET.L1", "QF1.1"); g.w("NET.L2", "QF1.3"); g.w("NET.L3", "QF1.5");
      g.w("QF1.2", "KM1.1"); g.w("QF1.4", "KM1.3"); g.w("QF1.6", "KM1.5");
      g.w("QF1.2", "KM2.5"); g.w("QF1.4", "KM2.3"); g.w("QF1.6", "KM2.1"); // permutation L1 ↔ L3
      g.w("KM1.2", "F1.1"); g.w("KM1.4", "F1.3"); g.w("KM1.6", "F1.5");
      g.w("KM2.2", "F1.1"); g.w("KM2.4", "F1.3"); g.w("KM2.6", "F1.5");
      g.w("F1.2", "M1.U"); g.w("F1.4", "M1.V"); g.w("F1.6", "M1.W"); g.w("NET.PE", "M1.PE", "PE");
      const d = g.out("electrique"); const h = motorHeader(p);
      const base: [string, string][] = [["QF1.1", "QF1.2"], ["QF1.3", "QF1.4"], ["QF1.5", "QF1.6"], ["F1.1", "F1.2"], ["F1.3", "F1.4"], ["F1.5", "F1.6"]];
      const k = (id: string): [string, string][] => [[`${id}.1`, `${id}.2`], [`${id}.3`, `${id}.4`], [`${id}.5`, `${id}.6`]];
      const checks = [
        { ok: conducts(d, "NET.L1", "M1.U", [...base, ...k("KM1")]), text: "KM1 : L1 → U (sens avant)" },
        { ok: conducts(d, "NET.L3", "M1.U", [...base, ...k("KM2")]) && conducts(d, "NET.L1", "M1.W", [...base, ...k("KM2")]), text: "KM2 : L1 et L3 permutées (sens arrière)" },
        { ok: conducts(d, "NET.L1", "NET.L3", [...base, ...k("KM1"), ...k("KM2")]), text: "KM1 et KM2 fermés ensemble = court-circuit L1-L3 : verrouillage électrique (contacts NF croisés) et mécanique OBLIGATOIRE" },
      ];
      return { diagram: d, title: `Inversion de sens — moteur ${p.pkW} kW`, description: [h.text, "L'inversion de deux phases (L1 ↔ L3) inverse le champ tournant."], checks, warnings: ["Compléter le circuit de commande avec les verrouillages KM1/KM2."] };
    },
  },
  {
    kind: "unifilaire_pv", title: "Unifilaire d'une installation photovoltaïque autonome", discipline: "solaire",
    params: [{ key: "strings", label: "Nombre de chaînes PV", unit: "", type: "int", default: 2, min: 1, max: 8 }, { key: "modules", label: "Modules par chaîne", unit: "", type: "int", default: 2, min: 1, max: 30 }],
    build: (p) => {
      const g = new G(); const n = Math.round(num(p, "strings"));
      for (let i = 1; i <= n; i++) { g.add({ id: `PV${i}`, name: `Chaîne PV ${i} (${p.modules} modules en série)`, symbol: "PV", label: `PV${i}`, pins: ["+", "−"], x: -300, y: (i - 1) * 140 }); }
      g.add({ id: "CDC", name: "Coffret de protection DC (fusibles gPV, sectionneur, parafoudre)", symbol: "CDC", label: "Q1-DC", pins: [...Array.from({ length: n }, (_, i) => [`E${i + 1}+`, `E${i + 1}−`]).flat(), "S+", "S−"], x: 0, y: 70 });
      g.add({ id: "MPPT", name: "Régulateur de charge MPPT", symbol: "MPPT", label: "U1", pins: ["PV+", "PV−", "BAT+", "BAT−"], x: 260, y: 70 });
      g.add({ id: "BAT", name: "Parc de batteries", symbol: "BAT", label: "GB1", pins: ["+", "−"], x: 520, y: -40 });
      g.add({ id: "FB", name: "Protection batterie (fusible)", symbol: "FU", label: "F-BAT", pins: ["1", "2"], x: 400, y: -40 });
      g.add({ id: "INV", name: "Onduleur autonome", symbol: "INV", label: "U2", pins: ["DC+", "DC−", "L", "N"], x: 520, y: 200 });
      g.add({ id: "TD", name: "Tableau AC (disjoncteurs, différentiel)", symbol: "TD", label: "TD", pins: ["L", "N", "C1", "C2"], x: 780, y: 200 });
      for (let i = 1; i <= n; i++) { g.w(`PV${i}.+`, `CDC.E${i}+`); g.w(`PV${i}.−`, `CDC.E${i}−`); }
      g.w("CDC.S+", "MPPT.PV+"); g.w("CDC.S−", "MPPT.PV−"); g.w("MPPT.BAT+", "FB.1"); g.w("FB.2", "BAT.+"); g.w("MPPT.BAT−", "BAT.−");
      g.w("BAT.+", "INV.DC+"); g.w("BAT.−", "INV.DC−"); g.w("INV.L", "TD.L"); g.w("INV.N", "TD.N");
      const d = g.out("solaire");
      const closed: [string, string][] = [...Array.from({ length: n }, (_, i) => [`CDC.E${i + 1}+`, "CDC.S+"] as [string, string]), ["MPPT.PV+", "MPPT.BAT+"], ["FB.1", "FB.2"]];
      return {
        diagram: d, title: `Unifilaire PV autonome — ${n} chaîne(s) de ${p.modules} module(s)`,
        description: [`${n} chaîne(s) de ${p.modules} module(s) → coffret DC → régulateur MPPT → batteries → onduleur → tableau AC.`, "Dimensionnement des chaînes (tensions à froid, plage MPPT), des batteries et de la production : Solar Energy Lab ; évolution de l'état de charge : Studio 4D."],
        checks: [
          { ok: Array.from({ length: n }, (_, i) => conducts(d, `PV${i + 1}.+`, "BAT.+", closed)).every(Boolean), text: "Chaque chaîne PV rejoint la batterie à travers le coffret DC et le régulateur" },
          { ok: inSeries(d, "MPPT.BAT+", "BAT.+", closed, "FB"), text: "Une protection (fusible) est placée entre régulateur et batterie" },
        ],
        warnings: ["Calibres des fusibles gPV et section des câbles DC à déterminer d'après les fiches techniques et la norme applicable."],
      };
    },
  },
  {
    kind: "iot_capteurs", title: "Câblage IoT : carte ESP32, capteurs et relais", discipline: "iot",
    params: [{ key: "sensors", label: "Nombre de capteurs analogiques", unit: "", type: "int", default: 2, min: 1, max: 4 }, { key: "load", label: "Charge commandée par le relais", unit: "", type: "text", default: "Pompe" }],
    build: (p) => {
      const g = new G(); const n = Math.round(num(p, "sensors"));
      g.add({ id: "PSU", name: "Alimentation 5 V", symbol: "G", label: "G1", pins: ["5V", "GND"], x: -320, y: 0 });
      g.add({ id: "MCU", name: "Carte ESP32", symbol: "MCU", label: "MCU1", pins: ["5V", "GND", "3V3", ...Array.from({ length: n }, (_, i) => `ADC${i + 1}`), "GPIO26"], x: 0, y: 0 });
      for (let i = 1; i <= n; i++) { g.add({ id: `SE${i}`, name: "Capteur analogique (sortie 0–3,3 V)", symbol: "SE", label: `SE${i}`, pins: ["VCC", "GND", "AOUT"], x: 320, y: -160 + (i - 1) * 140 }); }
      g.add({ id: "K1", name: "Module relais", symbol: "K", label: "K1", pins: ["VCC", "GND", "IN", "COM", "NO"], x: 320, y: 260 });
      g.add({ id: "LOAD", name: String(p.load), symbol: "M", label: "M1", pins: ["1", "2"], x: 620, y: 260 });
      g.add({ id: "SRC", name: "Alimentation de la charge", symbol: "AL", label: "L-N", pins: ["L", "N"], x: 620, y: 440 });
      g.w("PSU.5V", "MCU.5V"); g.w("PSU.GND", "MCU.GND");
      for (let i = 1; i <= n; i++) { g.w("MCU.3V3", `SE${i}.VCC`); g.w("MCU.GND", `SE${i}.GND`); g.w(`SE${i}.AOUT`, `MCU.ADC${i}`); }
      g.w("PSU.5V", "K1.VCC"); g.w("PSU.GND", "K1.GND"); g.w("MCU.GPIO26", "K1.IN");
      g.w("SRC.L", "K1.COM"); g.w("K1.NO", "LOAD.1"); g.w("LOAD.2", "SRC.N");
      const d = g.out("iot");
      return {
        diagram: d, title: `IoT : ESP32, ${n} capteur(s), relais → ${p.load}`,
        description: ["Capteurs alimentés en 3,3 V (logique de l'ESP32) ; relais alimenté en 5 V et commandé par GPIO26 ; la charge est coupée par le contact NO du relais.", "Firmware de référence : firmware/xamxam-node ; seuils fixés par l'utilisateur dans Automation Studio."],
        checks: [
          { ok: Array.from({ length: n }, (_, i) => conducts(d, `SE${i + 1}.VCC`, "MCU.3V3", [])).every(Boolean), text: "Capteurs alimentés en 3,3 V (aucun 5 V sur les entrées analogiques)" },
          { ok: !conducts(d, "SRC.L", "LOAD.1", []) && conducts(d, "SRC.L", "LOAD.1", [["K1.COM", "K1.NO"]]), text: "La charge n'est alimentée que lorsque le relais est collé" },
          { ok: !conducts(d, "SRC.L", "MCU.GND", [["K1.COM", "K1.NO"]]), text: "Isolement : le circuit de puissance n'est pas relié à la masse de la carte" },
        ],
        warnings: ["Charge secteur : boîtier, protections et raccordement par une personne habilitée."],
      };
    },
  },
  {
    kind: "reseau_etoile", title: "Réseau informatique en étoile", discipline: "reseau",
    params: [{ key: "hosts", label: "Postes de travail", unit: "", type: "int", default: 4, min: 1, max: 16 }, { key: "cidr", label: "Plan d'adressage", unit: "", type: "text", default: "192.168.10.0/24" }],
    build: (p) => {
      const g = new G(); const n = Math.round(num(p, "hosts"));
      g.add({ id: "ISP", name: "Accès Internet (fournisseur)", symbol: "WAN", label: "WAN", pins: ["LAN"], x: -360, y: 0 });
      g.add({ id: "RT", name: "Routeur / pare-feu", symbol: "RT", label: "RT1", pins: ["WAN", "LAN"], x: -140, y: 0, params: { reseau: String(p.cidr) } });
      g.add({ id: "SW", name: "Commutateur", symbol: "SW", label: "SW1", pins: ["uplink", ...Array.from({ length: n + 2 }, (_, i) => `p${i + 1}`)], x: 120, y: 0 });
      g.add({ id: "SRV", name: "Serveur", symbol: "SRV", label: "SRV1", pins: ["LAN"], x: 420, y: -200 });
      g.add({ id: "AP", name: "Point d'accès Wi-Fi", symbol: "AP", label: "AP1", pins: ["LAN"], x: 420, y: -60 });
      for (let i = 1; i <= n; i++) g.add({ id: `PC${i}`, name: "Poste de travail", symbol: "PC", label: `PC${i}`, pins: ["LAN"], x: 420 + Math.floor((i - 1) / 4) * 200, y: 80 + ((i - 1) % 4) * 110 });
      g.w("ISP.LAN", "RT.WAN"); g.w("RT.LAN", "SW.uplink"); g.w("SW.p1", "SRV.LAN"); g.w("SW.p2", "AP.LAN");
      for (let i = 1; i <= n; i++) g.w(`SW.p${i + 2}`, `PC${i}.LAN`);
      const d = g.out("reseau");
      return { diagram: d, title: `Réseau en étoile — ${n} poste(s), ${p.cidr}`, description: [`Topologie en étoile autour de SW1 ; adressage ${p.cidr} (calcul du sous-réseau : Computer & Network Lab).`, "Liaisons cuivre : 100 m maximum par lien Ethernet."], checks: [{ ok: Array.from({ length: n }, (_, i) => conducts(d, `PC${i + 1}.LAN`, "RT.LAN", Array.from({ length: n + 2 }, (_, k) => ["SW.uplink", `SW.p${k + 1}`] as [string, string]))).every(Boolean), text: "Chaque poste atteint le routeur à travers le commutateur" }], warnings: [] };
    },
  },
  {
    kind: "pompage_hydraulique", title: "Schéma hydraulique de pompage et d'irrigation", discipline: "hydraulique",
    params: [{ key: "zones", label: "Secteurs d'irrigation (électrovannes)", unit: "", type: "int", default: 3, min: 1, max: 8 }],
    build: (p) => {
      const g = new G(); const n = Math.round(num(p, "zones"));
      g.add({ id: "P1", name: "Pompe immergée de forage", symbol: "PU", label: "P1", pins: ["aspiration", "refoulement"], x: -360, y: 0 });
      g.add({ id: "CL", name: "Clapet anti-retour", symbol: "CL", label: "CL1", pins: ["entrée", "sortie"], x: -160, y: 0 });
      g.add({ id: "V1", name: "Vanne d'isolement", symbol: "V", label: "V1", pins: ["entrée", "sortie"], x: 20, y: 0 });
      g.add({ id: "RES", name: "Réservoir", symbol: "RES", label: "R1", pins: ["entrée", "sortie", "trop-plein"], x: 220, y: 0 });
      g.add({ id: "LS", name: "Capteur de niveau à flotteur", symbol: "SL", label: "LS1", pins: ["COM", "NO"], x: 220, y: -180 });
      g.add({ id: "FI", name: "Filtre à disques", symbol: "FI", label: "FI1", pins: ["entrée", "sortie"], x: 440, y: 0 });
      for (let i = 1; i <= n; i++) { g.add({ id: `YV${i}`, name: "Électrovanne", symbol: "YV", label: `YV${i}`, pins: ["entrée", "sortie"], x: 660, y: -160 + (i - 1) * 130 }); g.add({ id: `GG${i}`, name: `Goutte-à-goutte secteur ${i}`, symbol: "GG", label: `S${i}`, pins: ["entrée"], x: 880, y: -160 + (i - 1) * 130 }); }
      g.w("P1.refoulement", "CL.entrée"); g.w("CL.sortie", "V1.entrée"); g.w("V1.sortie", "RES.entrée"); g.w("RES.sortie", "FI.entrée");
      for (let i = 1; i <= n; i++) { g.w("FI.sortie", `YV${i}.entrée`); g.w(`YV${i}.sortie`, `GG${i}.entrée`); }
      const d = g.out("hydraulique");
      return { diagram: d, title: `Pompage et irrigation — ${n} secteur(s)`, description: ["Forage → clapet anti-retour → vanne → réservoir → filtre → électrovannes → goutte-à-goutte.", "Puissance de pompe : Solar Energy Lab (pump) ; évolution du niveau : Studio 4D (réservoir)."], checks: [{ ok: inSeries(d, "P1.refoulement", "RES.entrée", [["CL.entrée", "CL.sortie"], ["V1.entrée", "V1.sortie"]], "CL"), text: "Clapet anti-retour au refoulement de la pompe" }, { ok: Array.from({ length: n }, (_, i) => inSeries(d, "RES.sortie", `GG${i + 1}.entrée`, [["FI.entrée", "FI.sortie"], ...Array.from({ length: n }, (_, k) => [`YV${k + 1}.entrée`, `YV${k + 1}.sortie`] as [string, string])], "FI")).every(Boolean), text: "Filtration en amont de chaque secteur de goutte-à-goutte" }], warnings: [] };
    },
  },
  {
    kind: "pneumatique_verin", title: "Circuit pneumatique : vérin double effet et distributeur 5/2", discipline: "mecanique", params: [],
    build: () => {
      const g = new G();
      g.add({ id: "SRC", name: "Source d'air comprimé", symbol: "P", label: "P0", pins: ["sortie"], x: -320, y: 0 });
      g.add({ id: "FRL", name: "Unité de conditionnement (filtre, régulateur, lubrificateur)", symbol: "FRL", label: "0Z1", pins: ["entrée", "sortie"], x: -100, y: 0 });
      g.add({ id: "DV", name: "Distributeur 5/2 bistable", symbol: "DV", label: "1V1", pins: ["1 (P)", "2 (B)", "4 (A)", "3 (R)", "5 (S)"], x: 140, y: 0 });
      g.add({ id: "CY", name: "Vérin double effet", symbol: "CY", label: "1A1", pins: ["chambre arrière", "chambre avant"], x: 400, y: 0 });
      g.add({ id: "S1", name: "Capteur fin de course rentré", symbol: "SQ", label: "1S1", pins: ["COM", "NO"], x: 400, y: -180 });
      g.add({ id: "S2", name: "Capteur fin de course sorti", symbol: "SQ", label: "1S2", pins: ["COM", "NO"], x: 600, y: -180 });
      g.w("SRC.sortie", "FRL.entrée"); g.w("FRL.sortie", "DV.1 (P)"); g.w("DV.4 (A)", "CY.chambre arrière"); g.w("DV.2 (B)", "CY.chambre avant");
      const d = g.out("mecanique");
      return { diagram: d, title: "Vérin double effet commandé par distributeur 5/2", description: ["Position 14 : P → A, la tige sort ; position 12 : P → B, la tige rentre ; échappements R et S.", "Force du vérin : Mechanical Lab (cylinder)."], checks: [{ ok: conducts(d, "SRC.sortie", "CY.chambre arrière", [["FRL.entrée", "FRL.sortie"], ["DV.1 (P)", "DV.4 (A)"]]) && conducts(d, "SRC.sortie", "CY.chambre avant", [["FRL.entrée", "FRL.sortie"], ["DV.1 (P)", "DV.2 (B)"]]), text: "Chaque position du distributeur alimente une chambre du vérin" }], warnings: ["Ajouter des réducteurs de débit à l'échappement pour régler la vitesse de la tige."] };
    },
  },
  {
    kind: "architecture_iot", title: "Architecture logicielle d'une solution IoT", discipline: "informatique", params: [],
    build: () => {
      const g = new G();
      g.add({ id: "N", name: "Nœuds capteurs (firmware)", symbol: "MCU", label: "Nœuds", pins: ["MQTT/HTTPS"], x: -380, y: 0 });
      g.add({ id: "GW", name: "Passerelle IoT (MQTT, HTTPS)", symbol: "GW", label: "Passerelle", pins: ["entrée", "sortie"], x: -140, y: 0 });
      g.add({ id: "API", name: "API serveur (authentification, règles)", symbol: "API", label: "API", pins: ["entrée", "base", "clients"], x: 120, y: 0 });
      g.add({ id: "DB", name: "Base de données (PostgreSQL)", symbol: "DB", label: "BD", pins: ["accès"], x: 120, y: 200 });
      g.add({ id: "UI", name: "Tableau de bord web et mobile", symbol: "UI", label: "Interface", pins: ["HTTPS"], x: 400, y: 0 });
      g.add({ id: "AUTO", name: "Automatisations (commandes confirmées)", symbol: "AU", label: "Automatisations", pins: ["API"], x: 400, y: 200 });
      g.w("N.MQTT/HTTPS", "GW.entrée", "TLS"); g.w("GW.sortie", "API.entrée"); g.w("API.base", "DB.accès"); g.w("API.clients", "UI.HTTPS", "HTTPS"); g.w("API.clients", "AUTO.API");
      const d = g.out("informatique");
      return { diagram: d, title: "Architecture logicielle IoT", description: ["Nœuds → passerelle (jeton par appareil, TLS) → API (contrôle d'accès, journal) → base de données ; interfaces et automatisations passent par l'API.", "Correspond à l'architecture de XAM-XAM LAB (IoT Gateway, Automation Studio)."], checks: [{ ok: conducts(d, "N.MQTT/HTTPS", "DB.accès", [["GW.entrée", "GW.sortie"], ["API.entrée", "API.base"]]), text: "Les données des nœuds atteignent la base uniquement à travers la passerelle et l'API" }], warnings: [] };
    },
  },
];

export const generatorByKind = (k: string) => GENERATORS.find((g) => g.kind === k) ?? null;

/** Valeurs des paramètres : défauts, conversion et bornes (aucune valeur hors plage acceptée). */
export function resolveParams(g: Generator, input: Record<string, unknown>): { values: Record<string, number | string>; errors: string[] } {
  const values: Record<string, number | string> = {}; const errors: string[] = [];
  for (const p of g.params) {
    const raw = input[p.key] ?? p.default;
    if (p.type === "text") { values[p.key] = String(raw).slice(0, 60); continue; }
    const v = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(v)) { errors.push(`${p.label} : nombre attendu`); continue; }
    if ((p.min != null && v < p.min) || (p.max != null && v > p.max)) { errors.push(`${p.label} : entre ${p.min} et ${p.max}${p.unit ? ` ${p.unit}` : ""}`); continue; }
    values[p.key] = p.type === "int" ? Math.round(v) : v;
  }
  return { values, errors };
}

/** Reconnaissance du type de schéma demandé (Aláji IA, mode sans clé). */
export function guessGenerator(text: string): string | null {
  const t = text.toLowerCase();
  if (/étoile[- ]triangle|etoile[- ]triangle|star[- ]delta/.test(t)) return "etoile_triangle";
  if (/inversion|deux sens|reversing/.test(t)) return "inversion_sens";
  if (/démarrage direct|demarrage direct|direct on line|marche[- ]arrêt|auto-?maintien/.test(t)) return "demarrage_direct";
  if (/unifilaire|photovolta|solaire|pv\b/.test(t)) return "unifilaire_pv";
  if (/pneumati|vérin|verin/.test(t)) return "pneumatique_verin";
  if (/hydrauli|pompage|irrigation|goutte/.test(t)) return "pompage_hydraulique";
  if (/architecture logiciel|architecture iot|software architecture/.test(t)) return "architecture_iot";
  if (/réseau informatique|reseau informatique|\blan\b|switch|commutateur/.test(t)) return "reseau_etoile";
  if (/iot|esp32|capteur|arduino/.test(t)) return "iot_capteurs";
  return null;
}
