/* XAM-XAM LAB — service worker : réseau d'abord ; hors connexion, réponse en cache marquée (X-XX-From-Cache). */
const CACHE = "xamxam-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/connexion"]).catch(() => undefined))); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  const u = new URL(r.url);
  if (u.pathname.startsWith("/api/auth/") || u.pathname.startsWith("/api/device/") || u.pathname === "/api/me") return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)).catch(() => undefined); }
    return res;
  }).catch(async () => {
    const hit = await caches.match(r);
    if (!hit) return new Response(JSON.stringify({ error: "Hors connexion", key: "err.network" }), { status: 503, headers: { "Content-Type": "application/json" } });
    const h = new Headers(hit.headers); h.set("X-XX-From-Cache", "1");
    return new Response(await hit.blob(), { status: hit.status, headers: h });
  }));
});
