/** Automatisme : Ladder (CEI 61131-3), Grafcet (CEI 60848), Modbus RTU/TCP — comportements vérifiés par simulation. */
import { describe, expect, it } from "vitest";
import { checkLadder, emptyState, runFor, scan, ladderText, type LadderProgram } from "@/lib/plc/ladder";
import { checkGrafcet, initialState, outputsOf, parseCond, step, type GrafcetProgram } from "@/lib/plc/grafcet";
import { crc16, decodeRtuResponse, hex, parseHex, rtuFrame, tcpFrame } from "@/lib/plc/modbus";
import { GRAFCET_EXAMPLES, LADDER_EXAMPLES } from "@/lib/plc/examples";

const L = (k: string) => LADDER_EXAMPLES.find((x) => x.key === k)! as LadderProgram;
const G = (k: string) => GRAFCET_EXAMPLES.find((x) => x.key === k)! as GrafcetProgram;

describe("Ladder", () => {
  it("tous les exemples sont valides ; erreurs signalées (entrée écrite, durée manquante, variable inconnue)", () => {
    for (const p of LADDER_EXAMPLES) expect(checkLadder(p).errors, p.key).toEqual([]);
    const bad = checkLadder({ title: "", description: "", inputs: [], outputs: [], rungs: [
      { branches: [[{ kind: "NO", v: "Q1" }]], out: { kind: "OUT", v: "I1" } },
      { branches: [[{ kind: "NO", v: "I1" }]], out: { kind: "TON", v: "T1" } },
      { branches: [[{ kind: "NO", v: "X9" }]], out: { kind: "OUT", v: "Q1" } },
    ] });
    expect(bad.errors.join(" | ")).toMatch(/entrée \(I1\).*durée de la temporisation T1.*invalide « X9 »/);
  });
  it("démarrage direct : marche par impulsion, auto-maintien, arrêt et défaut thermique prioritaires", () => {
    const p = L("demarrage-direct");
    let s = runFor(p, emptyState(), { I1: false, I2: true, I3: true }, 50);
    expect(s.bits.Q1).toBeFalsy();
    s = runFor(p, s, { I1: true, I2: true, I3: true }, 30); expect(s.bits.Q1).toBe(true); expect(s.bits.Q2).toBe(true);
    s = runFor(p, s, { I1: false, I2: true, I3: true }, 100); expect(s.bits.Q1).toBe(true);           // auto-maintien
    s = runFor(p, s, { I1: true, I2: false, I3: true }, 30); expect(s.bits.Q1).toBe(false);           // arrêt prioritaire sur marche
    s = runFor(p, s, { I1: true, I2: true, I3: true }, 30); s = runFor(p, s, { I1: false, I2: true, I3: false }, 30);
    expect(s.bits.Q1).toBe(false); expect(s.bits.Q3).toBe(true);                                       // défaut thermique
    s = runFor(p, s, { I1: false, I2: true, I3: true }, 30); expect(s.bits.Q1).toBe(false);           // pas de redémarrage seul
  });
  it("étoile-triangle : étoile 5 s puis triangle, jamais les deux ensemble", () => {
    const p = L("etoile-triangle");
    let s = runFor(p, emptyState(), { I1: true, I2: true, I3: true }, 20);
    s = runFor(p, s, { I1: false, I2: true, I3: true }, 4900);
    expect([s.bits.Q1, s.bits.Q2, s.bits.Q3]).toEqual([true, true, false]);
    let both = false;
    for (let t = 0; t < 300; t += 10) { s = scan(p, s, { I1: false, I2: true, I3: true }, 10); if (s.bits.Q2 && s.bits.Q3) both = true; }
    expect(both).toBe(false);
    expect([s.bits.Q1, s.bits.Q2, s.bits.Q3]).toEqual([true, false, true]);
    s = runFor(p, s, { I1: false, I2: false, I3: true }, 20);
    expect([s.bits.Q1, s.bits.Q2, s.bits.Q3]).toEqual([false, false, false]);
  });
  it("feux tricolores : séquence vert 5 s → orange 2 s → rouge 5 s → vert, un seul feu à la fois", () => {
    const p = L("feux"); let s = emptyState() as ReturnType<typeof scan>;
    const seq: string[] = [];
    for (let t = 0; t < 26000; t += 10) {
      s = scan(p, s, { I1: true }, 10);
      const on = ["Q1", "Q2", "Q3"].filter((q) => s.bits[q]);
      expect(on.length, `t=${t}`).toBe(1);
      const c = { Q1: "vert", Q2: "orange", Q3: "rouge" }[on[0] as "Q1"];
      if (seq[seq.length - 1] !== c) seq.push(c);
    }
    expect(seq.slice(0, 6)).toEqual(["vert", "orange", "rouge", "vert", "orange", "rouge"]);
    // durée du vert mesurée : 5 s à un cycle près
    let s2 = emptyState() as ReturnType<typeof scan>, t = 0; do { s2 = scan(p, s2, { I1: true }, 10); t += 10; } while (s2.bits.Q1);
    expect(t).toBeGreaterThanOrEqual(5000); expect(t).toBeLessThanOrEqual(5020);
  });
  it("remplissage : marche au niveau bas, arrêt au niveau haut, alarme après 10 s sans effet", () => {
    const p = L("remplissage");
    let s = runFor(p, emptyState(), { I1: false, I2: false, I3: true }, 50); expect(s.bits.Q1).toBe(true);
    s = runFor(p, s, { I1: true, I2: false, I3: true }, 50); expect(s.bits.Q1).toBe(true);    // mémorisé entre les sondes
    s = runFor(p, s, { I1: true, I2: true, I3: true }, 50); expect(s.bits.Q1).toBe(false);
    s = runFor(p, s, { I1: true, I2: false, I3: true }, 50); expect(s.bits.Q1).toBe(false);   // pas de redémarrage avant le niveau bas
    s = runFor(p, s, { I1: false, I2: false, I3: true }, 9900); expect(s.bits.Q2).toBeFalsy();
    s = runFor(p, s, { I1: false, I2: false, I3: true }, 200); expect(s.bits.Q2).toBe(true);
  });
  it("comptage : 10 fronts → lot complet et convoyeur arrêté ; un niveau maintenu ne compte qu'une fois ; remise à zéro", () => {
    const p = L("comptage"); let s = runFor(p, emptyState(), { I3: true }, 20);
    for (let k = 0; k < 9; k++) { s = runFor(p, s, { I1: true, I3: true }, 50); s = runFor(p, s, { I1: false, I3: true }, 50); }
    expect(s.counters.C1.cv).toBe(9); expect(s.bits.Q2).toBe(true); expect(s.bits.Q1).toBeFalsy();
    s = runFor(p, s, { I1: true, I3: true }, 500);
    expect(s.counters.C1.cv).toBe(10); expect(s.bits.Q1).toBe(true); expect(s.bits.Q2).toBe(false);
    s = runFor(p, s, { I1: false, I2: true, I3: true }, 30); s = runFor(p, s, { I1: false, I2: false, I3: true }, 30);
    expect(s.counters.C1.cv).toBe(0); expect(s.bits.Q1).toBe(false); expect(s.bits.Q2).toBe(true);
  });
  it("télérupteur : chaque appui inverse l'éclairage", () => {
    const p = L("telerupteur"); let s = runFor(p, emptyState(), {}, 20);
    const press = () => { s = runFor(p, s, { I1: true }, 200); s = runFor(p, s, { I1: false }, 200); return !!s.bits.Q1; };
    expect([press(), press(), press(), press()]).toEqual([true, false, true, false]);
  });
  it("minuterie (TOF) : 30 s après le dernier appui, relancée par un nouvel appui", () => {
    const p = L("minuterie");
    let s = runFor(p, emptyState(), { I1: true }, 100); s = runFor(p, s, { I1: false }, 20000); expect(s.bits.Q1).toBe(true);
    s = runFor(p, s, { I1: true }, 100); s = runFor(p, s, { I1: false }, 29000); expect(s.bits.Q1).toBe(true);
    s = runFor(p, s, { I1: false }, 1100); expect(s.bits.Q1).toBe(false);
  });
  it("liste d'instructions lisible", () => {
    expect(ladderText(L("demarrage-direct")).split("\n")[0]).toBe("01  I1 . I2 . I3 + Q1 . I2 . I3  →  OUT Q1   // Marche, auto-maintien, arrêt et thermique prioritaires");
  });
});

