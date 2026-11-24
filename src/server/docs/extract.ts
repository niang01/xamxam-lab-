/**
 * Extraction du contenu d'un document déposé. Les fichiers sont traités en mémoire et dans un dossier temporaire
 * supprimé aussitôt ; seul le texte extrait est conservé.
 *  - PDF : pdftotext (Poppler) ; si le PDF ne contient pas de texte (scan), OCR Tesseract page par page (≤ 10 pages).
 *  - Images (PNG, JPEG, TIFF, BMP, WebP) : OCR Tesseract (français + anglais).
 *  - DOCX, XLSX, PPTX, DXF, STL : src/lib/docs/office.ts. Texte, code, CSV, JSON, Markdown : lecture directe.
 * Outil absent du serveur → erreur explicite (jamais de texte inventé).
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractDocx, extractDxf, extractPptx, extractStl, extractXlsx, type Extracted } from "@/lib/docs/office";

export const MAX_BYTES = 15 * 1024 * 1024;
export const OCR_MAX_PAGES = 10;

export type DocKind = "pdf" | "docx" | "xlsx" | "pptx" | "image" | "text" | "code" | "dxf" | "stl";
const EXT: Record<string, DocKind> = {
  pdf: "pdf", docx: "docx", xlsx: "xlsx", pptx: "pptx", png: "image", jpg: "image", jpeg: "image", tif: "image", tiff: "image", bmp: "image", webp: "image",
  txt: "text", md: "text", csv: "text", json: "text", xml: "text", html: "text",
  c: "code", cpp: "code", h: "code", hpp: "code", ino: "code", py: "code", js: "code", ts: "code", java: "code", m: "code", sql: "code", sh: "code", yaml: "code", yml: "code",
  dxf: "dxf", stl: "stl",
};
export const SUPPORTED_EXTENSIONS = Object.keys(EXT);
const UNSUPPORTED_HINT: Record<string, string> = { doc: "Word 97-2003 : enregistrez le fichier au format .docx", xls: "Excel 97-2003 : enregistrez au format .xlsx", ppt: "PowerPoint 97-2003 : enregistrez au format .pptx", dwg: "DWG (format propriétaire) : exportez en .dxf" };

export class ExtractError extends Error {}

export function kindOf(filename: string, bytes: Uint8Array): DocKind {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (UNSUPPORTED_HINT[ext]) throw new ExtractError(`Format non pris en charge — ${UNSUPPORTED_HINT[ext]}`);
  const k = EXT[ext];
  if (!k) throw new ExtractError(`Extension « .${ext} » non prise en charge. Formats acceptés : ${SUPPORTED_EXTENSIONS.join(", ")}`);
  // Contrôle de la signature : le contenu doit correspondre à l'extension annoncée.
  const sig = (s: number[]) => s.every((b, i) => bytes[i] === b);
  if (k === "pdf" && !sig([0x25, 0x50, 0x44, 0x46])) throw new ExtractError("Le fichier n'est pas un PDF valide");
  if ((k === "docx" || k === "xlsx" || k === "pptx") && !sig([0x50, 0x4b])) throw new ExtractError("Le fichier n'est pas un document Office valide (archive ZIP attendue)");
  if (k === "image" && !(sig([0x89, 0x50, 0x4e, 0x47]) || sig([0xff, 0xd8, 0xff]) || sig([0x49, 0x49, 0x2a]) || sig([0x4d, 0x4d, 0x00, 0x2a]) || sig([0x42, 0x4d]) || (sig([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57))) throw new ExtractError("Le fichier n'est pas une image valide");
  return k;
}

function run(cmd: string, args: string[], timeoutMs = 90_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH ?? "/usr/bin:/bin", OMP_THREAD_LIMIT: "1", NODE_ENV: "production" } as NodeJS.ProcessEnv });
    let out = "", err = "";
    const t = setTimeout(() => { child.kill("SIGKILL"); reject(new ExtractError(`Délai dépassé pendant le traitement (${cmd})`)); }, timeoutMs);
    child.on("error", () => { clearTimeout(t); reject(new ExtractError(`Outil « ${cmd} » indisponible sur ce serveur : ${cmd === "tesseract" ? "reconnaissance de texte (OCR)" : "lecture des PDF"} impossible`)); });
    child.stdout.on("data", (c) => { out += c; if (out.length > 20_000_000) child.kill("SIGKILL"); });
    child.stderr.on("data", (c) => { err += c; });
    child.on("close", (code) => { clearTimeout(t); if (code === 0) resolve(out); else reject(new ExtractError(`${cmd} : échec (${err.trim().slice(-200) || `code ${code}`})`)); });
  });
}

async function ocr(file: string): Promise<string> { return run("tesseract", [file, "stdout", "-l", "fra+eng", "--psm", "3"]); }

export async function extract(filename: string, bytes: Uint8Array): Promise<Extracted & { kind: DocKind; ocr: boolean }> {
  if (bytes.length > MAX_BYTES) throw new ExtractError(`Fichier trop volumineux (${(bytes.length / 1048576).toFixed(1)} Mo ; maximum ${MAX_BYTES / 1048576} Mo)`);
  if (!bytes.length) throw new ExtractError("Fichier vide");
  const kind = kindOf(filename, bytes);
  if (kind === "docx") return { ...extractDocx(bytes), kind, ocr: false };
  if (kind === "xlsx") return { ...extractXlsx(bytes), kind, ocr: false };
  if (kind === "pptx") return { ...extractPptx(bytes), kind, ocr: false };
  if (kind === "stl") return { ...extractStl(bytes), kind, ocr: false };
  if (kind === "text" || kind === "code" || kind === "dxf") {
    const src = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (kind === "dxf") return { ...extractDxf(src), kind, ocr: false };
    return { text: src, tables: filename.toLowerCase().endsWith(".csv") ? [src.split(/\r?\n/).filter(Boolean).map((l) => l.split(/[;,\t]/))] : [], pages: null, warnings: [], kind, ocr: false };
  }
  const dir = await mkdtemp(path.join(tmpdir(), "xx-doc-"));
  try {
    const ext = filename.toLowerCase().split(".").pop()!;
    const file = path.join(dir, `in.${ext}`);
    await writeFile(file, bytes);
    if (kind === "image") return { text: (await ocr(file)).trim(), tables: [], pages: 1, warnings: ["Texte obtenu par reconnaissance optique (OCR) : relire les chiffres, unités et symboles."], kind, ocr: true };
    const info = await run("pdfinfo", [file]).catch(() => "");
    const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1] ?? 0) || null;
    const text = (await run("pdftotext", ["-layout", "-enc", "UTF-8", file, "-"])).trim();
    if (text.replace(/\s/g, "").length > 20) return { text, tables: [], pages, warnings: [], kind, ocr: false };
    // PDF sans couche texte (document scanné) : OCR des premières pages.
    const n = Math.min(pages ?? 1, OCR_MAX_PAGES);
    await run("pdftoppm", ["-r", "200", "-gray", "-png", "-f", "1", "-l", String(n), file, path.join(dir, "p")]);
    const imgs = (await readdir(dir)).filter((f) => f.startsWith("p") && f.endsWith(".png")).sort();
    const parts: string[] = [];
    for (const img of imgs) parts.push(`# Page ${parts.length + 1}\n${(await ocr(path.join(dir, img))).trim()}`);
    const warnings = ["Document scanné : texte obtenu par reconnaissance optique (OCR) ; relire les chiffres, unités et symboles."];
    if ((pages ?? 0) > OCR_MAX_PAGES) warnings.push(`Seules les ${OCR_MAX_PAGES} premières pages ont été lues (document de ${pages} pages).`);
    return { text: parts.join("\n\n"), tables: [], pages, warnings, kind, ocr: true };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
