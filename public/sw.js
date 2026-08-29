/* Vynq-chat service worker — genuine PWA offline shell.
 * Strategy:
 *  - Navigation requests: network-first, fall back to cached app shell.
 *  - Static build assets (hashed): cache-first (precache + runtime).
 *  - Firebase Auth/Firestore/Storage: never cache (let Firebase SDK handle).
 * User media (profile/storage) is cached at runtime so the shell stays usable offline.
 */
const VERSION = "vynq-v1";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icons/vynq-192.svg", "/icons/vynq-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isFirebaseApi(url) {
  return (
    url.hostname.endsWith("googleapis.com") ||
    url.hostname.endsWith("firebaseio.com") ||
    url.hostname.endsWith("firebasestorage.googleapis.com") ||
    url.hostname.endsWith("gstatic.com") ||
    url.pathname.startsWith("/__/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isFirebaseApi(url)) return; // let Firebase SDK manage auth/data/storage

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // Cache same-origin static + media at runtime (not opaque cross-origin).
          if (res.ok && (url.origin === self.location.origin)) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});