describe("Grafcet", () => {
  it("analyse des réceptivités et erreurs de syntaxe", () => {
    expect(() => parseCond("I1.(I2+/I3)")).not.toThrow();
    expect(() => parseCond("t/X2/2s . ↑I1")).not.toThrow();
    expect(() => parseCond("I1 .")).toThrow(/terme attendu/);
    expect(() => parseCond("(I1")).toThrow(/parenthèse/);
    for (const g of GRAFCET_EXAMPLES) expect(checkGrafcet(g).errors, g.key).toEqual([]);
  });
  it("vérin : cycle complet 0 → 1 → 2 → 0 selon les capteurs", () => {
    const g = G("verin"); let s = initialState(g);
    s = step(g, s, { I1: false, I2: true }, 10); expect(s.active).toEqual([0]);
    s = step(g, s, { I1: true, I2: true }, 10); expect(s.active).toEqual([1]); expect(outputsOf(g, s).Q1).toBe(true);
    s = step(g, s, { I1: false, I2: false, I3: true }, 10); expect(s.active).toEqual([2]); expect(outputsOf(g, s)).toEqual({ Q2: true });
    s = step(g, s, { I2: true, I3: false }, 10); expect(s.active).toEqual([0]);
  });
  it("perceuse : front montant exigé, temporisation de 2 s en fond de trou", () => {
    const g = G("perceuse"); let s = initialState(g);
    s = step(g, s, { I1: true, I2: true }, 10); expect(s.active).toEqual([1]);
    s = step(g, s, { I1: true, I3: true }, 10); expect(s.active).toEqual([2]);
    s = step(g, s, { I1: true, I3: true }, 1900); expect(s.active).toEqual([2]);
    s = step(g, s, { I1: true, I3: true }, 200); expect(s.active).toEqual([3]); expect(outputsOf(g, s)).toEqual({ Q3: true, Q2: true });
    s = step(g, s, { I1: true, I2: true }, 10); expect(s.active).toEqual([0]);
    s = step(g, s, { I1: true, I2: true }, 10); expect(s.active).toEqual([0]);   // I1 maintenu : pas de nouveau cycle sans front
  });
  it("mélangeur : divergence ET, attente de la seconde cuve, convergence puis temporisation", () => {
    const g = G("melangeur"); let s = initialState(g);
    s = step(g, s, { I1: true }, 10); expect(s.active).toEqual([1, 3]); expect(outputsOf(g, s)).toEqual({ Q1: true, Q2: true });
    s = step(g, s, { I2: true }, 10); expect(s.active).toEqual([2, 3]);
    s = step(g, s, { I2: true, I3: true }, 10); expect(s.active).toEqual([5]);  // 4 activée puis franchissement immédiat (stabilité)
    s = step(g, s, {}, 5000); expect(s.active).toEqual([0]);
  });
});

