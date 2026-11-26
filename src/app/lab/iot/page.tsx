"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Page, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import { parseSerialLine } from "@/lib/serial";
import { ArduinoSim } from "@/components/ArduinoSim";

type SerialPortLike = { open: (o: { baudRate: number }) => Promise<void>; close: () => Promise<void>; readable: ReadableStream<Uint8Array> | null };

export default function IotLab() {
  const t = useT();
  const supported = typeof navigator !== "undefined" && "serial" in navigator;
  const { data } = useData<{ items: { id: string; name: string; protocol: string; status: string }[] }>("/api/devices");
  const [device, setDevice] = useState("");
  const [baud, setBaud] = useState("115200");
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [relay, setRelay] = useState(false);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState<unknown>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const stop = useRef(false);
  const relayRef = useRef({ relay, device });
  useEffect(() => { relayRef.current = { relay, device }; }, [relay, device]);

  async function connect() {
    setErr(null);
    try {
      const port = await (navigator as unknown as { serial: { requestPort: () => Promise<SerialPortLike> } }).serial.requestPort();
      await port.open({ baudRate: Number(baud) });
      portRef.current = port; stop.current = false; setConnected(true);
      const reader = port.readable!.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
      let buf = "";
      while (!stop.current) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split(/\r?\n/); buf = parts.pop() ?? "";
        for (const l of parts) {
          setLines((x) => [...x.slice(-199), l]);
          const r = parseSerialLine(l);
          const cur = relayRef.current;
          if (r && cur.relay && cur.device) {
            try { await post(`/api/devices/${cur.device}/measurements`, { readings: [{ metric: r.metric, value: r.value }] }); setSent((n) => n + 1); }
            catch (e) { setErr(e); }
          }
        }
      }
      reader.releaseLock();
    } catch (e) { setErr(e); setConnected(false); }
  }
  async function disconnect() { stop.current = true; try { await portRef.current?.close(); } catch { /* port déjà fermé */ } setConnected(false); }

  return (
    <Page title={t("nav.iotlab")} subtitle={t("lab.iot.desc")}>
      <ArduinoSim />
      <Card title={t("iotlab.serial")}>
        {!supported ? <p className="text-sm text-[var(--warn)]" data-testid="serial-unsupported">{t("iotlab.unsupported")}</p> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("iotlab.baud")}><Select value={baud} onChange={(e) => setBaud(e.target.value)} className="!w-auto">{["9600", "57600", "115200", "230400"].map((b) => <option key={b}>{b}</option>)}</Select></Field>
              {!connected ? <Btn onClick={connect}>{t("iotlab.connect")}</Btn> : <Btn kind="danger" onClick={disconnect}>{t("iotlab.disconnect")}</Btn>}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("iotlab.relayTo")}><Select value={device} onChange={(e) => setDevice(e.target.value)} className="!w-auto"><option value="">—</option>{data?.items.filter((d) => d.status === "active").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
              <label className="inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={relay} disabled={!device} onChange={(e) => setRelay(e.target.checked)} />{t("iotlab.relay")}</label>
              {sent > 0 && <Pill tone="ok">{sent} {t("iotlab.sent")}</Pill>}
            </div>
            <pre className="h-64 overflow-auto rounded bg-[var(--bg-2)] p-2 font-mono text-xs" aria-live="polite">{lines.join("\n") || t("iotlab.empty")}</pre>
          </div>
        )}
        <ErrorBox error={err} />
        <p className="mt-2 text-xs text-[var(--fg-3)]">{t("iotlab.format")}</p>
      </Card>
      <Card title={t("iotlab.firmware")}>
        <p className="text-sm text-[var(--fg-2)]">{t("iotlab.firmwareInfo")}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-[var(--fg-2)]">
          <li>{t("iotlab.fw1")}</li><li>{t("iotlab.fw2")}</li><li>{t("iotlab.fw3")}</li><li>{t("iotlab.fw4")}</li>
        </ul>
        <p className="mt-2 text-xs"><code>firmware/xamxam-node</code> · <Link href="/iot" className="text-[var(--cyan)] underline">{t("nav.gateway")}</Link></p>
      </Card>
    </Page>
  );
}
