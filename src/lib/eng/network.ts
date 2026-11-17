/** Computer & Network Lab — calculs d'adressage IPv4 (fonctions pures). */
import { result, type CalcResult } from "./result";

export function parseIpv4(s: string): number | null {
  const m = s.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}
export const ipToStr = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
const maskOf = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

export interface Subnet { network: string; prefix: number; mask: string; broadcast: string; first: string | null; last: string | null; hosts: number }

export function subnet(cidr: string): Subnet | null {
  const [ip, pfx] = cidr.split("/");
  const n = parseIpv4(ip ?? "");
  const p = Number(pfx);
  if (n == null || !Number.isInteger(p) || p < 0 || p > 32) return null;
  const mask = maskOf(p);
  const net = (n & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const hosts = p >= 31 ? (p === 31 ? 2 : 1) : 2 ** (32 - p) - 2;
  return { network: ipToStr(net), prefix: p, mask: ipToStr(mask), broadcast: ipToStr(bc), first: p >= 31 ? ipToStr(net) : ipToStr(net + 1), last: p >= 31 ? ipToStr(bc) : ipToStr(bc - 1), hosts };
}

/** Découpage VLSM : attribue, du plus grand besoin au plus petit, des sous-réseaux contigus dans le bloc donné. */
export function vlsm(block: string, needs: { name: string; hosts: number }[]): CalcResult & { subnets?: (Subnet & { name: string })[] } {
  const b = subnet(block);
  if (!b) return result({ missing: ["bloc CIDR valide (ex. 192.168.10.0/24)"] });
  let cur = parseIpv4(b.network)!;
  const end = parseIpv4(b.broadcast)!;
  const out: (Subnet & { name: string })[] = [];
  for (const nd of [...needs].sort((a, c) => c.hosts - a.hosts)) {
    let p = 32;
    while (p > 0 && 2 ** (32 - p) - 2 < nd.hosts) p--;
    const size = 2 ** (32 - p);
    cur = Math.ceil(cur / size) * size;
    if (cur + size - 1 > end) return result({ warnings: [`Espace insuffisant pour « ${nd.name} » (${nd.hosts} hôtes)`] });
    out.push({ name: nd.name, ...subnet(`${ipToStr(cur)}/${p}`)! });
    cur += size;
  }
  return { ...result({ formulas: ["Préfixe minimal tel que 2^(32−p) − 2 ≥ hôtes"] }), subnets: out };
}
