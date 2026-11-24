import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { register, call, type Session } from "./helpers";
import * as registerRoute from "@/app/api/auth/register/route";
import * as docs from "@/app/api/documents/route";
import * as doc from "@/app/api/documents/[id]/route";
import * as exp from "@/app/api/documents/[id]/export/route";
import { toDocx, toPdf } from "@/lib/docs/export";
import { extractDocx } from "@/lib/docs/office";

const TEXT = readFileSync(path.join(import.meta.dirname, "../fixtures/exercice.txt"), "utf8");
let s: Session, other: Session;

/** PDF « image seule » (comme un scanner) : une page contenant une image JPEG, sans couche texte. */
function jpegPdf(jpg: Uint8Array): Uint8Array {
  let i = 2, w = 0, h = 0;
  while (i < jpg.length) { const m = jpg[i + 1], len = (jpg[i + 2] << 8) | jpg[i + 3]; if (m >= 0xc0 && m <= 0xc2) { h = (jpg[i + 5] << 8) | jpg[i + 6]; w = (jpg[i + 7] << 8) | jpg[i + 8]; break; } i += 2 + len; }
  const parts: (string | Uint8Array)[] = []; const offs: number[] = []; let size = 0;
  const add = (x: string | Uint8Array) => { parts.push(x); size += typeof x === "string" ? Buffer.byteLength(x, "latin1") : x.length; };
  const obj = (n: number, body: string, stream?: Uint8Array) => { offs[n] = size; add(`${n} 0 obj\n${body}\n`); if (stream) { add("stream\n"); add(stream); add("\nendstream\n"); } add("endobj\n"); };
  add("%PDF-1.4\n");
  const content = `q 595 0 0 842 0 0 cm /Im0 Do Q`;
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>"); obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  obj(5, `<< /Length ${content.length} >>`, new TextEncoder().encode(content));
  const xref = size;
  add(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts.map((x) => (typeof x === "string" ? Buffer.from(x, "latin1") : Buffer.from(x))));
}
const dir = mkdtempSync(path.join(tmpdir(), "xx-docs-"));

