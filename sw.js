/* Lernkästchen – Service Worker: macht die App offline nutzbar.
   Deine Lerndaten liegen NICHT hier, sondern im Speicher des Browsers (localStorage + IndexedDB);
   ein Update der App ändert sie nie. */
var CACHE = "lernkaestchen-app-5";
var ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: "reload" }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Nur die App-Seite selbst kommt aus dem Speicher; andere Seiten (z. B. noten.html) normal laden.
  var scopePath = new URL(self.registration.scope).pathname;
  var isApp = url.pathname === scopePath || url.pathname === scopePath + "index.html";
  if (req.mode === "navigate" && !isApp) return;

  // App-Seite: sofort aus dem Speicher (startet auch offline), im Hintergrund still aktualisieren.
  if (req.mode === "navigate") {
    var key = new URL("./index.html", self.registration.scope).href;
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(key).then(function (cached) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) c.put(key, res.clone());
          return res;
        }).catch(function () { return null; });
        if (cached) { e.waitUntil(net); return cached; }
        return net.then(function (res) { return res || new Response("Offline", { status: 503 }); });
      });
    }));
    return;
  }

  // Dateien (Icons, Manifest): aus dem Speicher, sonst aus dem Netz holen und merken.
  e.respondWith(caches.match(req).then(function (cached) {
    return cached || fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
  }));
});
