/**
 * Exporte l'identité visuelle depuis les SVG de `design/identite/svg/` (générés par generer.py) :
 *   node design/identite/exporter.mjs              → design/identite/export/{png,pdf,icones}
 *   node design/identite/exporter.mjs --appliquer  → copie en plus les icônes dans l'application web et les projets mobiles
 *
 * `--appliquer` n'est à lancer qu'après validation du logo et de l'icône par l'exploitant (document d'identité, § 13).
 * Rendu : Chromium (Playwright) ; PNG transparents (sauf icônes, opaques comme l'exigent iOS et Google Play) ; PDF vectoriels.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "..");
const SVG = join(ICI, "svg");
const EXPORT = join(ICI, "export");

const lire = (nom) => readFileSync(join(SVG, nom), "utf8");
const dimensions = (svg) => { const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return { w: Number(m[1]), h: Number(m[2]) }; };

async function rendre(page, svg, { largeur, opaque = false, rond = false }) {
  const { w, h } = dimensions(svg);
  const hauteur = Math.round((largeur * h) / w);
  await page.setViewportSize({ width: largeur, height: hauteur });
  const forme = rond ? "border-radius:50%;overflow:hidden;" : "";
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${largeur}px;height:${hauteur}px;${forme}">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${largeur}" height="${hauteur}"`)}</div></body></html>`);
  return page.screenshot({ omitBackground: !opaque, clip: { x: 0, y: 0, width: largeur, height: hauteur } });
}

/** Fichier .ico multi-tailles contenant des images PNG (format accepté par tous les navigateurs actuels). */
function ico(images) {
  const entete = Buffer.alloc(6 + 16 * images.length);
  entete.writeUInt16LE(0, 0); entete.writeUInt16LE(1, 2); entete.writeUInt16LE(images.length, 4);
  let decalage = entete.length;
  images.forEach(({ taille, png }, i) => {
    const o = 6 + 16 * i;
    entete.writeUInt8(taille >= 256 ? 0 : taille, o); entete.writeUInt8(taille >= 256 ? 0 : taille, o + 1);
    entete.writeUInt16LE(1, o + 4); entete.writeUInt16LE(32, o + 6);
    entete.writeUInt32LE(png.length, o + 8); entete.writeUInt32LE(decalage, o + 12);
    decalage += png.length;
  });
  return Buffer.concat([entete, ...images.map((x) => x.png)]);
}

const ANDROID = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

async function main() {
  const appliquer = process.argv.includes("--appliquer");
  for (const d of ["png", "pdf", "icones/android", "icones/ios", "icones/web"]) mkdirSync(join(EXPORT, d), { recursive: true });
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  const fichiers = readdirSync(SVG).filter((f) => f.endsWith(".svg")).sort();

  for (const f of fichiers) {
    const svg = lire(f);
    const { w } = dimensions(svg);
    writeFileSync(join(EXPORT, "png", f.replace(".svg", ".png")), await rendre(page, svg, { largeur: Math.round(Math.max(w * 4, 1024)) }));
    const { h } = dimensions(svg);
    await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
    await page.setContent(`<html><head><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0}</style></head><body>${svg}</body></html>`);
    writeFileSync(join(EXPORT, "pdf", f.replace(".svg", ".pdf")), await page.pdf({ width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: "1" }));
  }

  const icone = lire("icone-application.svg");
  const avantPlan = lire("icone-android-avant-plan.svg");
  const favicon = lire("icone-favicon.svg");
  const sorties = [];
  for (const [densite, k] of Object.entries(ANDROID)) {
    const dossier = join(EXPORT, "icones/android", `mipmap-${densite}`);
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, "ic_launcher.png"), await rendre(page, icone, { largeur: 48 * k, opaque: true }));
    writeFileSync(join(dossier, "ic_launcher_round.png"), await rendre(page, icone, { largeur: 48 * k, rond: true }));
    writeFileSync(join(dossier, "ic_launcher_foreground.png"), await rendre(page, avantPlan, { largeur: 108 * k }));
    sorties.push(densite);
  }
  writeFileSync(join(EXPORT, "icones/android", "play-store-512.png"), await rendre(page, icone, { largeur: 512, opaque: true }));
  writeFileSync(join(EXPORT, "icones/ios", "AppIcon-512@2x.png"), await rendre(page, icone, { largeur: 1024, opaque: true }));
  const web = join(EXPORT, "icones/web");
  const petits = [];
  for (const t of [16, 32, 48]) { const png = await rendre(page, favicon, { largeur: t }); petits.push({ taille: t, png }); writeFileSync(join(web, `favicon-${t}.png`), png); }
  writeFileSync(join(web, "favicon.ico"), ico(petits));
  copyFileSync(join(SVG, "icone-favicon.svg"), join(web, "icon.svg"));
  writeFileSync(join(web, "apple-touch-icon.png"), await rendre(page, icone, { largeur: 180, opaque: true }));
  writeFileSync(join(web, "icon-192.png"), await rendre(page, icone, { largeur: 192, opaque: true }));
  writeFileSync(join(web, "icon-512.png"), await rendre(page, icone, { largeur: 512, opaque: true }));
  await navigateur.close();

  if (appliquer) {
    const res = join(RACINE, "mobile/android/app/src/main/res");
    for (const densite of sorties) for (const n of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) copyFileSync(join(EXPORT, "icones/android", `mipmap-${densite}`, n), join(res, `mipmap-${densite}`, n));
    writeFileSync(join(res, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#080D1B</color>\n</resources>\n`);
    copyFileSync(join(EXPORT, "icones/ios/AppIcon-512@2x.png"), join(RACINE, "mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"));
    for (const n of ["icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon.ico", "icon.svg"]) copyFileSync(join(web, n), join(RACINE, "public", n));
    console.log("Icônes appliquées : public/, Android (mipmap-*), iOS (AppIcon).");
  }
  console.log(`${fichiers.length} SVG exportés en PNG et PDF ; icônes Android (${sorties.join(", ")}), iOS 1024, web (favicon 16/32/48, 180, 192, 512).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
