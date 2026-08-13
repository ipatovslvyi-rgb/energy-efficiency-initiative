const CACHE_NAME = 'sds-v8';

self.addEventListener('install', () => {
  // Новая версия активируется немедленно, не ждёт закрытия вкладок
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Бэкенд, шрифты, CDN — всегда напрямую из сети, без кэша
  if (
    url.hostname.includes('functions.poehali.dev') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdn.poehali.dev')
  ) {
    return;
  }

  // Чужие домены не трогаем
  if (url.origin !== self.location.origin) return;

  // HTML-страницы и код приложения — ТОЛЬКО из сети.
  // Кэш служит исключительно аварийным запасом при отсутствии интернета.
  const isCode = /\.(js|mjs|css)(\?|$)/.test(url.pathname);
  if (req.mode === 'navigate' || isCode) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) =>
            r || (req.mode === 'navigate' ? caches.match('/') : undefined) ||
            new Response('Нет соединения', { status: 503 })
          )
        )
    );
    return;
  }

  // Картинки, шрифты и прочая статика — сначала кэш (они не меняются)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
