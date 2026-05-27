#!/data/data/com.termux/files/usr/bin/bash

echo "==============================="
echo " FinTrack Cache Fix Script"
echo "==============================="

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./fix-cache.sh v6"
  exit 1
fi

echo ""
echo "Using cache version: $VERSION"
echo ""

########################################
# Update index.html CSS
########################################

sed -i "s|css/styles.css?v=[^\"]*|css/styles.css?$VERSION|g" index.html
sed -i "s|css/styles.css\"|css/styles.css?$VERSION\"|g" index.html

########################################
# Update JS versioning
########################################

FILES=(
"config.js"
"supabaseClient.js"
"utils.js"
"auth.js"
"data.js"
"ui.js"
"charts.js"
"app.js"
)

for file in "${FILES[@]}"
do

  sed -i "s|js/$file?v=[^\"]*|js/$file?$VERSION|g" index.html
  sed -i "s|js/$file\"|js/$file?$VERSION\"|g" index.html

done

########################################
# Rewrite sw.js
########################################

cat > sw.js <<EOF
const CACHE_NAME = "fintrack-$VERSION";

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
EOF

########################################
# Git Push
########################################

git add .

git commit -m "cache fix $VERSION"

git push

echo ""
echo "==============================="
echo " DONE"
echo "==============================="
echo ""
echo "Open:"
echo "https://YOUR_SITE.github.io/?$VERSION"
echo ""
