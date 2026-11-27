"use client";
/** Visionneuse 3D d'un boîtier (modèle STEP de la bibliothèque KiCad converti en maillage : public/catalogue/3d). */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Mesh = { c: [number, number, number] | null; p: number[]; i: number[] };

export function PackageModel3D({ file, label }: { file: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "nowebgl">("loading");
  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { queueMicrotask(() => setState("nowebgl")); return; }
    const w = el.clientWidth || 320, h = 240;
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(30, 50, 40); scene.add(dl);
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 5000);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    let raf = 0, alive = true;
    fetch(`/catalogue/3d/${file}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ m: Mesh[] }>; }).then((d) => {
      if (!alive) return;
      const group = new THREE.Group();
      for (const m of d.m) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(m.p, 3)); g.setIndex(m.i); g.computeVertexNormals();
        const color = m.c ? new THREE.Color(m.c[0], m.c[1], m.c[2]) : new THREE.Color(0x9aa4b2);
        group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 })));
      }
      group.rotation.x = -Math.PI / 2; scene.add(group);
      const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3()).length(), center = box.getCenter(new THREE.Vector3());
      controls.target.copy(center); camera.position.copy(center.clone().add(new THREE.Vector3(size * 0.9, size * 0.7, size * 0.9)));
      setState("ok");
      const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    }).catch(() => alive && setState("error"));
    return () => { alive = false; cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); el.innerHTML = ""; };
  }, [file]);
  return (
    <figure className="rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-2" data-testid="model3d">
      <div ref={host} className="h-[240px] w-full" aria-label={`Modèle 3D : ${label}`} />
      <figcaption className="mt-1 text-xs text-[var(--fg-3)]">{state === "nowebgl" ? "Affichage 3D indisponible sur cet appareil (WebGL)." : state === "error" ? "Modèle 3D introuvable." : `Modèle 3D du boîtier ${label} — bibliothèque 3D KiCad (CC BY-SA 4.0). Faire glisser pour tourner.`}</figcaption>
    </figure>
  );
}
