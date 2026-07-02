// Service worker disabled temporarily.
// Offline lesson data still works through localStorage.
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => self.clients.claim());
