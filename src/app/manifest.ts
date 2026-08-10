import type { MetadataRoute } from 'next'

/**
 * PWA manifest — makes A3Chat installable as a standalone app.
 * Icons live under /icons (see public/icons).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'A3Chat — Private Messaging',
    short_name: 'A3Chat',
    description:
      'Private messaging that disappears. Chats auto-delete after 7 days, Status after 24 hours.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f8f7',
    theme_color: '#0f9d58',
    categories: ['social', 'communication'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
