const CACHE_NAME = 'sds-v7';

const PRECACHE = [
  '/',
  '/explosion-triangle',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не кэшируем API-запросы к бэкенду и внешним ресурсам
  if (
    url.hostname.includes('functions.poehali.dev') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.poehali.dev')
  ) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // JS/CSS файлы — всегда из сети (чтобы не кешировать старые версии)
  if (url.pathname.includes('/node_modules/') || url.pathname.match(/\.(js|css)(\?|$)/)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((r) => r || new Response('', { status: 503 })))
    );
    return;
  }

  // Для навигационных запросов — сначала сеть, потом кэш
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || new Response('Офлайн', { status: 503 })))
    );
    return;
  }

  // Для остальной статики — сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
    })
  );
});
