const CACHE = 'fintrack-v1';
const ASSETS = [
  './','./index.html','./css/styles.css','./manifest.json',
  './js/config.js','./js/supabaseClient.js','./js/utils.js','./js/auth.js',
  './js/data.js','./js/ui.js','./js/charts.js','./js/app.js',
  './assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Network-first for Supabase/API
  if (url.origin !== location.origin) {
    e.respondWith(fetch(request).catch(()=>caches.match(request)));
    return;
  }
  // Cache-first for app shell
  e.respondWith(caches.match(request).then(r => r || fetch(request).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(request, copy));
    return res;
  }).catch(()=>caches.match('./index.html'))));
});
