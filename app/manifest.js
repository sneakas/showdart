export default function manifest() {
  return {
    id: '/spil',
    name: 'Showdart Spil',
    short_name: 'Showdart',
    description: 'Showdart tablet-app til Mickey, turneringer og mesterskaber.',
    start_url: '/spil',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#030806',
    theme_color: '#04120c',
    categories: ['sports', 'games'],
    lang: 'da',
    icons: [
      { src: '/icons/showdart-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/showdart-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/showdart-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
