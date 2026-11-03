const CACHE_NAME = 'permaculture-planner-v2'
const urlsToCache = [
  '/',
  '/wizard',
  '/demo',
  '/auth/login',
  '/auth/signup',
  '/manifest.json'
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching files')
      // One URL failing (a deploy in progress, a redirect) used to reject the
      // whole install, leaving the app with no worker at all. Precache what we
      // can and keep going.
      return cache.addAll(urlsToCache).catch((error) => {
        console.warn('Service Worker: precache incomplete', error)
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

/**
 * The offline notice for a navigation. Used instead of a cached page whenever
 * the URL renders one user's data.
 */
function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
                <html>
                <head>
                  <title>Offline - Permaculture Planner</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body {
                      font-family: system-ui, -apple-system, sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(to bottom, #f0fdf4, #ffffff);
                    }
                    .container {
                      text-align: center;
                      padding: 2rem;
                      max-width: 400px;
                    }
                    h1 { color: #166534; }
                    p { color: #4b5563; margin: 1rem 0; }
                    button {
                      background: #16a34a;
                      color: white;
                      border: none;
                      padding: 0.75rem 1.5rem;
                      border-radius: 0.375rem;
                      cursor: pointer;
                      font-size: 1rem;
                    }
                    button:hover { background: #15803d; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>You're Offline</h1>
                    <p>It looks like you've lost your internet connection. Some features may not be available.</p>
                    <p>Reconnect before continuing: changes made while offline are not queued or synced.</p>
                    <button onclick="window.location.reload()">Try Again</button>
                  </div>
                </body>
                </html>`,
    {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    }
  )
}

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return
  }

  // API responses are NEVER cached. The request carries the session cookie and
  // the response is that one user's data, so a cache keyed on the URL alone
  // served one account's plans to the next person on the browser after a
  // failed request. `cache.put` also rejects non-GET requests, which turned
  // every save into an unhandled rejection in this worker.
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Offline: say so rather than replaying someone's cached data.
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'You are currently offline. Some features may not be available.'
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        )
      })
    )
    return
  }

  // Everything below caches a response, so it only applies to GET.
  if (request.method !== 'GET') {
    return
  }

  // Cache first strategy for static assets
  if (
    request.url.includes('/_next/static/') ||
    request.url.includes('/images/') ||
    request.url.includes('.css') ||
    request.url.includes('.js') ||
    request.url.includes('.woff')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response
        }
        return fetch(request).then((response) => {
          // Only a real asset is worth keeping; caching a 404 or a redirect
          // serves it forever.
          if (response.ok) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
      })
    )
    return
  }

  // Pages that render one user's data are not cacheable either: the plan page
  // is a server component that reads the row, so its HTML contains the plan
  // for exactly the reason an API response does.
  const pathname = new URL(request.url).pathname
  const cacheablePage =
    !/^\/(plans|editor)\//.test(pathname) &&
    !/^\/(dashboard|settings|admin)(\/|$)/.test(pathname)

  // Network first with cache fallback for HTML pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Same rule as assets: a failed page (500, redirect) must not become
        // the permanent cached copy of that URL.
        if (response.ok && cacheablePage) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // A user-scoped page has nothing worth replaying offline.
        if (!cacheablePage) return offlinePage()
        return caches.match(request).then((response) => {
          if (response) {
            return response
          }
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/').then((response) => {
              if (response) {
                return response
              }
              return offlinePage()
            })
          }
        })
      })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-plans') {
    event.waitUntil(syncPlans())
  }
})

async function syncPlans() {
  try {
    // Get pending changes from IndexedDB
    const pendingChanges = await getPendingChanges()

    for (const change of pendingChanges) {
      try {
        const response = await fetch(change.url, {
          method: change.method,
          headers: change.headers,
          body: JSON.stringify(change.body)
        })

        if (response.ok) {
          await markChangeAsSynced(change.id)
        }
      } catch (error) {
        console.error('Failed to sync change:', change.id, error)
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}

// Helper functions for IndexedDB
async function getPendingChanges() {
  // This would be implemented with actual IndexedDB
  return []
}

async function markChangeAsSynced(changeId) {
  // This would be implemented with actual IndexedDB
  return true
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  }

  event.waitUntil(
    self.registration.showNotification('Permaculture Planner', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow('/')
  )
})