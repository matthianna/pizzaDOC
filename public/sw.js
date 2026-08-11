// PizzaDOC Service Worker
// Version: 1.5.0 — never cache Next.js build assets / RSC (prevents post-deploy #130)

const CACHE_NAME = 'pizzadoc-v1.5.0'
const OFFLINE_URL = '/offline'

// Only cache true static shell assets (not hashed Next bundles or HTML app routes)
const STATIC_ASSETS = [
  '/offline',
  '/manifest.json',
  '/logo.png',
  '/logo-pizza-doc.png',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v1.5.0...')
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Cache addAll failed:', error)
      })
  )
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v1.5.0...')
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      )
      .then(() => self.clients.claim())
  )
})

function isNextBuildAsset(url) {
  return (
    url.pathname.startsWith('/_next/') ||
    url.searchParams.has('_rsc') ||
    url.pathname.includes('/_rsc')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // Always network for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline', message: 'Connessione non disponibile' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )
    return
  }

  // Always network for auth pages
  if (url.pathname.startsWith('/auth/')) {
    event.respondWith(fetch(request))
    return
  }

  // Never cache Next.js build / RSC — stale HTML+old chunks causes React #130 after deploys
  if (isNextBuildAsset(url)) {
    event.respondWith(fetch(request))
    return
  }

  // Navigations: network-first; offline → offline page (do NOT serve stale app HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // Icons / manifest: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json')) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const title = payload.title || 'PizzaDOC'
    const options = {
      body: payload.body || 'Nuova notifica',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      data: payload.data || {},
      tag: payload.tag,
      requireInteraction: payload.requireInteraction || false,
      vibrate: [100, 50, 100],
    }

    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(1).catch(() => {})
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (error) {
    console.error('Error handling push event:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {})
  }

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})