describe("Modbus", () => {
  it("CRC-16 et trame RTU de référence (lecture de 10 registres à l'adresse 0 de l'esclave 1 : … C5 CD)", () => {
    expect(hex(rtuFrame({ slave: 1, fn: 3, address: 0, quantity: 10 }))).toBe("01 03 00 00 00 0A C5 CD");
    expect(crc16([0x01, 0x03, 0x00, 0x00, 0x00, 0x0a])).toBe(0xcdc5);
  });
  it("trame TCP : en-tête MBAP (longueur = PDU + 1)", () => {
    expect(hex(tcpFrame({ slave: 17, fn: 6, address: 1, value: 3 }, 7))).toBe("00 07 00 00 00 06 11 06 00 01 00 03");
  });
  it("écriture de plusieurs bits et registres ; limites du protocole", () => {
    expect(rtuFrame({ slave: 1, fn: 15, address: 19, values: [1, 0, 1, 1, 0, 0, 1, 1, 1, 0] }).slice(0, 9)).toEqual([1, 15, 0, 19, 0, 10, 2, 0xcd, 0x01]);
    expect(() => rtuFrame({ slave: 1, fn: 3, address: 0, quantity: 200 })).toThrow(/1…125/);
    expect(() => rtuFrame({ slave: 250, fn: 3, address: 0, quantity: 1 })).toThrow(/0…247/);
  });
  it("décodage des réponses : registres, CRC incorrect, exception", () => {
    const body = [1, 3, 4, 0x00, 0x2a, 0x01, 0x00], c = crc16(body);
    const ok = decodeRtuResponse([...body, c & 0xff, c >> 8]);
    expect(ok.ok).toBe(true); expect(ok.registers).toEqual([42, 256]);
    expect(decodeRtuResponse([...body, 0, 0]).summary).toMatch(/CRC incorrect/);
    const ex = [1, 0x83, 2], ce = crc16(ex);
    expect(decodeRtuResponse([...ex, ce & 0xff, ce >> 8]).exception).toBe("Adresse de donnée invalide");
    expect(parseHex("01 03 0x00")).toEqual([1, 3, 0]);
  });
});

describe("Aláji : orientation vers le laboratoire d'automatisme", () => {
  it("une demande de programme Ladder mobilise l'agent automatisme et ouvre /lab/automatisme", async () => {
    const { analyseRequest, DISCIPLINE_LINKS } = await import("@/server/ai/analysis");
    const a = analyseRequest("Écris un programme ladder pour un démarrage étoile-triangle sur automate");
    expect(a.disciplines.map((d) => d.key)).toContain("industrial");
    expect(a.disciplines.flatMap((d) => DISCIPLINE_LINKS[d.key] ?? []).map((l) => l.href)).toContain("/lab/automatisme");
  });
});
