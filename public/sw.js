const CACHE_NAME = 'chatclub-shell-v1';
const BASE_PATH = new URL(self.registration.scope).pathname;
const SHELL_FILES = [
  BASE_PATH,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}favicon.ico`,
  `${BASE_PATH}logo192.png`,
  `${BASE_PATH}logo512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('chatclub-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache cross-origin requests. This keeps Supabase, LiveKit, auth,
  // messages, profiles, call data and Edge Function responses out of Cache API.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(BASE_PATH)),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
