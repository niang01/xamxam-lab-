"""
Étape 1 de la photothèque : candidats sous licence libre, pris UNIQUEMENT dans la catégorie Commons propre au modèle
exact, puis planches de contrôle numérotées. Aucune photo n'est publiée sans validation visuelle (étape 2 : approve.py).
Usage : python3 candidates.py <plan.json> <dossier candidats>
plan.json : [{"key": clé de référence, "label": "nom affiché", "category": "Catégorie propre au modèle", "max": 6}]
"""
import io, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wm import category, raw, fetch, thumb_url  # noqa: E402
from photos import EXCLUDE, license_of, author_of, description_of  # noqa: E402
from PIL import Image, ImageDraw

def main(plan_path, outdir):
    os.makedirs(outdir, exist_ok=True)
    meta_path = os.path.join(outdir, "candidates.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for item in json.load(open(plan_path)):
        if item["key"] in meta: continue
        _, files = category(item["category"])
        got = []
        for f in files:
            if len(got) >= item.get("max", 6): break
            if EXCLUDE.search(f) or not re.search(r"\.(jpe?g|png|webp)$", f, re.I): continue
            text = raw(f)
            if not text: continue
            lic = license_of(text)
            if not lic: continue
            data = fetch(thumb_url(f), binary=True, pause=4.0)
            if not data or len(data) < 2000: continue
            try:
                im = Image.open(io.BytesIO(data)).convert("RGB"); im.thumbnail((640, 640))
            except Exception:
                continue
            n = len(got) + 1
            name = re.sub(r"[^a-z0-9]+", "-", f"{item['key']}-{n}".lower()) + ".webp"
            im.save(os.path.join(outdir, name), "WEBP", quality=80, method=6)
            got.append({"n": n, "file": name, "title": f, "author": author_of(text), "license": lic[0], "license_url": lic[1],
                        "source": "https://commons.wikimedia.org/wiki/File:" + f.replace(" ", "_"), "description": description_of(text), "w": im.width, "h": im.height})
        meta[item["key"]] = {"label": item["label"], "category": item["category"], "candidates": got}
        json.dump(meta, open(meta_path, "w"), ensure_ascii=False, indent=1)
        print(item["key"], len(got), "candidat(s)", flush=True)
    sheets(meta, outdir)

def sheets(meta, outdir, per=6):
    """Planches de contrôle : une ligne par référence, candidats numérotés."""
    rows = [(k, v) for k, v in meta.items() if v["candidates"]]
    for s in range(0, len(rows), 8):
        chunk = rows[s:s + 8]
        sheet = Image.new("RGB", (220 + per * 230, 200 * len(chunk)), "white")
        d = ImageDraw.Draw(sheet)
        for r, (k, v) in enumerate(chunk):
            y = r * 200
            d.text((8, y + 8), v["label"][:30], fill="black"); d.text((8, y + 26), k[-30:], fill="gray")
            for c in v["candidates"][:per]:
                im = Image.open(os.path.join(outdir, c["file"])); im.thumbnail((220, 180))
                x = 220 + (c["n"] - 1) * 230
                sheet.paste(im, (x, y + 10)); d.rectangle([x, y + 10, x + 24, y + 30], fill="yellow"); d.text((x + 6, y + 13), str(c["n"]), fill="black")
            d.line([(0, y + 199), (sheet.width, y + 199)], fill="lightgray")
        sheet.save(os.path.join(outdir, f"planche-{s // 8 + 1:02d}.jpg"), quality=80)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