async function upload(session: Session, name: string, bytes: Uint8Array, extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append("file", new File([bytes as BlobPart], name));
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await (docs.POST as never as (r: Request, c: unknown) => Promise<Response>)(new Request("http://localhost/api/documents", { method: "POST", body: fd, headers: { cookie: session.cookie } }), { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() as Record<string, unknown> };
}
const report = async (id: string) => (await call(doc.GET as never, "GET", `/api/documents/${id}`, { session: s, params: { id } })).json as { markdown: string; report: { exercises: { result: unknown; answers: { verdict: string }[] }[] }; ocr: boolean; extracted_text: string };

beforeAll(async () => { s = await register(registerRoute.POST as never, "docs@test.local", "student"); other = await register(registerRoute.POST as never, "docs2@test.local", "student"); });

describe("Dépôt et analyse de documents", () => {
  it("texte : exercices résolus, réponses corrigées, rapport séparant extrait / calculé / manquant", async () => {
    const r = await upload(s, "devoir.txt", new TextEncoder().encode(TEXT));
    expect(r.status).toBe(201); expect(r.json.exercises).toBe(4);
    const d = await report(r.json.id as string);
    expect(d.markdown).toMatch(/### Informations extraites du document/);
    expect(d.markdown).toMatch(/### Résolution \(résultats calculés\)/);
    expect(d.markdown).toMatch(/I = 5 A → correct/);
    expect(d.markdown).toMatch(/I = 20 A → incorrect \(calculé : 14\.1/);
    expect(d.markdown).toMatch(/### Données manquantes \(non inventées\)/);
    expect((await call(doc.GET as never, "GET", "/x", { session: other, params: { id: r.json.id as string } })).status).toBe(404);
  });

  it("Word et PDF : extraction puis exports Word, Excel, PDF, Markdown", async () => {
    const w = await upload(s, "devoir.docx", toDocx("Devoir", TEXT, [[["a", "b"]]]));
    expect(w.status).toBe(201); expect(w.json.tables).toBe(1);
    const p = await upload(s, "devoir.pdf", toPdf("Devoir", TEXT));
    expect(p.status).toBe(201); expect(p.json.ocr).toBe(false);
    expect((await report(p.json.id as string)).markdown).toMatch(/I = 5 A → correct/);
    const id = w.json.id as string;
    const get = (format: string) => (exp.GET as never as (r: Request, c: unknown) => Promise<Response>)(new Request(`http://localhost/api/documents/${id}/export?format=${format}`, { headers: { cookie: s.cookie } }), { params: Promise.resolve({ id }) });
    const docx = new Uint8Array(await (await get("docx")).arrayBuffer());
    expect(extractDocx(docx).text).toMatch(/Rapport d'analyse/);
    const pdf = await get("pdf"); expect(pdf.headers.get("content-type")).toBe("application/pdf");
    const f = path.join(dir, "export.pdf"); writeFileSync(f, new Uint8Array(await pdf.arrayBuffer()));
    expect(execFileSync("pdftotext", [f, "-"]).toString()).toMatch(/Exercice 1/);
    expect((await get("xlsx")).headers.get("content-type")).toMatch(/spreadsheetml/);
    expect(await (await get("md")).text()).toMatch(/^# Rapport d'analyse/);
  });

  it("image et PDF scannés : reconnaissance optique (OCR) puis analyse", async () => {
    const pdf = path.join(dir, "src.pdf"); writeFileSync(pdf, toPdf("Exercice 1", "Une resistance R = 46 Ohm est alimentee sous une tension U = 230 V.\n1) Calculer le courant I."));
    execFileSync("pdftoppm", ["-r", "200", "-png", "-singlefile", pdf, path.join(dir, "scan")]);
    const png = new Uint8Array(readFileSync(path.join(dir, "scan.png")));
    const img = await upload(s, "photo.png", png);
    expect(img.status).toBe(201); expect(img.json.ocr).toBe(true);
    const d = await report(img.json.id as string);
    expect(d.extracted_text).toMatch(/230/);
    // PDF sans couche texte (image seule) → OCR automatique
    const scanned = path.join(dir, "scanned.pdf");
    execFileSync("pdftoppm", ["-r", "200", "-jpeg", "-singlefile", pdf, path.join(dir, "scan")]);
    writeFileSync(scanned, jpegPdf(new Uint8Array(readFileSync(path.join(dir, "scan.jpg")))));
    const sp = await upload(s, "scan.pdf", new Uint8Array(readFileSync(scanned)));
    expect(sp.status).toBe(201); expect(sp.json.ocr).toBe(true);
    expect((await report(sp.json.id as string)).extracted_text).toMatch(/Calculer/);
  }, 120_000);

  it("cas limites : format non pris en charge, signature fausse, vide, trop volumineux, correction puis ré-analyse", async () => {
    expect((await upload(s, "ancien.doc", new Uint8Array([1, 2, 3]))).json.error).toMatch(/enregistrez le fichier au format \.docx/);
    expect((await upload(s, "faux.pdf", new TextEncoder().encode("bonjour"))).json.error).toMatch(/pas un PDF valide/);
    expect((await upload(s, "vide.txt", new Uint8Array())).status).toBe(422);
    expect((await upload(s, "gros.txt", new Uint8Array(16 * 1024 * 1024).fill(65))).json.error).toMatch(/trop volumineux/);
    expect((await upload(s, "virus.exe", new Uint8Array([77, 90]))).json.error).toMatch(/non prise en charge/);
    const r = await upload(s, "ocr.txt", new TextEncoder().encode("Exercice 1\nU = 23O V et R = 46 Ω. Calculer I."));
    const id = r.json.id as string;
    expect((await report(id)).report.exercises[0].result).toBeNull();
    expect((await call(doc.PATCH as never, "PATCH", "/x", { session: s, params: { id }, body: { text: "Exercice 1\nU = 230 V et R = 46 Ω. Calculer I." } })).status).toBe(200);
    expect((await report(id)).markdown).toMatch(/Courant I = 5 A/);
    expect((await call(doc.DELETE as never, "DELETE", "/x", { session: s, params: { id } })).status).toBe(200);
  });
});
