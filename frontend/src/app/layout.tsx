import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { WebSocketProvider } from "@/components/WebSocketProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import Link from "next/link";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'CarboECO — AI-Powered Carbon Footprint Awareness Platform',
  description: 'Track, predict, and reduce your carbon footprint with AI-powered insights, gamification, and real carbon offset marketplace.',
  keywords: ['carbon footprint', 'sustainability', 'climate action', 'SDG 13', 'CO2 tracker', 'green living', 'AI sustainability'],
  authors: [{ name: "CarboECO Team" }],
  manifest: "/manifest.json",
  openGraph: {
    title: 'CarboECO — Track. Reduce. Live Greener.',
    description: 'AI-powered carbon footprint tracking with personalized coaching, gamification, and real carbon offsets.',
    type: 'website',
    locale: 'en_US',
    siteName: 'CarboECO',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CarboECO - Carbon Footprint Awareness Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CarboECO — AI-Powered Carbon Footprint Platform',
    description: 'Track, reduce, and offset your carbon footprint with AI coaching and real impact.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  themeColor: '#10B981',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const savedTheme = localStorage.getItem('theme') || 'dark';
              document.documentElement.classList.remove('dark', 'high-contrast');
              if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
              } else if (savedTheme === 'high-contrast') {
                document.documentElement.classList.add('high-contrast');
              }
            } catch (_) {}
          `
        }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans bg-gray-50 text-gray-900 dark:bg-brand-darkBg dark:text-gray-100 transition-colors duration-300">
        {/* Skip to main content link for keyboard/screen-reader navigation */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-emerald-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <WebSocketProvider>
            {/* Ambient background grid mesh */}
            <div className="grid-mesh" />
            
            <Navbar />
            
            {/* Main Content Area */}
            <main id="main-content" tabIndex={-1} className="flex-1 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 focus:outline-none">
              {children}
            </main>
            
            {/* Footer */}
            <footer className="border-t border-gray-200/50 bg-white/40 dark:border-brand-borderDark/50 dark:bg-brand-darkBg/40 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="font-heading font-semibold text-gray-700 dark:text-gray-300">CarboECO © 2026. Live Greener.</span>
                <div className="flex gap-4">
                  <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                  <Link href="/terms" className="hover:underline">Terms of Service</Link>
                  <Link href="/accessibility" className="hover:underline">Accessibility Statement</Link>
                </div>
              </div>
            </footer>
          </WebSocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
