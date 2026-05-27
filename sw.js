const CACHE_NAME = "fintrack-v6";

const urlsToCache = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js"
];

self.addEventListener("install", event => {

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );

});

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys.map(key => {

          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }

        })

      );

    })

  );

  self.clients.claim();

});

self.addEventListener("fetch", event => {

  event.respondWith(

    fetch(event.request)
      .catch(() => caches.match(event.request))

  );

});
