// MosquitoApp Service Worker — Web Push Notifications
// v20260429.1

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'MosquitoApp', body: e.data.text() }; }

  const title = data.title || 'MosquitoApp 🦟';
  const options = {
    body: data.body || 'Nowe powiadomienie',
    icon: data.icon || '/moskitiery/favicon.ico',
    badge: '/moskitiery/favicon.ico',
    tag: data.tag || 'mosquito-' + Date.now(),
    data: { url: data.url || '/moskitiery/' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/moskitiery/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Jeśli apka już otwarta — focus
      for (const client of clients) {
        if (client.url.includes('moskitiery') && 'focus' in client) {
          return client.focus();
        }
      }
      // Jeśli nie — otwórz nową kartę
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
