/**
 * Fonds d'écran personnalisés : montage photographique du portrait ORIGINAL du propriétaire (détouré, jamais régénéré)
 * sur une scène vectorielle XAM-XAM LAB (grille d'ingénierie, orbites, symbole).
 *
 *   node design/identite/fonds.mjs <portrait-detoure.png> <dossier-de-sortie>
 *
 * Le portrait est une donnée personnelle : il n'est pas versionné et les images produites doivent être écrites
 * HORS du dépôt (dossier de sortie au choix de l'exploitant).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const [portraitPng, sortie] = process.argv.slice(2);
if (!portraitPng || !sortie) { console.error("usage : node design/identite/fonds.mjs <portrait-detoure.png> <dossier-de-sortie>"); process.exit(2); }
mkdirSync(sortie, { recursive: true });

const portrait = `data:image/png;base64,${readFileSync(portraitPng).toString("base64")}`;
const svg = (nom) => readFileSync(join(ICI, "svg", nom), "utf8");
const symbole = svg("symbole.svg").replace(/<rect width="256" height="256" fill="[^"]+"\/>/, "");
const logo = svg("logo-horizontal-transparent.svg").replace(/fill="#080D1B"/g, 'fill="#F8FAFC"').replace(/fill="#123B83"/g, 'fill="#22D3EE"').replace(/fill="#334155"/g, 'fill="#94A3B8"');
const DEVISE = "IMAGINE. CONÇOIS. SIMULE. CONNECTE. AUTOMATISE. INNOVE. RÉALISE.";

/** Formats demandés (§ 10) : position du portrait (fraction de la largeur/hauteur) et zone du texte, avec zones de respiration. */
const FORMATS = [
  { nom: "fond-ordinateur-16x9", w: 3840, h: 2160, p: { right: 0.06, h: 0.96 }, sym: { x: 0.62, y: 0.5, s: 0.95 }, texte: { left: 0.2, bottom: 0.14, logo: 0.3 } },
  { nom: "fond-smartphone-vertical", w: 1290, h: 2796, p: { center: true, h: 0.6 }, sym: { x: 0.5, y: 0.6, s: 1.05 }, texte: { left: 0.12, top: 0.25, logo: 0.76 } },
  { nom: "banniere-couverture", w: 1584, h: 396, p: { right: 0.05, h: 1.25, crop: true }, sym: { x: 0.8, y: 0.5, s: 0.95 }, texte: { left: 0.05, bottom: 0.3, logo: 0.42 } },
  { nom: "visuel-profil", w: 1080, h: 1080, p: { center: true, h: 1.2, crop: true }, sym: { x: 0.5, y: 0.42, s: 0.9 }, texte: null },
];

function page({ w, h, p, sym, texte }, avecTexte) {
  const ph = h * p.h;
  const pw = ph * (999 / 1536);
  const left = p.center ? (w - pw) / 2 : w - pw - w * p.right;
  const top = p.crop ? h * 0.08 : h - ph;
  const S = Math.min(w, h) * sym.s;
  const bloc = avecTexte && texte ? `<div style="position:absolute;left:${w * texte.left}px;${texte.top !== undefined ? `top:${h * texte.top}px` : `bottom:${h * texte.bottom}px`};width:${w * texte.logo}px">
      <div style="width:100%">${logo.replace(/width="[\d.]+" height="[\d.]+"/, 'width="100%" height="auto"')}</div>
      <div style="margin-top:${w * texte.logo * 0.04}px;font:500 ${w * texte.logo * 0.0205}px 'JM',monospace;letter-spacing:.08em;white-space:nowrap;color:#22D3EE;opacity:.85">${DEVISE}</div></div>` : "";
  return `<!doctype html><html><head><style>
    @font-face{font-family:JM;src:url(data:font/woff2;base64,${readFileSync(join(ICI, "polices/jetbrains-mono-latin-500-normal.woff2")).toString("base64")})}
    html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#080D1B}
  </style></head><body>
  <div style="position:absolute;inset:0;background:radial-gradient(${w * 0.6}px ${h * 0.7}px at ${sym.x * 100}% ${sym.y * 100}%,#123B83 0%,rgba(18,59,131,.35) 45%,transparent 75%),radial-gradient(${w * 0.4}px ${h * 0.5}px at 8% 105%,rgba(139,92,246,.22),transparent 70%)"></div>
  <div style="position:absolute;inset:0;opacity:.18;background-image:linear-gradient(#22D3EE22 1px,transparent 1px),linear-gradient(90deg,#22D3EE22 1px,transparent 1px);background-size:${Math.round(Math.min(w, h) / 18)}px ${Math.round(Math.min(w, h) / 18)}px;mask-image:radial-gradient(circle at ${sym.x * 100}% ${sym.y * 100}%,#000 20%,transparent 70%)"></div>
  <svg style="position:absolute;left:${w * sym.x - S}px;top:${h * sym.y - S}px;opacity:.5" width="${S * 2}" height="${S * 2}" viewBox="0 0 512 512" fill="none">
    <ellipse cx="256" cy="256" rx="250" ry="92" transform="rotate(-24 256 256)" stroke="#22D3EE" stroke-opacity=".35" stroke-width="1.5"/>
    <ellipse cx="256" cy="256" rx="230" ry="150" transform="rotate(18 256 256)" stroke="#8B5CF6" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="4 10"/>
    <circle cx="256" cy="256" r="205" stroke="#3B82F6" stroke-opacity=".25" stroke-width="1"/>
  </svg>
  <div style="position:absolute;left:${w * sym.x - S * 0.42}px;top:${h * sym.y - S * 0.42}px;width:${S * 0.84}px;height:${S * 0.84}px;opacity:.22;filter:blur(${S * 0.004}px)">${symbole.replace(/width="256" height="256"/, 'width="100%" height="100%"')}</div>
  <img src="${portrait}" style="position:absolute;left:${left}px;top:${top}px;height:${ph}px;filter:drop-shadow(0 0 ${ph * 0.02}px rgba(34,211,238,.45));-webkit-mask-image:linear-gradient(#000 82%,transparent 100%),linear-gradient(90deg,transparent 0%,#000 14%);-webkit-mask-composite:source-in;mask-composite:intersect">
  ${bloc}
  </body></html>`;
}

const navigateur = await chromium.launch();
const onglet = await navigateur.newPage();
for (const f of FORMATS) {
  await onglet.setViewportSize({ width: f.w, height: f.h });
  for (const avecTexte of f.texte ? [true, false] : [false]) {
    await onglet.setContent(page(f, avecTexte));
    await onglet.waitForTimeout(150);
    await onglet.screenshot({ path: join(sortie, `${f.nom}${f.texte ? (avecTexte ? "" : "-sans-texte") : ""}.png`) });
  }
}
await navigateur.close();
console.log(`Fonds écrits dans ${sortie}`);
