"use client";
/** Informatique industrielle : construction et décodage de trames Modbus RTU / TCP (CRC-16 calculé, exceptions décodées). */
import { useMemo, useState } from "react";
import { useT } from "@/components/providers";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { FUNCTIONS, decodeRtuResponse, hex, parseHex, rtuFrame, tcpFrame } from "@/lib/plc/modbus";

export function ModbusTool() {
  const t = useT();
  const [f, setF] = useState({ mode: "rtu", slave: "1", fn: "3", address: "0", quantity: "10", value: "0", values: "1,0,1" });
  const [resp, setResp] = useState("");
  const req = useMemo(() => {
    try {
      const fn = Number(f.fn), vals = f.values.split(/[,;\s]+/).filter(Boolean).map(Number);
      const r = { slave: Number(f.slave), fn, address: Number(f.address), quantity: Number(f.quantity), value: Number(f.value), values: vals };
      const frame = f.mode === "rtu" ? rtuFrame(r) : tcpFrame(r);
      return { ok: true as const, frame: hex(frame), n: frame.length };
    } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  }, [f]);
  const dec = useMemo(() => { if (!resp.trim()) return null; try { return decodeRtuResponse(parseHex(resp), Number(f.quantity) || undefined); } catch (e) { return { ok: false, summary: (e as Error).message, crcOk: null }; } }, [resp, f.quantity]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fn = Number(f.fn);
  return (
    <Card title={t("plc.modbus")} testId="modbus-tool">
      <p className="text-sm text-[var(--fg-2)]">{t("plc.modbusInfo")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Field label={t("plc.mbMode")}><Select name="mb-mode" value={f.mode} onChange={set("mode")}><option value="rtu">RTU (RS-485)</option><option value="tcp">TCP (Ethernet, port 502)</option></Select></Field>
        <Field label={t("plc.mbSlave")}><Input name="mb-slave" inputMode="numeric" value={f.slave} onChange={set("slave")} /></Field>
        <Field label={t("plc.mbFunction")}><Select name="mb-fn" value={f.fn} onChange={set("fn")}>{Object.entries(FUNCTIONS).map(([k, v]) => <option key={k} value={k}>{k.padStart(2, "0")} — {v}</option>)}</Select></Field>
        <Field label={t("plc.mbAddress")}><Input name="mb-address" inputMode="numeric" value={f.address} onChange={set("address")} /></Field>
        {fn <= 4 && <Field label={t("plc.mbQuantity")}><Input name="mb-quantity" inputMode="numeric" value={f.quantity} onChange={set("quantity")} /></Field>}
        {(fn === 5 || fn === 6) && <Field label={t("plc.mbValue")}><Input name="mb-value" inputMode="numeric" value={f.value} onChange={set("value")} /></Field>}
        {(fn === 15 || fn === 16) && <Field label={t("plc.mbValues")}><Input name="mb-values" value={f.values} onChange={set("values")} /></Field>}
      </div>
      <div className="mt-3 rounded bg-[var(--bg-2)] p-2 font-mono text-sm" data-testid="mb-frame">{req.ok ? <>{req.frame} <span className="text-xs text-[var(--fg-3)]">({req.n} {t("plc.bytes")})</span></> : <span className="text-[var(--danger)]">{req.error}</span>}</div>
      <div className="mt-3"><Field label={t("plc.mbResponse")}><Textarea name="mb-response" rows={2} className="font-mono" placeholder="01 03 04 00 2A 01 00 …" value={resp} onChange={(e) => setResp(e.target.value)} /></Field></div>
      {dec && <p className={`mt-2 text-sm ${dec.ok ? "text-[var(--ok)]" : "text-[var(--warn)]"}`} data-testid="mb-decoded">{dec.summary}</p>}
    </Card>
  );
}
