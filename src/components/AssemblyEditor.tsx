"use client";
/**
 * Maquette 3D paramétrique (Three.js) : volumes simples positionnés en millimètres, couleurs, masse volumique
 * saisie → masse et centre de gravité calculés, enregistrement versionné, export STL et JSON.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { useApp } from "./providers";
import { Btn, Card, ErrorBox, Field, Input, Pill, Select } from "./ui";
import { ProjectPicker } from "./ProjectPicker";
import { useData } from "@/lib/client/hooks";
import { api, post, put } from "@/lib/client/api";
import { DENSITIES, massReport, type Assembly, type Part } from "@/lib/assembly";

const uid = () => Math.random().toString(36).slice(2, 10);
const DEG = Math.PI / 180;

function buildMesh(p: Part): THREE.Mesh {
  const [a, b, c] = p.dims;
  const geo = p.shape === "box" ? new THREE.BoxGeometry(a, c, b) : p.shape === "cylinder" ? new THREE.CylinderGeometry(a / 2, a / 2, b, 32) : new THREE.SphereGeometry(a / 2, 32, 16);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: p.color, metalness: 0.15, roughness: 0.6 }));
  // Repère de la maquette : X, Y horizontaux, Z vertical (mm) → Three.js : Y vertical.
  mesh.position.set(p.pos[0], p.pos[2], p.pos[1]);
  mesh.rotation.set(p.rot[0] * DEG, p.rot[2] * DEG, p.rot[1] * DEG);
  mesh.name = p.name;
  return mesh;
}

export function AssemblyEditor() {
  const { t } = useApp();
  const [a, setA] = useState<Assembly>({ parts: [] });
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [id, setId] = useState<string | null>(null); const [pid, setPid] = useState("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState<unknown>(null); const [webgl, setWebgl] = useState(true);
  const { data: saved, reload } = useData<{ items: { id: string; title: string; version: number }[] }>("/api/assemblies");
  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{ scene: THREE.Scene; group: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls } | null>(null);
  const report = useMemo(() => massReport(a), [a]);
  const p = a.parts.find((x) => x.id === sel) ?? null;

  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { queueMicrotask(() => setWebgl(false)); return; }
    const w = el.clientWidth || 600, h = 380;
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); el.innerHTML = ""; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070d);
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 1e6); camera.position.set(600, 500, 700);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(1, 2, 1.5); scene.add(dl);
    scene.add(new THREE.GridHelper(2000, 40, 0x1e5bff, 0x1f2d4d)); scene.add(new THREE.AxesHelper(200));
    const group = new THREE.Group(); scene.add(group);
    const controls = new OrbitControls(camera, renderer.domElement);
    three.current = { scene, group, camera, controls };
    let raf = 0; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    return () => { cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); el.innerHTML = ""; three.current = null; };
  }, []);
  useEffect(() => {
    const g = three.current?.group; if (!g) return;
    for (const c of [...g.children]) { g.remove(c); const m = c as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material)?.dispose(); }
    for (const part of a.parts) { const m = buildMesh(part); if (part.id === sel) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xffd400 })); e.position.copy(m.position); e.rotation.copy(m.rotation); g.add(e); } g.add(m); }
  }, [a, sel]);

  const add = (shape: Part["shape"]) => { const np: Part = { id: uid(), name: `${shape === "box" ? "Bloc" : shape === "cylinder" ? "Cylindre" : "Sphère"} ${a.parts.length + 1}`, shape, dims: shape === "box" ? [200, 100, 50] : shape === "cylinder" ? [80, 200, 0] : [100, 0, 0], pos: [0, 0, 50], rot: [0, 0, 0], color: "#22e3ff", density: null, hollow: false, component_id: null }; setA((x) => ({ parts: [...x.parts, np] })); setSel(np.id); };
  const upd = (patch: Partial<Part>) => setA((x) => ({ parts: x.parts.map((q) => (q.id === sel ? { ...q, ...patch } : q)) }));
  const setVec = (k: "dims" | "pos" | "rot", i: number, v: string) => { if (!p) return; const n = Number(v.replace(",", ".")); if (!Number.isFinite(n)) return; const arr = [...p[k]] as [number, number, number]; arr[i] = n; upd({ [k]: arr }); };
  async function save() {
    setErr(null); setMsg("");
    try {
      if (id) { const r = await put<{ version: number }>(`/api/assemblies/${id}`, { title: title || t("asm.untitled"), graph: a }); setMsg(t("dia.savedV", { v: r.version })); }
      else { const r = await post<{ id: string }>("/api/assemblies", { title: title || t("asm.untitled"), graph: a, project_id: pid || null }); setId(r.id); setMsg(t("dia.savedV", { v: 1 })); }
      reload();
    } catch (e) { setErr(e); }
  }
  function exportStl() {
    const g = new THREE.Group(); for (const part of a.parts) g.add(buildMesh(part));
    const data = new STLExporter().parse(g, { binary: false }) as string;
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([data], { type: "model/stl" })); link.download = `${title || "maquette"}.stl`; link.click();
  }
  const dimLabels = p?.shape === "box" ? [t("asm.length"), t("asm.width"), t("asm.height")] : p?.shape === "cylinder" ? [t("asm.diameter"), t("asm.height")] : [t("asm.diameter")];
  return (
    <Card title={t("asm.title")} testId="assembly-editor">
      <p className="mb-2 text-xs text-[var(--fg-3)]">{t("asm.info")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("c.title")}><Input name="assembly-title" value={title} onChange={(e) => setTitle(e.target.value)} className="!w-48" /></Field>
        <ProjectPicker value={pid} onChange={setPid} />
        <Btn onClick={save} data-testid="assembly-save">{t("c.save")}</Btn>
        <Select aria-label={t("dia.open")} value="" onChange={async (e) => { if (!e.target.value) return; try { const r = await api<{ id: string; title: string; graph: Assembly }>(`/api/assemblies/${e.target.value}`); setA(r.graph); setTitle(r.title); setId(r.id); setSel(null); } catch (x) { setErr(x); } }} className="!w-auto"><option value="">{t("dia.open")}…</option>{saved?.items.map((s) => <option key={s.id} value={s.id}>{s.title} (v{s.version})</option>)}</Select>
        <Btn kind="ghost" onClick={exportStl} disabled={!a.parts.length} data-testid="assembly-stl">STL</Btn>
        <Btn kind="ghost" onClick={() => { const l = document.createElement("a"); l.href = URL.createObjectURL(new Blob([JSON.stringify({ title, graph: a }, null, 2)], { type: "application/json" })); l.download = `${title || "maquette"}.json`; l.click(); }}>JSON</Btn>
        {msg && <Pill tone="ok">{msg}</Pill>}
      </div>
      <ErrorBox error={err} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Btn kind="ghost" onClick={() => add("box")} data-testid="add-box">＋ {t("asm.box")}</Btn><Btn kind="ghost" onClick={() => add("cylinder")}>＋ {t("asm.cylinder")}</Btn><Btn kind="ghost" onClick={() => add("sphere")}>＋ {t("asm.sphere")}</Btn>
      </div>
      <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_300px]">
        <div>{webgl ? <div ref={host} className="w-full overflow-hidden rounded-lg border border-[var(--line)]" style={{ minHeight: 380 }} /> : <p className="text-sm text-[var(--warn)]">{t("asm.noWebgl")}</p>}
          <ul className="mt-2 flex flex-wrap gap-1 text-xs">{a.parts.map((q) => <li key={q.id}><button className={`rounded border px-2 py-0.5 ${q.id === sel ? "border-[var(--cyan)]" : "border-[var(--line)]"}`} onClick={() => setSel(q.id)}>{q.name}</button></li>)}</ul></div>
        <div className="space-y-2 text-sm">
          {p ? (<>
            <Field label={t("asm.name")}><Input name="part-name" value={p.name} onChange={(e) => upd({ name: e.target.value.slice(0, 120) })} /></Field>
            <div className="grid grid-cols-3 gap-1">{dimLabels.map((l, i) => <Field key={l} label={`${l} (mm)`}><Input name={`part-dim-${i}`} inputMode="decimal" value={String(p.dims[i])} onChange={(e) => setVec("dims", i, e.target.value)} /></Field>)}</div>
            <div className="grid grid-cols-3 gap-1">{["X", "Y", "Z"].map((l, i) => <Field key={l} label={`${l} (mm)`}><Input inputMode="decimal" value={String(p.pos[i])} onChange={(e) => setVec("pos", i, e.target.value)} /></Field>)}</div>
            <div className="grid grid-cols-3 gap-1">{["rX", "rY", "rZ"].map((l, i) => <Field key={l} label={`${l} (°)`}><Input inputMode="decimal" value={String(p.rot[i])} onChange={(e) => setVec("rot", i, e.target.value)} /></Field>)}</div>
            <Field label={t("asm.color")}><input type="color" value={p.color} onChange={(e) => upd({ color: e.target.value })} /></Field>
            <Field label={t("asm.material")}><Select name="part-material" value={p.density == null ? "" : String(p.density)} onChange={(e) => upd({ density: e.target.value === "" ? null : Number(e.target.value) })}><option value="">—</option>{DENSITIES.map((d) => <option key={d.name} value={d.kgm3}>{d.name} ({d.kgm3} kg/m³)</option>)}</Select></Field>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.hollow} onChange={(e) => upd({ hollow: e.target.checked })} />{t("asm.hollow")}</label>
            <Btn kind="danger" onClick={() => { setA((x) => ({ parts: x.parts.filter((q) => q.id !== sel) })); setSel(null); }}>{t("c.delete")}</Btn>
          </>) : <p className="text-xs text-[var(--fg-3)]">{t("asm.select")}</p>}
          <div className="rounded-lg bg-[var(--bg-2)] p-2 text-xs" data-testid="assembly-mass">
            <strong>{t("asm.mass")}</strong> : {report.totalKg == null ? t("asm.massMissing") : `${report.totalKg.toFixed(3)} kg`}{report.cog && <> · {t("asm.cog")} ({report.cog.join(", ")}) mm</>}
            {report.missing.length > 0 && <ul className="mt-1 list-disc pl-4 text-[var(--warn)]">{report.missing.slice(0, 6).map((m) => <li key={m}>{m}</li>)}</ul>}
          </div>
        </div>
      </div>
    </Card>
  );
}
