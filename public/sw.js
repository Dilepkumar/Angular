// RoomLedger Service Worker for PWA Push Notifications & Offline Support
const CACHE_NAME = 'roomledger-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Web Push Event Handler ──
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { notification: { title: 'RoomLedger', body: event.data.text() } };
    }
  }

  const notification = data.notification || {
    title: 'RoomLedger Notification',
    body: 'You have a new update in your flat ledger.'
  };

  const title = notification.title || 'RoomLedger';
  const options = {
    body: notification.body || '',
    icon: notification.icon || '/icons/icon-192x192.png',
    badge: notification.badge || '/icons/icon-72x72.png',
    vibrate: notification.vibrate || [100, 50, 100],
    data: notification.data || { url: '/' },
    actions: notification.actions || [
      { action: 'open', title: 'Open RoomLedger' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click Handler ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl) || targetUrl === '/') {
            return client.focus();
          }
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
