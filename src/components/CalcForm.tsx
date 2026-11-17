"use client";
/**
 * Formulaire de calcul générique : champs décrits, champ vide = paramètre manquant (jamais remplacé par une valeur
 * par défaut), envoi au registre serveur, résultat normalisé (formules, hypothèses, références, manquants).
 */
import { useState } from "react";
import { useT } from "./providers";
import { Btn, CalcView, Card, ErrorBox, Field, Input, Select, num } from "./ui";
import { post } from "@/lib/client/api";
import type { CalcResult } from "@/lib/eng/result";
import type { MsgKey } from "@/lib/i18n/messages";

export type FieldDef =
  | { k: string; type: "num"; hint?: string }
  | { k: string; type: "text"; hint?: string }
  | { k: string; type: "select"; options: { v: string; l: MsgKey }[] }
  | { k: string; type: "months" }
  | { k: string; type: "rows"; cols: { k: string; type: "num" | "text" | "int"; l?: MsgKey }[] };

type V = string | string[] | Record<string, string>[];

function toInput(fields: FieldDef[], v: Record<string, V>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const x = v[f.k];
    if (f.type === "num") out[f.k] = num((x as string) ?? "");
    else if (f.type === "text" || f.type === "select") out[f.k] = x ?? "";
    else if (f.type === "months") out[f.k] = ((x as string[]) ?? Array(12).fill("")).map(num);
    else out[f.k] = ((x as Record<string, string>[]) ?? []).map((r) => Object.fromEntries(f.cols.map((c) => [c.k, c.type === "text" ? r[c.k] ?? "" : c.type === "int" ? Math.round(num(r[c.k] ?? "") ?? NaN) : num(r[c.k] ?? "")])));
  }
  return out;
}

export function CalcForm({ kind, fields, projectId, initial, extra, onResult, transform }: {
  kind: string; fields: FieldDef[]; projectId: string; initial?: Record<string, V>; extra?: Record<string, unknown>;
  onResult?: (r: CalcResult) => void; transform?: (input: Record<string, unknown>) => Record<string, unknown>;
}) {
  const t = useT();
  const [v, setV] = useState<Record<string, V>>(initial ?? {});
  const [r, setR] = useState<CalcResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const label = (k: string) => t(`f.${k}` as MsgKey);

  async function run() {
    setBusy(true); setErr(null);
    try {
      let input = { ...toInput(fields, v), ...(extra ?? {}) };
      if (transform) input = transform(input);
      const res = await post<{ result: CalcResult }>(`/api/calc/${kind}`, { project_id: projectId || null, input });
      setR(res.result); onResult?.(res.result);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  }

  return (
    <Card title={t(`calc.${kind}` as MsgKey)} testId={`calc-${kind}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => {
          if (f.type === "num" || f.type === "text") return <Field key={f.k} label={label(f.k)} hint={f.hint}><Input name={f.k} inputMode={f.type === "num" ? "decimal" : "text"} value={(v[f.k] as string) ?? ""} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} /></Field>;
          if (f.type === "select") return <Field key={f.k} label={label(f.k)}><Select name={f.k} value={(v[f.k] as string) ?? f.options[0].v} onChange={(e) => setV({ ...v, [f.k]: e.target.value })}>{f.options.map((o) => <option key={o.v} value={o.v}>{t(o.l)}</option>)}</Select></Field>;
          if (f.type === "months") {
            const arr = (v[f.k] as string[]) ?? Array(12).fill("");
            return (
              <div key={f.k} className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-sm text-[var(--fg-2)]">{label(f.k)}</div>
                <div className="grid grid-cols-4 gap-2 md:grid-cols-6 lg:grid-cols-12">{arr.map((x, i) => <Input key={i} aria-label={`${label(f.k)} ${i + 1}`} name={`${f.k}-${i}`} placeholder={String(i + 1)} value={x} onChange={(e) => { const a = [...arr]; a[i] = e.target.value; setV({ ...v, [f.k]: a }); }} />)}</div>
              </div>
            );
          }
          const rows = (v[f.k] as Record<string, string>[]) ?? [];
          return (
            <div key={f.k} className="sm:col-span-2 lg:col-span-3">
              <div className="mb-1 text-sm text-[var(--fg-2)]">{label(f.k)}</div>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    {f.cols.map((c) => <Input key={c.k} aria-label={c.l ? t(c.l) : label(c.k)} placeholder={c.l ? t(c.l) : label(c.k)} className="!w-36" value={row[c.k] ?? ""} onChange={(e) => { const a = rows.map((x) => ({ ...x })); a[i][c.k] = e.target.value; setV({ ...v, [f.k]: a }); }} />)}
                    <Btn kind="ghost" onClick={() => setV({ ...v, [f.k]: rows.filter((_, j) => j !== i) })}>✕</Btn>
                  </div>
                ))}
                <Btn kind="ghost" onClick={() => setV({ ...v, [f.k]: [...rows, {}] })}>+ {t("c.add")}</Btn>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2"><Btn onClick={run} disabled={busy} data-testid={`run-${kind}`}>{t("c.calculate")}</Btn></div>
      <div className="mt-3"><ErrorBox error={err} /><CalcView r={r} /></div>
    </Card>
  );
}
