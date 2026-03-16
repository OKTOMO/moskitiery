// MosquitoApp Service Worker
// v1.0 — offline cache + Web Push notifications

const CACHE_NAME = 'mosquitoapp-v1';

// Zasoby do cache przy instalacji
const PRECACHE = [
  '/moskitiery/',
  '/moskitiery/index.html',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// ── Install ──
self.addEventListener('install', event => {
  console.log('[SW] install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ── Activate ──
self.addEventListener('activate', event => {
  console.log('[SW] activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — network-first dla API, cache-first dla statyki ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API i allegro — zawsze sieć, nigdy cache
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('allegro') ||
    url.hostname.includes('jsonbin') ||
    url.hostname.includes('anthropic')
  ) {
    return; // przeglądarka obsługuje normalnie
  }

  // Statyka — cache-first z fallback do sieci
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && event.request.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return resp;
      });
    }).catch(() => caches.match('/moskitiery/'))
  );
});

// ── Push notifications ──
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'MosquitoApp', body: event.data ? event.data.text() : 'Nowe powiadomienie' };
  }

  const title = data.title || 'MosquitoApp';
  const options = {
    body: data.body || '',
    icon: '/moskitiery/icons/icon-192.png',
    badge: '/moskitiery/icons/icon-192.png',
    tag: data.tag || 'mosquitoapp',
    renotify: true,
    data: { url: data.url || '/moskitiery/' },
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Kliknięcie w powiadomienie ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/moskitiery/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/moskitiery') && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ── Background Sync (opcjonalnie — dla zamówień offline) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      // Wyślij zakolejkowane zamówienia gdy wróci łączność
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'BACKGROUND_SYNC' }));
      })
    );
  }
});
