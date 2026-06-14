import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { WebSocketProvider } from "@/components/WebSocketProvider";

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
  title: "CarboECO - Track Smarter. Live Greener. Reduce Your Carbon Footprint.",
  description: "CarboECO is an AI-powered Carbon Footprint Awareness Platform designed to help individuals understand, track, predict, and reduce their environmental impact.",
  keywords: ["Carbon Footprint", "Sustainability", "Eco Friendly", "AI Energy Coaching", "Climate Action", "Carbon Calculator"],
  authors: [{ name: "CarboECO Team" }],
  openGraph: {
    title: "CarboECO - AI Sustainability Platform",
    description: "Empowering individuals to measure, predict, and reduce carbon emissions with AI coaching and gamified habits.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} dark`}>
      <body className="flex min-h-screen flex-col font-sans bg-gray-50 text-gray-900 dark:bg-brand-darkBg dark:text-gray-100 transition-colors duration-300">
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
                <a href="#" className="hover:underline">Privacy Policy</a>
                <a href="#" className="hover:underline">Terms of Service</a>
                <a href="#" className="hover:underline">Accessibility Statement</a>
              </div>
            </div>
          </footer>
        </WebSocketProvider>
      </body>
    </html>
  );
}
