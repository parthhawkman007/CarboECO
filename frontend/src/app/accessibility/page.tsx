"use client";

import Link from "next/link";
import { Eye, ArrowLeft } from "lucide-react";

export default function AccessibilityStatement() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-emerald hover:underline mb-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>
      
      <div className="glass-card rounded-3xl p-8 md:p-12 border border-white/20 dark:border-brand-borderDark/40">
        <div className="flex items-center gap-4 border-b border-gray-200 dark:border-brand-borderDark/50 pb-6 mb-6">
          <div className="h-12 w-12 bg-brand-emerald/10 text-brand-emerald rounded-2xl flex items-center justify-center border border-brand-emerald/20">
            <Eye className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white leading-none">
              Accessibility Statement
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-mono">Last updated: June 20, 2026</p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-400 space-y-6 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">1. Commitment to Accessibility</h2>
            <p>
              CarboECO is committed to providing a digital platform that is accessible to all individuals, including those with visual, motor, auditory, or cognitive disabilities. We actively design our user interfaces to align with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA criteria.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">2. Supported Standards & Features</h2>
            <p>
              Key structural and visual considerations implemented across our Next.js pages:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Semantic Structure</b>: Proper HTML5 landmarks (`&lt;main&gt;`, `&lt;header&gt;`, `&lt;footer&gt;`, `&lt;nav&gt;`) for screen readers.</li>
              <li><b>Keyboard Navigation</b>: Clear focus indicator borders, logical tab orders, and skip-to-main links on all layouts.</li>
              <li><b>Aria Live Regions</b>: Real-time telemetry widgets use `aria-live="polite"` to announce event log shifts.</li>
              <li><b>Vestibular Accommodation</b>: Standard support for `prefers-reduced-motion` to suppress high-framerate CSS or Framer Motion transitions.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">3. Continuous Improvement</h2>
            <p>
              We run automated accessibility regression testing gates in our CI/CD pipeline using Playwright and Axe-core tools. We are constantly auditing color contrasts, element labels, and chart descriptions to remove potential navigation barriers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
