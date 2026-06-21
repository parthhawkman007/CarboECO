"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to telemetry
    console.error("Next.js Client Crash:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="glass-card rounded-3xl p-8 max-w-lg border border-red-500/20 bg-white/50 dark:bg-brand-cardDark/40 shadow-2xl relative overflow-hidden flex flex-col items-center gap-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
        
        <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center border border-red-500/20 animate-pulse">
          <AlertTriangle className="h-8 w-8" />
        </div>

        <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white leading-tight">
          Application Error
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          We apologize, but something went wrong while rendering this section. A diagnostics log has been sent to our telemetry team.
        </p>

        {error.digest && (
          <div className="w-full bg-gray-100 dark:bg-brand-darkBg/60 border border-gray-200 dark:border-brand-borderDark/50 rounded-xl p-3 text-left">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Error ID</span>
            <code className="text-xs text-red-400 font-mono break-all mt-1 block">{error.digest}</code>
          </div>
        )}

        <div className="flex flex-wrap gap-4 w-full justify-center mt-2">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-xl bg-brand-emerald px-6 py-3 font-semibold text-white hover:bg-brand-forest shadow-lg shadow-brand-emerald/25 transition-transform hover:scale-[1.03] active:scale-[0.97]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-brand-borderDark bg-white/40 dark:bg-brand-cardDark/50 px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-brand-cardDark transition-colors"
          >
            <Home className="h-4 w-4" />
            <span>Go Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
