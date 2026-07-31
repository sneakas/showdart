import { PwaRegistration } from '../components/PwaRegistration';

export const metadata = {
  title: 'Showdart',
  description: 'Showdart turnering, mesterskab og Mickey scoring.',
  applicationName: 'Showdart',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/showdart-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/showdart-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: '/icons/showdart-192.png'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Showdart'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#04120c'
};

export default function RootLayout({ children }) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body style={{ margin: 0 }} suppressHydrationWarning>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
