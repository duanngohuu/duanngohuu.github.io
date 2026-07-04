const SHELL_CACHE = 'flashcard-shell-20260704-v1';
const RUNTIME_CACHE = 'flashcard-runtime-20260704-v1';
const SCOPE = self.registration.scope;

const SHELL_FILES = [
  './',
  './index.html',
  './static-style.css',
  './ui-fix.css',
  './end-ux-fix.css',
  './polish.css',
  './switch-fix.css',
  './drawer-stable.css',
  './features-stable.css',
  './category-menu.css',
  './header-normal.css',
  './study-mode.css',
  './action-flow.css',
  './gradient-motion.css',
  './card-3d.css',
  './card-display-options.css',
  './focus-lock.css',
  './auto-focus.css',
  './stats-row-fix.css',
  './sheet-library.css',
  './sheet-cache.css',
  './dark-calm.css',
  './core-stable-mini.js',
  './features-stable.js',
  './sheet-tabs.js',
  './offline-store.js',
  './hotfix-completion.js',
  './category-loader.js',
  './study-mode.js',
  './action-flow.js',
  './card-tap-flow.js',
  './card-3d.js',
  './card-display-options.js',
  './sheet-library.js',
  './auto-study.js',
  './theme-settings.js',
  './multi-face-final.js',
  './sheet-cache.js',
  './data/sheet-library-manifest.json',
  './data/manifest.json',
  './data/n2-grammar-manifest.json'
];

function absolute(path) {
  return new URL(path, SCOPE).href;
}

function normalizedRequest(request) {
  const url = new URL(request.url);
  url.search = '';
  return new Request(url.href, { method: 'GET' });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL_FILES.map(async path => {
      const url = absolute(path);
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (response.ok) await cache.put(normalizedRequest(new Request(url)), response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  const key = normalizedRequest(request);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  } catch (_) {
    return await cache.match(key)
      || await cache.match(normalizedRequest(new Request(absolute('./index.html'))))
      || new Response('Flashcard đang offline và chưa có bản lưu ứng dụng.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
  }
}

async function staleWhileRevalidate(request) {
  const shell = await caches.open(SHELL_CACHE);
  const runtime = await caches.open(RUNTIME_CACHE);
  const key = normalizedRequest(request);
  const cached = await shell.match(key) || await runtime.match(key);
  const update = fetch(request).then(async response => {
    if (response.ok) await runtime.put(key, response.clone());
    return response;
  }).catch(() => null);
  if (cached) {
    update.catch(() => {});
    return cached;
  }
  return await update || new Response('', { status: 504 });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL(SCOPE).pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});
