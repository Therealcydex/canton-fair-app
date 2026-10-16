// Service worker of the installed app (iPhone "Add to Home Screen", Android "Install", D36/D52).
// It keeps the app's own files (HTML, JS, CSS, icons, the card reader) so the app opens fast on a
// weak network. It never caches the data: /api and /uploads always go to the server (online
// only, BNF04). A new version: change VERSION, the old cache is dropped on activation.
const VERSION = 'sourcing-web-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(['/index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return; // data: network only

  // A page (every route is the same index.html): network first, to get a new version; the cached
  // copy when the network is down.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put('/index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Built files have a hash in their name: cache first, then the network (and keep a copy).
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});
