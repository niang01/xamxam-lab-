/**
 * Planche de comparaison des trois propositions de logo (fond sombre, fond clair, icône, petites tailles, monochrome).
 *   node design/identite/planche.mjs   → design/identite/planche-propositions.png
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const img = (f, style) => `<img style="${style}" src="data:image/svg+xml;base64,${readFileSync(join(ICI, "svg", f)).toString("base64")}">`;
const NOMS = { a: "A — Nœud orbital (recommandée)", b: "B — Rencontre XAM·XAM", c: "C — Constellation" };
const mono = (cle) => readFileSync(join(ICI, "svg", `proposition-${cle}-symbole.svg`), "utf8").replace(/url\(#[^)]+\)/g, "#000").replace(/#22D3EE|#8B5CF6/g, "#000").replace(/<rect width="256" height="256" fill="#080D1B"\/>/, '<rect width="256" height="256" fill="#fff"/>').replace(/fill="#080D1B"/g, 'fill="#fff"');
const ligne = (cle) => `<section>
  <h2>${NOMS[cle]}</h2>
  <div class="r">
    ${img(`proposition-${cle}-horizontal-sombre.svg`, "height:110px")}
    ${img(`proposition-${cle}-horizontal-clair.svg`, "height:110px;outline:1px solid #ddd")}
    ${img(`proposition-${cle}-icone.svg`, "height:110px")}
    <div class="petits">${[64, 32, 16].map((t) => img(`proposition-${cle}-${t <= 32 ? "petit" : "symbole"}.svg`, `height:${t}px;width:${t}px`)).join("")}<span>64 · 32 · 16 px</span></div>
    <img style="height:90px;outline:1px solid #ddd" src="data:image/svg+xml;base64,${Buffer.from(mono(cle)).toString("base64")}">
  </div></section>`;
const html = `<!doctype html><html><head><style>
  body{margin:0;padding:28px 36px;background:#eef2f9;font:15px system-ui,sans-serif;color:#080D1B;width:1500px}
  h1{font-size:22px;margin:0 0 4px} p{margin:0 0 18px;color:#334155}
  section{background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:16px} h2{font-size:16px;margin:0 0 10px}
  .r{display:flex;gap:18px;align-items:center}.petits{display:flex;gap:10px;align-items:center;background:#080D1B;padding:12px;border-radius:8px}.petits span{color:#94A3B8;font-size:12px}
</style></head><body><h1>XAM-XAM LAB — trois propositions de logo</h1>
<p>Symboles vectoriels construits géométriquement ; texte vectorisé (Space Grotesk / Inter, SIL OFL). Colonnes : fond sombre · fond clair · icône d'application · petites tailles · monochrome.</p>
${["a", "b", "c"].map(ligne).join("")}</body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1572, height: 800 } });
await p.setContent(html); await p.screenshot({ path: join(ICI, "planche-propositions.png"), fullPage: true }); await b.close();
console.log("planche-propositions.png écrite");
