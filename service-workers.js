self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("pwa-alertas-v1").then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/login.html",
        "/alertas.html",
        "/styles.css",
        "/app.js",
        "/auth.js"
      ]);
    })
  );
  console.log("✅ Service Worker instalado");
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
