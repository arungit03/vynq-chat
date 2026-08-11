/**
 * Serves /firebase-messaging-sw.js — the FCM push service worker.
 *
 * Served as a route (not a static public file) so the Firebase config can be
 * injected from the same env the client bundle uses. Shows a generic
 * notification in the background (never message content) and deep-links the
 * click into the chat via the payload's clickUrl.
 */
import { NextResponse } from 'next/server'
import { readFirebaseEnv } from '@/lib/firebase/config'

function swSource(configJson: string): string {
  return `
// A3Chat push notifications service worker.
self.__WB_DISABLE_DEV_LOGS = true;

const firebaseConfig = ${configJson};

if (firebaseConfig.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const options = {
      body: data.body || 'New activity',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.icon || '/icons/icon-192.png',
      data: { url: data.clickUrl || '/' },
    };
    self.registration.showNotification(data.title || 'A3Chat', options);
  });
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
`
}

export function GET(): NextResponse {
  // readFirebaseEnv throws when keys are missing — notifications are optional,
  // so fall back to an empty config that simply skips FCM init.
  let config: Record<string, string | undefined> = {}
  try {
    config = { ...readFirebaseEnv() }
  } catch {
    config = {}
  }

  return new NextResponse(swSource(JSON.stringify(config).replace(/</g, '\\u003c')), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
    },
  })
}
