import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GigForge — Gig Worker Infrastructure Platform',
  description: 'HR, insurance, and benefits infrastructure for India\'s gig economy.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
