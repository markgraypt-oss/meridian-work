// MeridianWork web push service worker.
// Receives push payloads from the server and surfaces them as native
// notifications. Clicking opens (or focuses) the app at the optional
// `data.url` route.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'MeridianWork', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'MeridianWork';
  const options = {
    body: payload.body || '',
    icon: '/email-banner.png',
    badge: '/email-banner.png',
    data: payload.data || {},
    tag: payload.category || 'meridian',
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
