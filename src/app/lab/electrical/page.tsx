"use client";
import { useState } from "react";
import { useApp } from "@/components/providers";
import { CalcForm, type FieldDef } from "@/components/CalcForm";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, Page, Select, Textarea } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";

const SYS: FieldDef = { k: "system", type: "select", options: [{ v: "single", l: "f.single" }, { v: "three", l: "f.three" }] };
type Table = { id: string; standard: string; table_ref: string; description: string; validated_by_name: string };

export default function Electrical() {
  const { t, me } = useApp();
  const [pid, setPid] = useState("");
  const { data: tables, reload } = useData<{ items: Table[] }>("/api/normative-tables");
  const [tableId, setTableId] = useState("");
  const [nt, setNt] = useState({ standard: "", table_ref: "", description: "", validated_by_name: "", rows: "" });
  const [err, setErr] = useState<unknown>(null);
  return (
    <Page title={t("nav.electrical")} subtitle={t("lab.electrical.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <CalcForm projectId={pid} kind="ohm" fields={[{ k: "u", type: "num" }, { k: "i", type: "num" }, { k: "r", type: "num" }]} />
      <CalcForm projectId={pid} kind="ac_power" fields={[SYS, { k: "u", type: "num" }, { k: "i", type: "num" }, { k: "cosPhi", type: "num" }]} />
      <CalcForm projectId={pid} kind="design_current" fields={[SYS, { k: "pW", type: "num" }, { k: "u", type: "num" }, { k: "cosPhi", type: "num" }, { k: "efficiency", type: "num" }]} />
      <CalcForm projectId={pid} kind="voltage_drop" fields={[SYS, { k: "u", type: "num" }, { k: "i", type: "num" }, { k: "lengthM", type: "num" }, { k: "sectionMm2", type: "num" }, { k: "conductor", type: "select", options: [{ v: "copper", l: "f.copper" }, { v: "aluminium", l: "f.aluminium" }] }, { k: "tempC", type: "num" }, { k: "cosPhi", type: "num" }, { k: "lambdaOhmPerM", type: "num", hint: t("f.lambdaHint") }]}
        transform={(i) => ({ ...i, lambdaOhmPerM: i.lambdaOhmPerM ?? null })} />
      <Card title={t("elec.tables")}>
        <p className="mb-2 text-sm text-[var(--fg-2)]">{t("elec.tablesInfo")}</p>
        <Field label={t("elec.table")}><Select value={tableId} onChange={(e) => setTableId(e.target.value)} data-testid="table-select"><option value="">—</option>{tables?.items.map((x) => <option key={x.id} value={x.id}>{x.standard} · {x.table_ref} · {x.description} ({t("elec.validatedBy")} {x.validated_by_name})</option>)}</Select></Field>
        {me?.is_admin && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-[var(--cyan)]">{t("elec.addTable")}</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {(["standard", "table_ref", "description", "validated_by_name"] as const).map((k) => <Field key={k} label={t(`elec.nt.${k}`)}><Input value={nt[k]} onChange={(e) => setNt({ ...nt, [k]: e.target.value })} /></Field>)}
              <Field label={t("elec.nt.rows")} hint={t("elec.nt.rowsHint")}><Textarea rows={5} value={nt.rows} onChange={(e) => setNt({ ...nt, rows: e.target.value })} /></Field>
              <div className="flex items-end"><Btn onClick={async () => {
                setErr(null);
                try {
                  const rows = nt.rows.split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [s, iz] = l.split(/[;\t ]+/).map((x) => Number(x.replace(",", "."))); return { s, iz }; });
                  await post("/api/normative-tables", { ...nt, rows }); reload();
                } catch (x) { setErr(x); }
              }}>{t("c.save")}</Btn></div>
            </div>
            <ErrorBox error={err} />
          </details>
        )}
      </Card>
      <CalcForm projectId={pid} kind="cable_section" fields={[{ k: "inA", type: "num" }, { k: "factors", type: "text", hint: t("f.factorsHint") }]}
        extra={{ tableId: tableId || null }}
        transform={(i) => ({ inA: i.inA, tableId: i.tableId, correctionFactors: String(i.factors ?? "").split(/[;\s]+/).map((x) => Number(x.replace(",", "."))).filter((x) => Number.isFinite(x) && x > 0) })} />
      <CalcForm projectId={pid} kind="power_balance" fields={[{ k: "loads", type: "rows", cols: [{ k: "name", type: "text" }, { k: "pW", type: "num" }, { k: "qty", type: "int" }, { k: "ku", type: "num" }, { k: "ks", type: "num" }] }]} initial={{ loads: [{}] }} />
    </Page>
  );
}
