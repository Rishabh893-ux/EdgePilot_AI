import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/Sidebar'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['300','400','500','600','700','800','900'],
  preload: true,
})

export const metadata: Metadata = {
  title: 'EdgePilot AI — Mission Control',
  description: 'Autonomous Heavy Machine Intelligence Platform by Rishabh Kasaudhan',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EdgePilot AI',
  },
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#00d4ff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00d4ff" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        {/* Performance: preconnect to backend API */}

      </head>
      <body>
        <div className="ep-layout">
          <Sidebar />
          <main className="ep-main ep-page-enter">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
