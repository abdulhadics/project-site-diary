const cacheName = "project-site-diary-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.add("/")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function staticAsset(url) {
  return url.origin === self.location.origin
    && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest");
}

self.addEventListener("message", (event) => {
  if (!Array.isArray(event.data?.assets)) return;
  const urls = event.data.assets.filter((path) => typeof path === "string" && staticAsset(new URL(path, self.location.origin)));
  event.waitUntil(caches.open(cacheName).then((cache) => Promise.allSettled(
    urls.map(async (url) => { if (!await cache.match(url)) await cache.add(url); }),
  )));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname === "/") {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(cacheName);
        await cache.put("/", response.clone()).catch(() => {});
      }
      return response;
    }).catch(async () => (await caches.open(cacheName)).match("/").then((saved) => saved ?? Response.error())));
  } else if (staticAsset(url)) {
    event.respondWith(caches.open(cacheName).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => {});
      return response;
    }));
  }
});
