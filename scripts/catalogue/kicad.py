"""Extraction des symboles KiCad (licence CC-BY-SA 4.0) : propriétés et broches de chaque référence réelle."""
import os, re, json, sys
ROOT = "/tmp/claude-0/harvest/kicad-symbols"
def prop(s, k):
    m = re.search(r'\(property "%s" "((?:[^"\\]|\\.)*)"' % re.escape(k), s)
    return m.group(1).replace('\\"', '"') if m else ""
def pins(s):
    out = []
    for m in re.finditer(r'\(pin (\w+) \w+.*?\(name "((?:[^"\\]|\\.)*)".*?\(number "((?:[^"\\]|\\.)*)"', s, re.S):
        out.append({"type": m.group(1), "name": m.group(2), "number": m.group(3)})
    seen, uniq = set(), []
    for p in out:
        if p["number"] not in seen: seen.add(p["number"]); uniq.append(p)
    return uniq
def load(lib):
    d = os.path.join(ROOT, lib + ".kicad_symdir")
    items = []
    for f in sorted(os.listdir(d)):
        s = open(os.path.join(d, f), encoding="utf-8").read()
        name = f[:-len(".kicad_sym")]
        ext = re.search(r'\(extends "([^"]+)"\)', s)
        items.append({"lib": lib, "name": name, "value": prop(s, "Value"), "description": prop(s, "Description"),
                      "keywords": prop(s, "ki_keywords"), "datasheet": prop(s, "Datasheet"), "footprint": prop(s, "Footprint"),
                      "extends": ext.group(1) if ext else None, "pins": pins(s)})
    return items
if __name__ == "__main__":
    for lib in sys.argv[1:]:
        it = load(lib); print(lib, len(it), sum(1 for x in it if x["datasheet"].startswith("http")))
