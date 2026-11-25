// Tiene in cache la pagina e la libreria Firebase, così l'app si apre anche senza rete.
// I dati della lista li gestisce Firestore con la sua cache locale.
const CACHE = "onf-v14";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./scanner.js", "./avatars.js", "./receipt.js", "./icons.js", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const staticLib = url.hostname === "www.gstatic.com" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (sameOrigin) {
    // Prima la rete (così gli aggiornamenti arrivano subito), poi la cache.
    // "no-cache": chiede sempre al server se il file è cambiato (GitHub Pages altrimenti lo tiene 10 minuti)
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
  } else if (staticLib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});

// ---------- notifiche push ----------
// Il servizio su Cloudflare manda { title, body, url, tag }: la mostriamo sempre
// (su iPhone ogni push deve diventare una notifica visibile).
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "Oh no, è finito!";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: data.tag || "spesa",
    renotify: true,
    data: { url: data.url || "./#spesa" },
  }));
});

// toccando la notifica: apre l'app (o la porta in primo piano) sulla lista della spesa
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || "./#spesa", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        w.postMessage({ type: "open", url: target });
        return w.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
