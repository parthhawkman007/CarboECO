"use client";

import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, Eye } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div 
      className="flex items-center gap-1 bg-gray-100 dark:bg-brand-cardDark p-1 rounded-full border border-gray-200 dark:border-brand-borderDark"
      role="group"
      aria-label="Theme selector"
    >
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "light" 
            ? "bg-white text-brand-emerald shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="Switch to Light Theme"
        aria-pressed={theme === "light"}
      >
        <Sun className="h-4 w-4" />
      </button>

      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "dark" 
            ? "bg-brand-emerald text-white shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="Switch to Dark Theme"
        aria-pressed={theme === "dark"}
      >
        <Moon className="h-4 w-4" />
      </button>

      <button
        onClick={() => setTheme("high-contrast")}
        className={`p-1.5 rounded-full transition-all duration-200 ${
          theme === "high-contrast" 
            ? "bg-yellow-400 text-black shadow-sm" 
            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
        aria-label="Switch to High Contrast Theme"
        aria-pressed={theme === "high-contrast"}
      >
        <Eye className="h-4 w-4" />
      </button>
    </div>
  );
}
