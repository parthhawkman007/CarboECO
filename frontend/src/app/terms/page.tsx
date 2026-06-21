"use client";

import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
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
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white leading-none">
              Terms of Service
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-mono">Last updated: June 20, 2026</p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-400 space-y-6 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing the CarboECO platform, you agree to comply with and be bound by these Terms of Service. If you do not agree, you must not use or access the services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">2. Account Responsibility</h2>
            <p>
              When creating an account, you agree to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Keep passwords secret and secure.</li>
              <li>Provide accurate regional indicators (e.g. IN, US, EU) for correct grid intensity emission calculations.</li>
              <li>Refrain from using scripts to forge carbon logs or game the community leaderboard.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">3. Carbon Offsetting & Marketplace</h2>
            <p>
              CarboECO hosts a marketplace facilitating sandboxed investments into Gold Standard/VCS verified carbon offset projects. Purchase details, registry serial keys, and download certificates generated are simulated for educational/hackathon demonstration purposes and do not represent actual carbon offset claims or financial securities transactions.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">4. AI Coaching and Projections</h2>
            <p>
              Emissions predictions and coaching suggestions provided by the Sustainability Coach represent estimates calculated using current models. They are intended for educational and carbon awareness purposes and do not constitute official financial or utility advice.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
