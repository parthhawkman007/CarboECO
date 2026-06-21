"use client";

import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
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
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white leading-none">
              Privacy Policy
            </h1>
            <p className="text-xs text-gray-400 mt-2 font-mono">Last updated: June 20, 2026</p>
          </div>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none text-sm text-gray-600 dark:text-gray-400 space-y-6 leading-relaxed">
          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">1. Information We Collect</h2>
            <p>
              We collect information to provide a better carbon-tracking experience. This includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Account Information</b>: Email addresses and hashed passwords when you register.</li>
              <li><b>Carbon Logs</b>: Logs containing categories like transport distance, energy consumed, food type, shopping bills, and digital usage.</li>
              <li><b>Profile Customizations</b>: Digital Twin states, avatars, regions, and streak goals.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">2. How We Use Information</h2>
            <p>
              Your data is processed strictly to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Calculate your daily carbon footprint and comparative target budgets.</li>
              <li>Train your personalized, localized Machine Learning models (using Gradient Boosting algorithms) to forecast 12-month emission trends.</li>
              <li>Power the Sustainability Coach chatbot to give context-aware home energy abating suggestions.</li>
              <li>Track achievements, badges, streaks, and global leaderboards.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">3. Data Integrity & Security</h2>
            <p>
              We prioritize data safety by using production-standard Bcrypt password hashing, rotated refresh tokens, and limiting login attempts to prevent brute-force attacks. We do not sell or lease your behavioral carbon logs to third-party advertising companies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-white">4. Your Rights</h2>
            <p>
              You maintain full ownership of your data. You may download, audit, or permanently delete your carbon log history from the Command Center at any time. Removing logs immediately invalidates matching ML models and recalculates your Digital Twin status.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
