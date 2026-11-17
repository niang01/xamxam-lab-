"use client";
/** Visionneuse 3D (Three.js, WebGL) d'un fichier STL local : rien n'est envoyé au serveur. */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function StlViewer({ file }: { file: File | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState("");
  useEffect(() => {
    if (!file || !host.current) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { queueMicrotask(() => setInfo("WebGL indisponible sur cet appareil.")); return; }
    const w = el.clientWidth, h = 420;
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.innerHTML = ""; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070d);
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1e6);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 2, 3); scene.add(dl);
    const controls = new OrbitControls(camera, renderer.domElement);
    let raf = 0;
    file.arrayBuffer().then((buf) => {
      const geo = new STLLoader().parse(buf);
      geo.computeBoundingBox(); geo.center();
      const size = new THREE.Vector3(); geo.boundingBox!.getSize(size);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x22e3ff, metalness: 0.2, roughness: 0.5 }));
      scene.add(mesh);
      scene.add(new THREE.GridHelper(Math.max(size.x, size.y, size.z) * 2, 20, 0x1e5bff, 0x1f2d4d));
      const d = Math.max(size.x, size.y, size.z) * 1.8 || 10;
      camera.position.set(d, d * 0.8, d); controls.update();
      setInfo(`${geo.attributes.position.count / 3} triangles · ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} (unités du fichier)`);
      const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
      loop();
    }).catch((e) => setInfo(`Fichier STL illisible : ${e instanceof Error ? e.message : String(e)}`));
    return () => { cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); el.innerHTML = ""; };
  }, [file]);
  return <div><div ref={host} className="w-full overflow-hidden rounded-lg border border-[var(--line)]" style={{ minHeight: file ? 420 : 0 }} /><p className="mt-1 text-xs text-[var(--fg-3)]">{info}</p></div>;
}
