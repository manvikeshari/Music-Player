/* sw.js – Aura Music Service Worker */
'use strict';

const CACHE_NAME = 'aura-music-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ── INSTALL: cache all static assets ── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

/* ── ACTIVATE: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: cache-first for static, network-first for others ── */
self.addEventListener('fetch', event => {
  // only handle GET requests
  if (event.request.method !== 'GET') return;

  // skip chrome-extension and non-http requests
  const url = event.request.url;
  if (!url.startsWith('http')) return;

  // cache-first strategy for static app shell
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // only cache valid responses from same origin
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // offline fallback → return the app shell
        return caches.match('./index.html');
      });
    })
  );
});
