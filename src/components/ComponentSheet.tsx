"use client";
/**
 * Fiche détaillée d'une référence : photographie réelle (licence, auteur, source), symbole conventionnel, brochage,
 * brochage interactif des cartes, modèle 3D du boîtier, caractéristiques, fiche technique, sources, offres en rayon.
 * Les quatre représentations sont distinctes : photo, symbole, modèle 3D, modèle de simulation.
 */
import Link from "next/link";
import { useT } from "@/components/providers";
import { Pill } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { SymbolIcon } from "@/components/SymbolIcon";
import { BoardPinout } from "@/components/BoardPinout";
import { PackageModel3D } from "@/components/PackageModel3D";
import { BOARDS } from "@/lib/catalogue/boards";

export type Photo = { file: string; title: string; author: string; license: string; license_url: string | null; source: string; w?: number; h?: number };
type Detail = {
  id: string; name: string; mpn: string | null; manufacturer: string | null; category: string; subcategory: string | null; description: string; datasheet_url: string | null;
  specs: Record<string, string>; symbol2d: string | null; symbol_kind: string | null; status: string; footprint: string | null; model3d: string | null; photos: Photo[];
  pinout: { board?: string; pins?: { n: string; name: string; type: string }[] } | null; sources: { label: string; url: string | null; license?: string }[];
  variants: string[]; offers: { id: string; title: string; price_xof: number | null; quantity: number | null }[]; precautions: string | null;
};
const PIN_TYPE: Record<string, string> = { input: "entrée", output: "sortie", bidirectional: "entrée/sortie", tri_state: "trois états", passive: "passive", power_in: "alimentation (entrée)", power_out: "alimentation (sortie)", open_collector: "collecteur ouvert", open_emitter: "émetteur ouvert", no_connect: "non connectée", unspecified: "non précisé", free: "libre" };

export function PhotoCredit({ p }: { p: Photo }) {
  return <p className="text-[10px] leading-tight text-[var(--fg-3)]">Photo : {p.author} — <a className="underline" href={p.license_url ?? p.source} target="_blank" rel="noreferrer noopener">{p.license}</a> — <a className="underline" href={p.source} target="_blank" rel="noreferrer noopener">Wikimedia Commons</a></p>;
}

export function ComponentSheet({ id }: { id: string }) {
  const t = useT();
  const { data: c, error } = useData<Detail>(`/api/components/${id}`);
  if (error) return <p className="text-sm text-[var(--danger)]">{error.message}</p>;
  if (!c) return <p className="text-sm text-[var(--fg-3)]">{t("c.loading")}</p>;
  const board = c.pinout?.board ? BOARDS.find((b) => b.key === c.pinout!.board) : null;
  const pins = c.pinout?.pins ?? [];
  return (
    <div className="space-y-3 rounded-lg bg-[var(--bg-2)] p-3 text-sm text-[var(--fg-2)]" data-testid="component-sheet">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-2">
          {c.photos.length ? c.photos.map((p) => (
            <figure key={p.file} data-photo={p.file}>
              {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par la plateforme */}
              <img src={`/catalogue/photos/${p.file}`} alt={`${c.name} — photographie`} className="w-full rounded-lg bg-white object-contain" style={{ maxHeight: 280 }} loading="lazy" />
              <PhotoCredit p={p} />
            </figure>
          )) : <p className="rounded-lg border border-dashed border-[var(--line)] p-3 text-xs" data-testid="no-photo">{t("ref.noPhoto")}</p>}
          <div className="flex items-center gap-2 text-xs"><SymbolIcon name={c.name} code={c.symbol2d} size={64} /><span>{t("ref.symbol")}</span></div>
        </div>
        <div className="space-y-2">
          <p className="text-[var(--fg)]"><strong className="text-base">{c.name}</strong>{c.manufacturer && <> — {c.manufacturer}</>}</p>
          <div className="flex flex-wrap gap-1"><Pill>{c.category}</Pill>{c.subcategory && <Pill tone="info">{c.subcategory}</Pill>}<Pill tone={c.status === "catalogue" ? "ok" : c.status === "verified" ? "ok" : "warn"}>{t(`comp.status.${c.status}` as "comp.status.generic")}</Pill></div>
          <p>{c.description}</p>
          {Object.keys(c.specs ?? {}).length > 0 && <table className="text-xs" data-testid="ref-specs"><tbody>{Object.entries(c.specs).map(([k, v]) => <tr key={k}><td className="pr-3 align-top text-[var(--fg-3)]">{k}</td><td className="font-mono">{v}</td></tr>)}</tbody></table>}
          {c.precautions && <p className="text-[var(--warn)]">⚠ {c.precautions}</p>}
          <div className="flex flex-wrap gap-3 text-xs">
            {c.datasheet_url && <a href={c.datasheet_url} target="_blank" rel="noreferrer noopener" className="text-[var(--cyan)] underline" data-testid="ref-datasheet">{t("comp.datasheet")}</a>}
            <a href={`/schemas?ajout=${encodeURIComponent(c.id)}`} className="text-[var(--cyan)] underline" data-testid="ref-use-diagram">{t("comp.useInDiagram")}</a>
            {c.symbol_kind && <a href="/lab/electronics" className="text-[var(--cyan)] underline">{t("comp.useInEditor")}</a>}
            <Link href={`/boutique?q=${encodeURIComponent(c.mpn && c.mpn !== "generic" ? c.mpn : c.name)}`} className="text-[var(--cyan)] underline">{t("ref.shop")}</Link>
          </div>
          <p className="text-xs">{t("ref.simulation")} {c.symbol_kind ? t("ref.simGeneric") : t("ref.simNone")}</p>
          <div className="text-xs">
            <strong>{t("ref.offers")}</strong> {c.offers.length ? c.offers.map((o) => <span key={o.id} className="mr-2">{o.title} — {o.price_xof != null ? `${Number(o.price_xof).toLocaleString("fr-FR")} FCFA` : t("shop.onRequest")}</span>) : <span data-testid="ref-no-offer">{t("ref.noOffer")}</span>}
          </div>
        </div>
      </div>
      {board && <BoardPinout board={board} />}
      {pins.length > 0 && (
        <details open={!board && pins.length <= 24}>
          <summary className="cursor-pointer text-xs font-semibold">{t("ref.pins", { n: pins.length })}</summary>
          <div className="mt-1 max-h-72 overflow-auto"><table className="w-full text-xs" data-testid="ref-pins"><thead><tr className="text-left text-[var(--fg-3)]"><th>N°</th><th>{t("ref.pinName")}</th><th>{t("ref.pinType")}</th></tr></thead>
            <tbody>{pins.map((p) => <tr key={p.n} className="border-t border-[var(--line)]"><td className="font-mono">{p.n}</td><td className="font-mono">{p.name}</td><td>{PIN_TYPE[p.type] ?? p.type}</td></tr>)}</tbody></table></div>
        </details>
      )}
      {c.model3d && <PackageModel3D file={c.model3d} label={c.footprint?.split(":").pop() ?? ""} />}
      {c.variants?.length > 0 && <p className="text-xs"><strong>{t("ref.variants")}</strong> {c.variants.join(", ")}</p>}
      {c.sources?.length > 0 && <ul className="text-[11px] text-[var(--fg-3)]" data-testid="ref-sources">{c.sources.map((s) => <li key={s.label}>{t("ref.source")} {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer noopener">{s.label}</a> : s.label}{s.license ? ` (${s.license})` : ""}</li>)}</ul>}
    </div>
  );
}
