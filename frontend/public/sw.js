/* ============================================================
   PunchListJobs Service Worker
   Handles: Push Notifications, Offline Caching (basic)
   ============================================================ */

const CACHE_NAME = "punchlist-v1";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

// ── Install ────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// ── Activate ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (network-first, fall back to cache) ──────────────
self.addEventListener("fetch", (event) => {
  // Only handle same-origin GET requests for HTML/assets
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("ws://") ||
    event.request.url.includes("wss://")
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push ──────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = { title: "PunchListJobs", body: "You have a new notification.", url: "/", icon: "/icon-192.png" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {}

  const { title, body, url, icon } = data;

  const options = {
    body,
    icon,
    badge: "/icon-192.png",
    tag: url,            // deduplicate by URL
    renotify: true,
    requireInteraction: false,
    data: { url },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "PUSH_NAV", url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Background Sync (future) ──────────────────────────────
self.addEventListener("sync", () => {
  // Reserved for offline job action queuing
});
