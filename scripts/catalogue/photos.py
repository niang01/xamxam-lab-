"""
Photothèque du catalogue : photographies réelles sous licence libre (Wikimedia Commons), avec auteur, licence et page
source conservés. Usage : python3 scripts/catalogue/photos.py <plan.json> <sortie photos.json> <dossier public>
plan.json : [{"key": clé de référence, "category": "Catégorie Commons" | null, "files": ["Fichier.jpg", ...] | null, "max": 2}]
Seules les licences libres sont acceptées (CC0, CC BY, CC BY-SA, domaine public). Les schémas, symboles, logos et
diagrammes sont écartés : seules les photographies du matériel sont retenues. Chaque photo est ensuite contrôlée
visuellement avant publication (planches de contrôle).
"""
import io, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from wm import category, raw, fetch, thumb_url  # noqa: E402

EXCLUDE = re.compile(r"(diagram|schema|schematic|symbol|logo|icon|pinout|drawing|circuit|plot|graph|chart|map|\.svg|\.pdf|\.gif|\.tif|\.webm|\.ogv|animation|patent|label|box\b|packag|datasheet|scheme|wiring|layout|sketch|render|screenshot|x-ray|xray|die\b|decap)", re.I)
LIC = [
    (r"cc-by-sa-(\d\.\d)", lambda v: (f"CC BY-SA {v}", f"https://creativecommons.org/licenses/by-sa/{v}/")),
    (r"cc-by-(\d\.\d)", lambda v: (f"CC BY {v}", f"https://creativecommons.org/licenses/by/{v}/")),
    (r"cc-zero|cc0", lambda v: ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/")),
    (r"pd-self|pd-author|pd-user|public domain|pd-old|pd-us|pd-ineligible|pd-textlogo", lambda v: ("Domaine public", None)),
]

def license_of(text):
    t = text.lower()
    if re.search(r"non-free|fair use|copyvio|nominated for deletion|\{\{delete", t): return None
    for rx, f in LIC:
        m = re.search(r"\{\{[^}]*?" + rx, t)
        if m: return f(m.group(1) if m.groups() else None)
    return None

def clean(s):
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)          # [[lien|texte]]
    s = re.sub(r"\[https?://\S+ ([^\]]+)\]", r"\1", s)                # [url texte]
    s = re.sub(r"\{\{[^{}]*\|([^{}|]+)\}\}", r"\1", s)                 # {{modèle|valeur}}
    s = re.sub(r"\{\{|\}\}|'''|''|<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()[:200]

def author_of(text):
    m = re.search(r"\|\s*[Aa]uthor\s*=\s*(.+)", text)
    return clean(m.group(1)) if m else "Auteur indiqué sur la page source"

def description_of(text):
    m = re.search(r"\|\s*[Dd]escription\s*=\s*(.+)", text)
    return clean(m.group(1)) if m else ""

def process(plan, outdir):
    from PIL import Image
    os.makedirs(outdir, exist_ok=True)
    result = {}
    for item in plan:
        files = item.get("files") or []
        if item.get("category"):
            _, fs = category(item["category"])
            files = files + [f for f in fs if f not in files]
        got = []
        for f in files:
            if len(got) >= item.get("max", 2): break
            if EXCLUDE.search(f) or not re.search(r"\.(jpe?g|png|webp)$", f, re.I): continue
            if re.search(r",.*\band\b|\bvs\.?\b|\bcomparison\b|\bcollection\b|\bfamily\b", f, re.I): continue  # photos de groupe
            text = raw(f)
            if not text: continue
            lic = license_of(text)
            if not lic: continue
            data = fetch(thumb_url(f), binary=True, pause=4.0)
            if not data or len(data) < 2000: continue
            try:
                im = Image.open(io.BytesIO(data)); im = im.convert("RGB"); im.thumbnail((640, 640))
            except Exception:
                continue
            name = re.sub(r"[^a-z0-9]+", "-", (item["key"] + "-" + str(len(got) + 1)).lower()) + ".webp"
            im.save(os.path.join(outdir, name), "WEBP", quality=80, method=6)
            got.append({"file": name, "title": f, "author": author_of(text), "license": lic[0], "license_url": lic[1],
                        "source": "https://commons.wikimedia.org/wiki/File:" + f.replace(" ", "_"), "description": description_of(text), "w": im.width, "h": im.height})
            print(item["key"], "<-", f, "|", lic[0], flush=True)
        if got: result[item["key"]] = got
    return result

if __name__ == "__main__":
    plan = json.load(open(sys.argv[1]))
    res = process(plan, sys.argv[3])
    prev = json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else {}
    prev.update(res)
    json.dump(prev, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
    print("références illustrées :", len(prev))
