/**
 * Push Notification Service Worker
 * 
 * Handles push notifications when VAPID is configured.
 * Registers automatically when push notifications are enabled in user preferences.
 */

self.addEventListener('install', (event) => {
  console.log('[Push SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Push SW] Activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[Push SW] Push received');
  
  if (!event.data) {
    console.warn('[Push SW] Push event has no data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error('[Push SW] Failed to parse push payload:', error);
    return;
  }

  const { title = 'Workspace Notification', body, data } = payload;
  
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data?.resourceType && data?.resourceId 
      ? `${data.resourceType}-${data.resourceId}` 
      : 'default',
    data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Push SW] Notification clicked');
  event.notification.close();

  const { resourceType, resourceId } = event.notification.data || {};
  
  // Build URL based on resource type
  let url = '/app';
  if (resourceType && resourceId) {
    url = `/app/${resourceType}/${resourceId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if already open
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[Push SW] Notification closed', event.notification.tag);
});
