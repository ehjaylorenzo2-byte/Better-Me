/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

// Precache the built app shell so it loads offline (spec #53/#55: PWA shell
// works offline, but real data writes are never faked while offline).
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Single-page-app fallback: any navigation (e.g. opening /habits directly, or
// refreshing a deep link while offline) is served the cached index.html so
// React Router can take over. Without this, deep links 404 offline even though
// the shell is cached. Non-navigation requests are unaffected.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api/, /\/[^/?]+\.[^/]+$/],
  }),
)

self.skipWaiting()
clientsClaim()

// ---------------------------------------------------------------------------
// Web Push: handles both the 1-hour-before reminder and the 12PM Philippine
// daily summary, both of which are sent as Web Push messages by the
// Supabase Edge Function on a schedule (see supabase/functions/send-reminders).
// The payload is small JSON: { title, body, url, tag }.
// ---------------------------------------------------------------------------
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title: string; body: string; url?: string; tag?: string } = {
    title: 'Better Me',
    body: 'You have an update.',
  }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // Non-JSON push payload; fall back to defaults.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
