"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/providers";
import { SchematicEditor } from "@/components/SchematicEditor";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Btn, Card, ErrorBox, Field, Input, LineChart, Nature, Page, Pill, Select } from "@/components/ui";
import { api, post, put, RequestError } from "@/lib/client/api";
import type { Analysis, Graph } from "@/lib/spice/netlist";

type SimResult = { ok: boolean; id?: string; issues: { level: string; message: string }[]; netlist?: string; engine?: string; errors?: string[]; traces?: { name: string; type: string; values: number[]; imag?: number[] }[]; points?: number; complex?: boolean; durationMs?: number; inputHash?: string };

/** Circuits d'exemple (pédagogiques, modifiables) — ce ne sont pas des données mesurées. */
const EXAMPLES: Record<string, Graph> = {
  divider: {
    parts: [{ id: "V1", type: "V", x: 160, y: 220, rot: 90, value: "DC 5" }, { id: "R1", type: "R", x: 300, y: 140, rot: 0, value: "1k" }, { id: "R2", type: "R", x: 400, y: 220, rot: 90, value: "2k" }, { id: "G1", type: "GND", x: 280, y: 360, rot: 0, value: "" }],
    wires: [{ a: { part: "V1", pin: 0 }, b: { part: "R1", pin: 0 } }, { a: { part: "R1", pin: 1 }, b: { part: "R2", pin: 0 } }, { a: { part: "R2", pin: 1 }, b: { part: "G1", pin: 0 } }, { a: { part: "V1", pin: 1 }, b: { part: "G1", pin: 0 } }],
  },
  rc: {
    parts: [{ id: "V1", type: "V", x: 160, y: 220, rot: 90, value: "PULSE(0 5 0 1u 1u 5m 10m) AC 1" }, { id: "R1", type: "R", x: 300, y: 140, rot: 0, value: "1k" }, { id: "C1", type: "C", x: 400, y: 220, rot: 90, value: "1u" }, { id: "G1", type: "GND", x: 280, y: 360, rot: 0, value: "" }],
    wires: [{ a: { part: "V1", pin: 0 }, b: { part: "R1", pin: 0 } }, { a: { part: "R1", pin: 1 }, b: { part: "C1", pin: 0 } }, { a: { part: "C1", pin: 1 }, b: { part: "G1", pin: 0 } }, { a: { part: "V1", pin: 1 }, b: { part: "G1", pin: 0 } }],
  },
};

