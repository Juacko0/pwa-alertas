// ============================
// 🧩 PWA ALERTAS - SERVICE WORKER
// ============================

const CACHE_NAME = "pwa-alertas-v3";
const APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/alertas.html",
  "/styles.css",
  "/app.js",
  "/auth.js",
  "/icons/icon.png"
];

// ============================
// 📦 INSTALACIÓN Y CACHE
// ============================
self.addEventListener("install", (event) => {
  console.log("✅ [SW] Instalando Service Worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 [SW] Archivos cacheados:", APP_SHELL);
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ============================
// ♻️ ACTIVACIÓN Y LIMPIEZA
// ============================
self.addEventListener("activate", (event) => {
  console.log("♻️ [SW] Activando nuevo Service Worker...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("🧹 [SW] Eliminando caché antiguo:", key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ============================
// 🌐 FETCH (modo offline)
// ============================
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          // Cachea solo si es un recurso válido
          if (
            response.status === 200 &&
            response.type === "basic" &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});

// ============================
// 🔔 PUSH NOTIFICATIONS
// ============================
self.addEventListener("push", (event) => {
  console.log("📩 [SW] Notificación recibida:", event.data ? event.data.text() : "sin datos");

  const data = event.data ? event.data.json() : {};
  const title = data.title || "🚨 Nueva Alerta Laboral";
  const body = data.body || "Se ha reportado un nuevo incidente";
  const icon = "/icons/icon.png";

  event.waitUntil(
    (async () => {
      // Mostrar la notificación
      await self.registration.showNotification(title, {
        body,
        icon,
        badge: "/icons/icon.png",
        vibrate: [200, 100, 200],
        data: { url: "/alertas.html" },
        actions: [
          { action: "ver", title: "🔎 Ver alerta" },
          { action: "cerrar", title: "❌ Cerrar" }
        ]
      });

      // 🔁 Enviar mensaje a la app abierta para mostrar el modal automáticamente
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        client.postMessage({
          tipo: "alerta",
          mensaje: data.data || data // 👈 Enviar el objeto completo con _id, location, etc.
        });
      }
    })()
  );
});

// ============================
// 🧭 INTERACCIÓN CON NOTIFICACIONES
// ============================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const appUrl = new URL("/alertas.html", self.location.origin).href;

      // Si ya hay una ventana abierta, la enfocamos y enviamos la alerta
      for (const client of allClients) {
        if (client.url.startsWith(appUrl) && "focus" in client) {
          client.focus();
          client.postMessage({ tipo: "alerta", mensaje: data });
          return;
        }
      }

      // Si no hay ventana abierta, abrimos una nueva con la alerta en query string
      const params = new URLSearchParams({
        alertaData: JSON.stringify(data),
      });
      await clients.openWindow(`${appUrl}?${params.toString()}`);
    })()
  );
});

