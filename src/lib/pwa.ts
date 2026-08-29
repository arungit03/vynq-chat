// PWA: register service worker (genuine installable offline shell).
// No-op in dev unless Vite serves the SW; safe to call always.

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Only register in production build to avoid dev caching quirks.
  if (import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[Vynq-chat] Service worker registration failed:", err);
    });
  });
}
