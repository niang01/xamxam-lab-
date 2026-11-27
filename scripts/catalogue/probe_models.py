"""Recherche de la catégorie Commons consacrée à chaque modèle (Category:<modèle>) : liste des fichiers trouvés."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from wm import category  # noqa: E402
refs = json.load(open(sys.argv[1]))
out = json.load(open(sys.argv[2])) if os.path.exists(sys.argv[2]) else {}
for r in refs:
    if r["name"] in out: continue
    names = [r["name"]] + [re.sub(r"[-_](xx|x|TO-?220|TO-?92|SOT-?\\w+|DIP-?\\d+|P|N|D|PU|AU|A|MU|SS|LP|NEO|xT|xD|xP)$", "", r["name"])]
    found = {}
    for n in dict.fromkeys(x.replace("_", " ") for x in names):
        if len(n) < 4: continue
        subs, files = category(n)
        if files: found[n] = files[:40]
    out[r["name"]] = found
    if found: print(r["name"], "->", {k: len(v) for k, v in found.items()}, flush=True)
    json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
