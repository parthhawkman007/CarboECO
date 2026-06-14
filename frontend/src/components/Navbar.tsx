"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Menu, X, Award, Flame, User as UserIcon, ChevronDown } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const PRIMARY_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Calculator", href: "/calculator" },
  { label: "AI Coach", href: "/coach" },
  { label: "Twin & Garden", href: "/predictions" },
  { label: "Simulator", href: "/simulator" },
];

const MORE_ITEMS = [
  { label: "Streaks & Badges", href: "/gamification" },
  { label: "Community", href: "/community" },
  { label: "Education", href: "/education" },
  { label: "Offsets", href: "/marketplace" },
];

const NAV_ITEMS = [...PRIMARY_ITEMS, ...MORE_ITEMS];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Default User Mock values for navigation display
  const xp = 620;
  const level = 2;
  const streak = 3;

  const isMoreActive = MORE_ITEMS.some(item => pathname === item.href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md dark:border-brand-borderDark/50 dark:bg-brand-darkBg/80 transition-all duration-300">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Skip to main content link for screen readers */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-brand-emerald focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:rounded" aria-label="CarboECO Home">
          <div className="flex h-9 w-9 items-center justify-between rounded-lg bg-brand-emerald/10 p-2 dark:bg-brand-emerald/20">
            <Leaf className="h-5 w-5 text-brand-emerald" />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-brand-charcoal dark:text-white">
            Carbo<span className="text-brand-emerald">ECO</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-5" aria-label="Main Navigation">
          {PRIMARY_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-brand-emerald focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:rounded px-2 py-1 ${
                  isActive 
                    ? "text-brand-emerald font-semibold" 
                    : "text-gray-600 dark:text-gray-300"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          {/* More Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setMoreOpen(false);
              }
            }}
          >
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-brand-emerald focus-visible:ring-2 focus-visible:ring-brand-emerald focus-visible:rounded px-2 py-1 ${
                isMoreActive
                  ? "text-brand-emerald font-semibold"
                  : "text-gray-600 dark:text-gray-300"
              }`}
              aria-expanded={moreOpen}
              aria-haspopup="true"
            >
              <span>More</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
            </button>

            {moreOpen && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-xl border border-gray-200/50 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-brand-borderDark/50 dark:bg-brand-darkBg/95 animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                {MORE_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`block rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-brand-emerald/10 hover:text-brand-emerald ${
                        isActive 
                          ? "bg-brand-emerald/10 text-brand-emerald font-semibold" 
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* User Stats & Settings */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="flex items-center gap-3 bg-gray-100 dark:bg-brand-cardDark px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200/50 dark:border-brand-borderDark/50">
            <div className="flex items-center gap-1 text-orange-500" title="Daily Streak">
              <Flame className="h-4 w-4 fill-orange-500 animate-pulse" />
              <span>{streak}d</span>
            </div>
            <div className="w-[1px] h-3 bg-gray-300 dark:bg-brand-borderDark" />
            <div className="flex items-center gap-1 text-brand-emerald" title="Current Level & XP">
              <Award className="h-4 w-4" />
              <span>Lvl {level} ({xp} XP)</span>
            </div>
          </div>
          
          <ThemeToggle />

          <Link 
            href="/dashboard" 
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-emerald text-white hover:bg-brand-forest transition-all duration-200"
            aria-label="User Account Profile"
          >
            <UserIcon className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-white dark:bg-brand-darkBg px-6 py-4 flex flex-col justify-between overflow-y-auto border-t border-gray-100 dark:border-brand-borderDark animate-in fade-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col gap-4" aria-label="Mobile Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-lg font-medium py-2 border-b border-gray-100 dark:border-brand-borderDark/40 ${
                    isActive 
                      ? "text-brand-emerald font-bold" 
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          
          <div className="flex flex-col gap-4 border-t border-gray-100 dark:border-brand-borderDark pt-6">
            <div className="flex items-center justify-between bg-gray-100 dark:bg-brand-cardDark p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
                <span className="text-sm font-semibold">{streak} Day Streak</span>
              </div>
              <div className="flex items-center gap-2 text-brand-emerald">
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold">Lvl {level} ({xp} XP)</span>
              </div>
            </div>
            <Link 
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-emerald py-3 text-center font-semibold text-white hover:bg-brand-forest transition-colors"
            >
              <UserIcon className="h-5 w-5" />
              Go to Account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
