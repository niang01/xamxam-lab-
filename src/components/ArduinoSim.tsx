"use client";
/**
 * Programmation et simulation Arduino Uno dans le navigateur : éditeur de code (CodeMirror), compilation RÉELLE sur le
 * serveur (avr-gcc + cœur Arduino), puis exécution du binaire obtenu par l'émulateur libre avr8js (ATmega328P à 16 MHz).
 * Les capteurs sont représentés par des tensions (A0–A5) et des niveaux logiques ; c'est la simulation du
 * microcontrôleur et de son programme, pas celle des capteurs ni de la puissance commandée.
 */
import { useEffect, useRef, useState } from "react";
import { EditorView, basicSetup } from "codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { useT } from "@/components/providers";
import { Btn, Card, ErrorBox, Field, Pill, Select } from "@/components/ui";
import { useData } from "@/lib/client/hooks";
import { post } from "@/lib/client/api";
import { SKETCHES, type Sketch } from "@/lib/iot/sketches";
import { UnoSim } from "@/lib/iot/avr-sim";

type Compiled = { ok: boolean; hex: string | null; flashBytes: number | null; log: string };
const PIN_NAME = (p: number) => (p >= 14 ? `A${p - 14}` : `D${p}`);
const OUT_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function ArduinoSim() {
  const t = useT();
  const { data: status } = useData<{ board: string; available: boolean; reason: string | null }>("/api/iot/compile");
  const [sketch, setSketch] = useState<Sketch>(SKETCHES[0]);
  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [running, setRunning] = useState(false);
  const [pins, setPins] = useState<Record<number, boolean>>({});
  const [serial, setSerial] = useState("");
  const [simMs, setSimMs] = useState(0);
  const [analog, setAnalog] = useState<number[]>([2.5, 2.5, 2.5, 2.5, 2.5, 2.5]);
  const [digital, setDigital] = useState<Record<number, boolean>>({});
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const sim = useRef<UnoSim | null>(null);
  const inputs = useRef({ analog, digital });
  useEffect(() => { inputs.current = { analog, digital }; }, [analog, digital]);

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({ doc: SKETCHES[0].source, extensions: [basicSetup, cpp(), EditorView.lineWrapping], parent: host.current });
    view.current = v;
    // Ouverture depuis un TP : /lab/iot?croquis=seuil
    const k = new URLSearchParams(window.location.search).get("croquis");
    if (k && SKETCHES.some((s) => s.key === k)) choose(k);
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture unique de l'adresse au montage
  }, []);

  function choose(key: string) {
    const s = SKETCHES.find((x) => x.key === key)!;
    stop(); setSketch(s); setCompiled(null); setSerial(""); setPins({});
    setDigital(Object.fromEntries(s.inputs.filter((i) => i.kind === "digital").map((i) => [i.pin, i.idle ?? true])));
    view.current?.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: s.source } });
  }

  async function compile() {
    setBusy(true); setErr(null); stop();
    try { setCompiled(await post<Compiled>("/api/iot/compile", { source: view.current?.state.doc.toString() ?? "" })); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  }

  function start() {
    if (!compiled?.hex) return;
    setSerial(""); setSimMs(0);
    const s = new UnoSim(compiled.hex, (c) => setSerial((x) => (x + c).slice(-8000)));
    sim.current = s; setRunning(true);
  }
  function stop() { sim.current = null; setRunning(false); }

  useEffect(() => {
    if (!running) return;
    let raf = 0, ms = 0;
    const frame = () => {
      const s = sim.current; if (!s) return;
      const { analog: a, digital: d } = inputs.current;
      a.forEach((v, i) => s.setAnalog(i, v));
      for (const [p, v] of Object.entries(d)) s.setInput(Number(p), v);
      s.runMs(16); ms += 16;
      setPins(Object.fromEntries(OUT_PINS.map((p) => [p, s.pin(p)])));
      setSimMs(ms);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const download = () => {
    if (!compiled?.hex) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([compiled.hex], { type: "text/plain" })); a.download = `${sketch.key}.hex`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <Card title={t("avr.title")} testId="arduino-sim">
      <p className="text-sm text-[var(--fg-2)]">{t("avr.intro")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Pill tone="info">{status?.board ?? "Arduino Uno (ATmega328P)"}</Pill>
        {status && (status.available ? <span data-testid="toolchain-ok"><Pill tone="ok">{t("avr.toolchainOk")}</Pill></span> : <span data-testid="toolchain-ko"><Pill tone="warn">{t("avr.toolchainKo")} {status.reason}</Pill></span>)}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:max-w-md"><Field label={t("avr.example")}><Select data-testid="sim-sketch" value={sketch.key} onChange={(e) => choose(e.target.value)} className="min-w-0 truncate">{SKETCHES.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}</Select></Field></div>
        <Btn data-testid="sim-compile" onClick={compile} disabled={busy || status?.available === false}>{busy ? t("avr.compiling") : t("avr.compile")}</Btn>
        {compiled?.ok && (!running ? <Btn kind="ok" data-testid="sim-run" onClick={start}>{t("avr.run")}</Btn> : <Btn kind="danger" data-testid="sim-stop" onClick={stop}>{t("avr.stop")}</Btn>)}
        {compiled?.ok && <Btn kind="ghost" data-testid="sim-hex" onClick={download}>{t("avr.hex")}</Btn>}
      </div>
      <p className="mt-2 text-xs text-[var(--fg-3)]">{sketch.description}</p>
      <div ref={host} data-testid="sim-editor" className="mt-2 max-h-[420px] overflow-auto rounded border border-[var(--line)] bg-[var(--bg-2)] text-sm" />
      <ErrorBox error={err} />
      {compiled && <pre data-testid="sim-log" className={`mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded p-2 font-mono text-xs ${compiled.ok ? "bg-[var(--bg-2)]" : "bg-[var(--bg-2)] text-[var(--danger)]"}`}>{compiled.log}</pre>}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">{t("avr.wiring")}</h3>
          <table className="mt-1 w-full text-xs" data-testid="sim-wiring"><tbody>
            {sketch.inputs.map((i) => <tr key={`i${i.pin}`}><td className="pr-2 font-mono">{PIN_NAME(i.pin)}</td><td>{t("avr.input")} — {i.label}</td></tr>)}
            {sketch.outputs.map((o) => <tr key={`o${o.pin}`}><td className="pr-2 font-mono">{PIN_NAME(o.pin)}</td><td>{t("avr.output")} — {o.label}</td></tr>)}
          </tbody></table>
          <h3 className="mt-3 text-sm font-semibold">{t("avr.inputs")}</h3>
          {[0, 1, 2, 3, 4, 5].map((ch) => (
            <label key={ch} className="mt-1 flex items-center gap-2 text-xs">
              <span className="w-8 font-mono">A{ch}</span>
              <input type="range" min={0} max={5} step={0.05} value={analog[ch]} data-testid={`sim-a${ch}`} className="min-w-0 flex-1"
                onChange={(e) => setAnalog((x) => x.map((v, i) => (i === ch ? Number(e.target.value) : v)))} />
              <span className="w-24 text-right font-mono">{analog[ch].toFixed(2)} V ({Math.round((analog[ch] / 5) * 1023)})</span>
            </label>
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            {[2, 3, 4, 5].map((p) => (
              <label key={p} className="inline-flex items-center gap-1 text-xs"><input type="checkbox" data-testid={`sim-d${p}`} checked={digital[p] ?? false} onChange={(e) => setDigital((d) => ({ ...d, [p]: e.target.checked }))} />D{p} {t("avr.high")}</label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("avr.outputs")} <span className="font-normal text-[var(--fg-3)]">· {t("avr.time")} {(simMs / 1000).toFixed(1)} s</span></h3>
          <div className="mt-1 grid grid-cols-6 gap-1" data-testid="sim-pins">
            {OUT_PINS.map((p) => (
              <div key={p} data-pin={p} data-state={pins[p] ? "1" : "0"} className="flex flex-col items-center rounded border border-[var(--line)] p-1 text-[10px]">
                <span className={`h-3 w-3 rounded-full ${pins[p] ? "bg-[var(--ok)] shadow-[0_0_6px_var(--ok)]" : "bg-[var(--bg-2)]"}`} />D{p}
              </div>
            ))}
          </div>
          <h3 className="mt-3 text-sm font-semibold">{t("avr.serial")}</h3>
          <pre data-testid="sim-serial" className="mt-1 h-40 overflow-auto rounded bg-[var(--bg-2)] p-2 font-mono text-xs" aria-live="polite">{serial || t("iotlab.empty")}</pre>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--fg-3)]">{t("avr.limits")}</p>
    </Card>
  );
}
