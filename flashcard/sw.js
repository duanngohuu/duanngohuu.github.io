// Disabled service worker. Self-unregisters if an old registration updates to this file.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    self.registration.unregister().then(() =>
      self.clients.matchAll({ type: 'window' }).then(clients => clients.forEach(client => client.navigate(client.url)))
    )
  );
});
