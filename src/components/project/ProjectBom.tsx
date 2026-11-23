"use client";
/** Liste des composants et budget prévisionnel : prix saisis par l'équipe, total par devise, lignes sans prix signalées. */
import { useState } from "react";
import { useApp } from "@/components/providers";
import { Btn, Card, ErrorBox, Input } from "@/components/ui";
import { del, patch, post } from "@/lib/client/api";

export type Line = { id: string; component_id: string | null; name: string; qty: number; unit_price: number | null; currency: string; supplier: string | null; note: string | null };

export function totals(items: Line[]) {
  const by = new Map<string, number>();
  let unpriced = 0;
  for (const i of items) { if (i.unit_price == null) unpriced++; else by.set(i.currency, (by.get(i.currency) ?? 0) + Number(i.qty) * Number(i.unit_price)); }
  return { by: [...by], unpriced };
}

export function ProjectBom({ id, items, canEdit, onChange }: { id: string; items: Line[]; canEdit: boolean; onChange: () => void }) {
  const { t } = useApp();
  const [n, setN] = useState({ name: "", qty: "1", price: "" });
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); onChange(); } catch (e) { setErr(e); } };
  const tot = totals(items);
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  return (
    <Card title={t("proj.bom")} testId="project-bom">
      <ErrorBox error={err} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[var(--fg-3)]"><th className="py-1">{t("proj.item")}</th><th>{t("proj.qty")}</th><th>{t("proj.unitPrice")}</th><th>{t("proj.lineTotal")}</th><th /></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id} className="border-t border-[var(--line)]" data-bom={i.name}>
              <td className="py-1 pr-2">{i.name}</td>
              <td className="pr-2">{canEdit ? <Input aria-label={t("proj.qty")} defaultValue={String(i.qty)} className="!w-16" onBlur={(e) => { const q = num(e.target.value); if (q && q !== Number(i.qty)) void run(() => patch(`/api/projects/${id}/components/${i.id}`, { qty: q })); }} /> : i.qty}</td>
              <td className="pr-2">{canEdit ? <Input aria-label={t("proj.unitPrice")} name="unit-price" defaultValue={i.unit_price == null ? "" : String(i.unit_price)} placeholder={t("proj.toComplete")} className="!w-28" onBlur={(e) => { const v = num(e.target.value); if (v !== (i.unit_price == null ? null : Number(i.unit_price))) void run(() => patch(`/api/projects/${id}/components/${i.id}`, { unit_price: v })); }} /> : i.unit_price ?? "—"} <span className="text-xs text-[var(--fg-3)]">{i.currency}</span></td>
              <td className="pr-2 font-mono">{i.unit_price == null ? "—" : `${Number(i.qty) * Number(i.unit_price)} ${i.currency}`}</td>
              <td>{canEdit && <button aria-label={t("c.delete")} onClick={() => run(() => del(`/api/projects/${id}/components/${i.id}`))}>✕</button>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-sm" data-testid="bom-total"><strong>{t("proj.total")} :</strong> {tot.by.map(([c, v]) => `${v} ${c}`).join(" + ") || "—"}{tot.unpriced ? <span className="text-[var(--warn)]"> — {t("proj.unpriced", { n: tot.unpriced })}</span> : null}</p>
      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input aria-label={t("proj.item")} name="bom-name" placeholder={t("proj.item")} value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} className="!w-56" />
          <Input aria-label={t("proj.qty")} value={n.qty} onChange={(e) => setN({ ...n, qty: e.target.value })} className="!w-16" />
          <Input aria-label={t("proj.unitPrice")} placeholder={t("proj.unitPrice")} value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} className="!w-28" />
          <Btn kind="ghost" disabled={!n.name.trim()} onClick={() => run(async () => { await post(`/api/projects/${id}/components`, { items: [{ name: n.name, qty: num(n.qty) ?? 1, unit_price: num(n.price) }] }); setN({ name: "", qty: "1", price: "" }); })}>{t("c.add")}</Btn>
        </div>
      )}
      <p className="mt-2 text-xs text-[var(--fg-3)]">{t("proj.bomInfo")}</p>
    </Card>
  );
}
