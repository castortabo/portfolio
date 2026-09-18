const CACHE_NAME = 'ct-portfolio-v4';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/proyecto-tfg.html',
  '/proyecto-emovecare.html',
  '/proyecto-pwa-inmobiliaria.html',
  '/style.css',
  '/manifest.json',
  '/img/perfil.jpg',
  '/img/tfg.jpeg',
  '/img/E-MOVECARE2-0.png',
  '/img/proyecto_iot.png',
  '/img/pwa_inmobiliaria.jpeg',
  '/img/icons/icon-192.svg',
  '/img/icons/icon-512.svg'
];

// Instalación: Cachea los recursos de forma segura (sin que un fallo en uno rompa el resto)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        CACHE_ASSETS.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch((err) => console.warn('No se pudo precachear:', url, err))
        )
      );
    })
  );
});

// Activación: Limpia cualquier caché antigua y toma el control inmediatamente
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Fetch: Network-First para páginas HTML (evita ERR_FAILED), Cache-First para estáticos
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o que vayan a APIs externas (como Web3Forms)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Si no es el mismo origen (CDNs externas como Tailwind, fonts, etc.), intentar red luego caché
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Si es una navegación de página HTML (mode === 'navigate')
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Para assets estáticos (CSS, JS, imágenes): Cache First con actualización en segundo plano
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Actualizar en background
        fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }).catch(() => {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
