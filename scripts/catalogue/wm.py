"""Accès poli à Wikimedia Commons (pages ordinaires, pas l'API) : une requête toutes les 3 s, reprise sur 429, cache disque."""
import hashlib, os, re, ssl, time, urllib.parse, urllib.request, json, sys
UA = "XamxamLabLibraryHarvester/1.0 (educational use; low request rate)"
CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
CACHE = "/tmp/claude-0/harvest/cache"
_last = [0.0]
def fetch(url, binary=False, pause=3.0):
    key = hashlib.sha1(url.encode()).hexdigest()
    p = os.path.join(CACHE, key + (".bin" if binary else ".txt"))
    if os.path.exists(p):
        return open(p, "rb").read() if binary else open(p, encoding="utf-8").read()
    for attempt in range(8):
        wait = _last[0] + pause - time.time()
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
                data = r.read()
            open(p, "wb").write(data)
            return data if binary else data.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            ra = e.headers.get("Retry-After") if e.headers else None
            wait = int(ra) if ra and ra.isdigit() else 20 * (attempt + 1)
            print(f"[wm] HTTP {e.code} — nouvelle tentative dans {wait} s : {url[:90]}", file=sys.stderr, flush=True)
            time.sleep(min(wait, 120))
        except Exception as e:
            print(f"[wm] {type(e).__name__} — nouvelle tentative : {url[:90]}", file=sys.stderr, flush=True)
            time.sleep(10 * (attempt + 1))
    return None
def q(t): return urllib.parse.quote(t.replace(" ", "_"))
def category(name):
    """Sous-catégories et fichiers d'une catégorie (page ordinaire)."""
    html = fetch(f"https://commons.wikimedia.org/wiki/{q('Category:' + name)}") or ""
    subs = sorted(set(urllib.parse.unquote(m) for m in re.findall(r'href="/wiki/Category:([^"#?]+)"', html)))
    files = sorted(set(urllib.parse.unquote(m) for m in re.findall(r'href="/wiki/File:([^"#?]+)"', html)))
    return [s.replace("_", " ") for s in subs], [f.replace("_", " ") for f in files]
def raw(file):
    return fetch(f"https://commons.wikimedia.org/w/index.php?title={q('File:' + file)}&action=raw")
def thumb_url(file, width=640):
    """Miniature servie par le cache de Wikimedia (moins coûteuse pour leurs serveurs que l'original)."""
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(file.replace(' ', '_'))}?width={width}"
def original_url(file):
    f = file.replace(" ", "_"); h = hashlib.md5(f.encode()).hexdigest()
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{urllib.parse.quote(f)}"