export default function Electronics() {
  const t = useT();
  const [pid, setPid] = useState("");
  const [graph, setGraph] = useState<Graph>({ parts: [], wires: [] });
  const [schema, setSchema] = useState<{ id: string; version: number; title: string } | null>(null);
  const [title, setTitle] = useState("");
  const [an, setAn] = useState<Analysis>({ kind: "op" });
  const [res, setRes] = useState<SimResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(async (id: string) => {
    const s = await api<{ id: string; version: number; title: string; graph: Graph; project_id: string | null }>(`/api/schematics/${id}`);
    setSchema({ id: s.id, version: s.version, title: s.title }); setTitle(s.title); setGraph(s.graph); if (s.project_id) setPid(s.project_id);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec une source externe (URL, session, WebGL)
  useEffect(() => { const id = new URLSearchParams(window.location.search).get("schema"); if (id) void load(id).catch(setErr); }, [load]);

  async function save() {
    setErr(null); setMsg("");
    try {
      if (schema) { const r = await put<{ version: number }>(`/api/schematics/${schema.id}`, { graph, base_version: schema.version, title: title || schema.title }); setSchema({ ...schema, version: r.version }); }
      else { const r = await post<{ id: string; version: number }>("/api/schematics", { graph, title: title || t("sch.untitled"), project_id: pid || null, lab: "electronics" }); setSchema({ id: r.id, version: r.version, title }); window.history.replaceState(null, "", `?schema=${r.id}`); }
      setMsg(t("c.saved"));
    } catch (e) { setErr(e); }
  }
  async function simulate() {
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await post<SimResult>("/api/simulate", { graph, analysis: an, project_id: pid || null, schematic_id: schema?.id ?? null, title: title || undefined })); }
    catch (e) { if (e instanceof RequestError && e.status === 422 && e.details === undefined) setErr(e); else setErr(e); try { const d = (e as RequestError); if (d.status === 422) setRes(null); } catch { /* ignore */ } }
    finally { setBusy(false); }
  }
  // La route renvoie 422 avec le détail ERC : on le récupère pour l'afficher.
  async function simulateRaw() {
    setBusy(true); setErr(null); setRes(null);
    const r = await fetch("/api/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ graph, analysis: an, project_id: pid || null, schematic_id: schema?.id ?? null, title: title || undefined }) });
    const d = await r.json();
    if (r.status === 200 || r.status === 422) setRes(d as SimResult); else setErr(new RequestError(r.status, d.error, d.key, d.details));
    setBusy(false);
  }
  void simulate;

  const x = res?.traces?.[0];
  const ys = (res?.traces ?? []).slice(an.kind === "op" ? 0 : 1);
  const mag = (tr: { values: number[]; imag?: number[] }) => tr.values.map((re, i) => Math.hypot(re, tr.imag?.[i] ?? 0));
  return (
    <Page title={t("nav.electronics")} subtitle={t("lab.electronics.desc")} actions={<ProjectPicker value={pid} onChange={setPid} />}>
      <Card title={t("sch.schematic")} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={t("sch.examples")} defaultValue="" onChange={(e) => { const g = EXAMPLES[e.target.value]; if (g) { setGraph(structuredClone(g)); setRes(null); } e.target.value = ""; }} className="!w-auto">
            <option value="">{t("sch.examples")}…</option><option value="divider">{t("sch.ex.divider")}</option><option value="rc">{t("sch.ex.rc")}</option>
          </Select>
          <Link href="/studio" className="text-xs text-[var(--cyan)] underline">{t("nav.studio")}</Link>
        </div>}>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label={t("c.title")}><Input name="schema-title" value={title} onChange={(e) => setTitle(e.target.value)} className="!w-64" /></Field>
          <Btn onClick={save} data-testid="save-schematic">{t("c.save")}{schema ? ` (v${schema.version} → v${schema.version + 1})` : ""}</Btn>
          {msg && <Pill tone="ok">{msg}</Pill>}
        </div>
        <SchematicEditor graph={graph} onChange={(g) => { setGraph(g); }} />
      </Card>
      <Card title={t("sch.simulation")}>
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("studio.analysis")}>
            <Select name="analysis" value={an.kind} onChange={(e) => {
              const k = e.target.value;
              setAn(k === "op" ? { kind: "op" } : k === "tran" ? { kind: "tran", step: "10u", stop: "5m" } : k === "dc" ? { kind: "dc", source: graph.parts.find((p) => p.type === "V")?.id ?? "V1", start: "0", stop: "5", step: "0.1" } : { kind: "ac", points: 20, fstart: "10", fstop: "100k" });
            }}>
              <option value="op">{t("sim.op")}</option><option value="tran">{t("sim.tran")}</option><option value="dc">{t("sim.dc")}</option><option value="ac">{t("sim.ac")}</option>
            </Select>
          </Field>
          {an.kind === "tran" && <><Field label={t("sim.step")}><Input value={an.step} onChange={(e) => setAn({ ...an, step: e.target.value })} className="!w-24" /></Field><Field label={t("sim.stop")}><Input value={an.stop} onChange={(e) => setAn({ ...an, stop: e.target.value })} className="!w-24" /></Field></>}
          {an.kind === "dc" && <><Field label={t("sim.source")}><Select value={an.source} onChange={(e) => setAn({ ...an, source: e.target.value })}>{graph.parts.filter((p) => p.type === "V").map((p) => <option key={p.id}>{p.id}</option>)}</Select></Field>{(["start", "stop", "step"] as const).map((k) => <Field key={k} label={t(`sim.${k}`)}><Input value={an[k]} onChange={(e) => setAn({ ...an, [k]: e.target.value })} className="!w-20" /></Field>)}</>}
          {an.kind === "ac" && <><Field label={t("sim.points")}><Input value={String(an.points)} onChange={(e) => setAn({ ...an, points: Number(e.target.value) || 1 })} className="!w-20" /></Field><Field label={t("sim.fstart")}><Input value={an.fstart} onChange={(e) => setAn({ ...an, fstart: e.target.value })} className="!w-24" /></Field><Field label={t("sim.fstop")}><Input value={an.fstop} onChange={(e) => setAn({ ...an, fstop: e.target.value })} className="!w-24" /></Field></>}
          <Btn onClick={simulateRaw} disabled={busy || !graph.parts.length} data-testid="simulate">{busy ? t("c.loading") : t("sim.run")}</Btn>
        </div>
        {an.kind === "ac" && <p className="mt-2 text-xs text-[var(--fg-3)]">{t("sim.acHint")}</p>}
        <div className="mt-3"><ErrorBox error={err} /></div>
        {res && (
          <div className="mt-3 space-y-3" data-testid="sim-result">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Nature kind="simulation" />{res.engine && <span className="text-[var(--fg-2)]">{res.engine}</span>}
              {res.ok ? <Pill tone="ok">{t("sim.done")}</Pill> : <Pill tone="danger">{t("sim.failed")}</Pill>}
              {res.durationMs != null && <span className="text-[var(--fg-3)]">{res.durationMs} ms · {res.points} pts · SHA-256 {res.inputHash?.slice(0, 10)}…</span>}
              {res.id && <Link className="text-[var(--cyan)] underline" href={`/studio?sim=${res.id}`}>{t("sim.openStudio")}</Link>}
            </div>
            {res.issues.length > 0 && <ul className="text-xs">{res.issues.map((i, k) => <li key={k} className={i.level === "error" ? "text-[var(--danger)]" : "text-[var(--warn)]"}>{i.message}</li>)}</ul>}
            {!!res.errors?.length && <pre className="max-h-40 overflow-auto rounded bg-[var(--bg-2)] p-2 text-xs text-[var(--danger)]">{res.errors.join("\n")}</pre>}
            {res.ok && an.kind === "op" && (
              <table className="text-sm" data-testid="op-table"><tbody>{(res.traces ?? []).map((tr) => <tr key={tr.name} className="border-b border-[var(--line)]"><td className="pr-6 font-mono">{tr.name}</td><td className="font-mono">{tr.values[0].toPrecision(6)} {tr.type === "current" ? "A" : "V"}</td></tr>)}</tbody></table>
            )}
            {res.ok && an.kind !== "op" && x && (
              <>
                <div className="flex flex-wrap gap-2 text-xs">{ys.map((tr) => <label key={tr.name} className="inline-flex items-center gap-1"><input type="checkbox" checked={!hidden.has(tr.name)} onChange={() => { const h = new Set(hidden); if (h.has(tr.name)) h.delete(tr.name); else h.add(tr.name); setHidden(h); }} />{tr.name}</label>)}</div>
                <LineChart logX={an.kind === "ac"} xLabel={x.name === "time" ? "t (s)" : x.name === "frequency" ? "f (Hz)" : x.name} yLabel={an.kind === "ac" ? "|V| (V), |I| (A)" : "V, A"}
                  series={ys.filter((tr) => !hidden.has(tr.name)).map((tr) => ({ name: tr.name, x: x.values, y: res.complex ? mag(tr) : tr.values }))} />
              </>
            )}
            {res.netlist && <details className="text-xs"><summary className="cursor-pointer text-[var(--fg-2)]">{t("sim.netlist")}</summary><pre className="mt-1 overflow-auto rounded bg-[var(--bg-2)] p-2">{res.netlist}</pre></details>}
          </div>
        )}
      </Card>
    </Page>
  );
}
