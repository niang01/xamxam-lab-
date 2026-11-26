/**
 * Modbus (spécification Modbus Application Protocol V1.1b3 et Modbus over Serial Line V1.02) — fonctions pures :
 * construction des requêtes RTU et TCP, CRC-16 (polynôme 0xA001, valeur initiale 0xFFFF, octet de poids faible
 * transmis en premier), décodage des réponses et des exceptions.
 */

export const FUNCTIONS: Record<number, string> = {
  1: "Lecture de bits de sortie (Read Coils)", 2: "Lecture de bits d'entrée (Read Discrete Inputs)",
  3: "Lecture de registres de maintien (Read Holding Registers)", 4: "Lecture de registres d'entrée (Read Input Registers)",
  5: "Écriture d'un bit (Write Single Coil)", 6: "Écriture d'un registre (Write Single Register)",
  15: "Écriture de plusieurs bits (Write Multiple Coils)", 16: "Écriture de plusieurs registres (Write Multiple Registers)",
};
export const EXCEPTIONS: Record<number, string> = {
  1: "Fonction non reconnue par l'esclave", 2: "Adresse de donnée invalide", 3: "Valeur de donnée invalide",
  4: "Défaillance de l'esclave", 5: "Acquittement (traitement long en cours)", 6: "Esclave occupé",
  8: "Erreur de parité mémoire", 10: "Chemin de passerelle indisponible", 11: "Pas de réponse de l'équipement cible",
};

export function crc16(bytes: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] & 0xff;
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

export interface Request { slave: number; fn: number; address: number; quantity?: number; value?: number; values?: number[] }

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];

/** PDU (code fonction + données) d'une requête ; erreurs explicites hors des limites du protocole. */
export function requestPdu(r: Request): number[] {
  const err = (m: string): never => { throw new Error(m); };
  if (!FUNCTIONS[r.fn]) err(`Code fonction ${r.fn} non pris en charge`);
  if (!(r.address >= 0 && r.address <= 0xffff)) err("Adresse hors de 0…65535");
  switch (r.fn) {
    case 1: case 2: case 3: case 4: {
      const q = r.quantity ?? 0, max = r.fn <= 2 ? 2000 : 125;
      if (!(q >= 1 && q <= max)) err(`Quantité hors de 1…${max}`);
      return [r.fn, ...u16(r.address), ...u16(q)];
    }
    case 5: return [5, ...u16(r.address), ...(r.value ? [0xff, 0x00] : [0x00, 0x00])];
    case 6: { const v = r.value ?? err("Valeur du registre manquante"); if (!(v >= 0 && v <= 0xffff)) err("Valeur hors de 0…65535"); return [6, ...u16(r.address), ...u16(v)]; }
    case 15: {
      const vals = r.values ?? []; if (!(vals.length >= 1 && vals.length <= 1968)) err("Nombre de bits hors de 1…1968");
      const bytes = Array.from({ length: Math.ceil(vals.length / 8) }, (_, k) => vals.slice(k * 8, k * 8 + 8).reduce((a, v, j) => a | ((v ? 1 : 0) << j), 0));
      return [15, ...u16(r.address), ...u16(vals.length), bytes.length, ...bytes];
    }
    case 16: {
      const vals = r.values ?? []; if (!(vals.length >= 1 && vals.length <= 123)) err("Nombre de registres hors de 1…123");
      if (vals.some((v) => !(v >= 0 && v <= 0xffff))) err("Valeur de registre hors de 0…65535");
      return [16, ...u16(r.address), ...u16(vals.length), vals.length * 2, ...vals.flatMap(u16)];
    }
  }
  return err("Fonction non prise en charge");
}

/** Trame RTU : esclave + PDU + CRC (poids faible d'abord). */
export function rtuFrame(r: Request): number[] {
  if (!(r.slave >= 0 && r.slave <= 247)) throw new Error("Numéro d'esclave hors de 0…247");
  const body = [r.slave, ...requestPdu(r)];
  const c = crc16(body);
  return [...body, c & 0xff, c >> 8];
}

/** Trame TCP : en-tête MBAP (transaction, protocole 0, longueur, unité) + PDU. */
export function tcpFrame(r: Request, transaction = 1): number[] {
  const pdu = requestPdu(r);
  return [...u16(transaction), 0, 0, ...u16(pdu.length + 1), r.slave & 0xff, ...pdu];
}

export const hex = (b: number[]) => b.map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");
export function parseHex(s: string): number[] {
  const t = s.replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (t.length % 2) throw new Error("Nombre impair de chiffres hexadécimaux");
  return Array.from({ length: t.length / 2 }, (_, i) => parseInt(t.slice(i * 2, i * 2 + 2), 16));
}

export interface Decoded { ok: boolean; crcOk: boolean | null; slave: number; fn: number; exception: string | null; summary: string; registers?: number[]; bits?: boolean[] }

/** Décodage d'une réponse RTU (CRC vérifié) : registres, bits, écho d'écriture ou exception. */
export function decodeRtuResponse(frame: number[], quantity?: number): Decoded {
  if (frame.length < 5) return { ok: false, crcOk: null, slave: frame[0] ?? 0, fn: frame[1] ?? 0, exception: null, summary: "Trame trop courte (5 octets au minimum)" };
  const c = crc16(frame.slice(0, -2)), crcOk = (frame[frame.length - 2] | (frame[frame.length - 1] << 8)) === c;
  const [slave, fn] = frame;
  const base = { slave, fn: fn & 0x7f, crcOk };
  if (!crcOk) return { ...base, ok: false, exception: null, summary: `CRC incorrect : attendu ${hex([c & 0xff, c >> 8])}` };
  if (fn & 0x80) { const code = frame[2]; return { ...base, ok: false, exception: EXCEPTIONS[code] ?? `Code ${code}`, summary: `Exception ${code} : ${EXCEPTIONS[code] ?? "inconnue"}` }; }
  if (fn === 3 || fn === 4) {
    const n = frame[2] / 2, registers = Array.from({ length: n }, (_, i) => (frame[3 + 2 * i] << 8) | frame[4 + 2 * i]);
    return { ...base, ok: true, exception: null, registers, summary: `${n} registre(s) : ${registers.join(", ")}` };
  }
  if (fn === 1 || fn === 2) {
    const nb = frame[2], all = Array.from({ length: nb * 8 }, (_, i) => !!((frame[3 + (i >> 3)] >> (i & 7)) & 1));
    const bits = quantity ? all.slice(0, quantity) : all;
    return { ...base, ok: true, exception: null, bits, summary: `${bits.length} bit(s) : ${bits.map((b) => (b ? 1 : 0)).join("")}` };
  }
  const addr = (frame[2] << 8) | frame[3], val = (frame[4] << 8) | frame[5];
  return { ...base, ok: true, exception: null, summary: fn === 5 ? `Bit ${addr} écrit à ${val === 0xff00 ? 1 : 0}` : fn === 6 ? `Registre ${addr} écrit à ${val}` : `${val} élément(s) écrit(s) à partir de l'adresse ${addr}` };
}
