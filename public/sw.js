// PizzaDOC Service Worker
// Version: 1.0.0

const CACHE_NAME = 'pizzadoc-v1';
const OFFLINE_URL = '/offline';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Service worker installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache addAll failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (they need fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // For API requests, return a generic error response when offline
          return new Response(
            JSON.stringify({ error: 'Offline', message: 'Connessione non disponibile' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Skip auth requests
  if (url.pathname.startsWith('/auth/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For navigation requests, use network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Try cache first, then offline page
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // For other requests (assets), use cache first with network fallback
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cache but also fetch in background
          event.waitUntil(
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, response));
                }
              })
              .catch(() => {
                // Ignore network errors for background fetches
              })
          );
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }
            return response;
          });
      })
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nuovo aggiornamento',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/dashboard'
      },
      actions: [
        { action: 'open', title: 'Apri' },
        { action: 'close', title: 'Chiudi' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PizzaDOC', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.url || '/dashboard';
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // If a window is already open, focus it
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.navigate(urlToOpen);
              return client.focus();
            }
          }
          // Otherwise, open a new window
          return self.clients.openWindow(urlToOpen);
        })
    );
  }
});

// Background sync for offline data submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-hours') {
    event.waitUntil(syncHours());
  }
});

async function syncHours() {
  // Get pending hours from IndexedDB and sync them
  // This is a placeholder for future background sync implementation
  console.log('[SW] Syncing hours...');
}
