"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEcoStore } from "@/store/useEcoStore";
import { 
  Zap, Flame, Trash2, Laptop, ShoppingBag, Navigation, Activity, 
  Sparkles, Award, Target, Brain, ShieldAlert, CheckCircle2 
} from "lucide-react";
import { cardVariants, listContainerVariants, easeTokens } from "@/utils/motion";
import { motion } from "framer-motion";

// Dynamically import Recharts to optimize FCP
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer as any), { ssr: false }) as any;
const AreaChart = dynamic(() => import("recharts").then(m => m.AreaChart as any), { ssr: false }) as any;
const Area = dynamic(() => import("recharts").then(m => m.Area as any), { ssr: false }) as any;
const XAxis = dynamic(() => import("recharts").then(m => m.XAxis as any), { ssr: false }) as any;
const YAxis = dynamic(() => import("recharts").then(m => m.YAxis as any), { ssr: false }) as any;
const CartesianGrid = dynamic(() => import("recharts").then(m => m.CartesianGrid as any), { ssr: false }) as any;
const Tooltip = dynamic(() => import("recharts").then(m => m.Tooltip as any), { ssr: false }) as any;
const Legend = dynamic(() => import("recharts").then(m => m.Legend as any), { ssr: false }) as any;
const RadarChart = dynamic(() => import("recharts").then(m => m.RadarChart as any), { ssr: false }) as any;
const Radar = dynamic(() => import("recharts").then(m => m.Radar as any), { ssr: false }) as any;
const PolarGrid = dynamic(() => import("recharts").then(m => m.PolarGrid as any), { ssr: false }) as any;
const PolarAngleAxis = dynamic(() => import("recharts").then(m => m.PolarAngleAxis as any), { ssr: false }) as any;

const CATEGORY_ICONS: Record<string, any> = {
  transportation: Navigation,
  energy: Zap,
  food: Flame,
  waste: Trash2,
  shopping: ShoppingBag,
  digital: Laptop
};

const CATEGORY_COLORS: Record<string, string> = {
  transportation: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  energy: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  food: "text-brand-emerald bg-brand-emerald/10 border-brand-emerald/20",
  waste: "text-red-500 bg-red-500/10 border-red-500/20",
  shopping: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  digital: "text-brand-sky bg-brand-sky/10 border-brand-sky/20"
};

export default function Dashboard() {
  const profile = useEcoStore((state) => state.profile);
  const logs = useEcoStore((state) => state.logs);
  const avatarRank = useEcoStore((state) => state.avatarRank);

  // Reactive calculations
  const totalCo2 = logs.reduce((sum, item) => sum + item.co2_equivalent, 0);
  const dailyAverage = logs.length > 0 ? totalCo2 / 4 : 0.0; // Simulated across 4 logged days
  const budgetPercentage = Math.min(100, Math.round((dailyAverage / profile.carbon_budget) * 100));

  // Category breakdown for Radar Chart
  const categories = ["transportation", "energy", "food", "waste", "shopping", "digital"];
  const radarData = categories.map((cat) => {
    const sum = logs.filter((log) => log.category === cat).reduce((s, l) => s + l.co2_equivalent, 0);
    return {
      subject: cat.charAt(0).toUpperCase() + cat.slice(1),
      A: sum || 0,
      fullMark: 30
    };
  });

  // Projection Trajectory: Business As Usual (BAU) vs. Green Path vs. Current
  const trajectoryData = [
    { name: "Day 1", Current: 15.0, Target: 15.0, BAU: 15.0 },
    { name: "Day 2", Current: 13.8, Target: 13.5, BAU: 15.2 },
    { name: "Day 3", Current: 11.2, Target: 12.0, BAU: 15.4 },
    { name: "Day 4", Current: dailyAverage, Target: 10.5, BAU: 15.6 },
    { name: "Day 5", Current: null, Target: 9.2, BAU: 15.8 },
    { name: "Day 6", Current: null, Target: 8.0, BAU: 16.0 }
  ];

  // AI Feed suggestions
  const aiActions = [
    { id: 1, title: "Transit Switch Priority", desc: "Swap your combustion drive with the electric metro commute. Saves 5.2kg CO2e.", score: "+50 XP" },
    { id: 2, title: "Vegetarian Diet Option", desc: "Log plant-based dinners instead of beef. Saves 3.5kg CO2e.", score: "+30 XP" },
    { id: 3, title: "Utility Standby Optimization", desc: "Disable power standbys on electric appliances. Saves 1.2kg CO2e.", score: "+25 XP" }
  ];

  return (
    <div className="flex flex-col gap-8 py-6 max-w-7xl mx-auto relative">
      
      {/* Dashboard Mission Control Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-brand-borderDark/30 pb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-7 w-7 text-brand-emerald animate-pulse" />
            <span>Mission Control Console</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time telemetry and target goal analysis</p>
        </div>
        <div className="flex items-center gap-3 bg-brand-emerald/10 border border-brand-emerald/20 px-4 py-2 rounded-2xl">
          <Award className="h-5 w-5 text-brand-emerald" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Carbon Rank</span>
            <span className="text-xs font-black text-white">{avatarRank} (Lvl {profile.level})</span>
          </div>
        </div>
      </div>

      {/* Grid: 3-Columns Layout */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* Left Column: Command Center ring & metrics */}
        <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-6">
          <div>
            <h3 className="text-lg font-bold">Carbon Command Center</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Budget allowance tracking</p>
          </div>

          {/* Budget ring visual */}
          <div 
            className="relative h-44 w-44 mx-auto flex items-center justify-center"
            role="progressbar"
            aria-valuenow={budgetPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily carbon budget utilization progress"
          >
            {/* SVG Progress Circle */}
            <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="8" fill="transparent" />
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                stroke="#10b981" 
                strokeWidth="8" 
                fill="transparent" 
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * budgetPercentage) / 100}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-[9px] uppercase text-gray-400 font-bold">Daily Avg</span>
              <span className="text-3xl font-black font-mono">{dailyAverage.toFixed(1)}</span>
              <span className="text-[10px] text-gray-400">/ {profile.carbon_budget} kg</span>
            </div>
          </div>

          <div className="p-4 bg-brand-cardDark/50 border border-brand-borderDark/40 rounded-2xl text-center text-xs flex justify-between items-center">
            <span className="text-gray-400">Daily budget usage</span>
            <span className={`font-black ${budgetPercentage > 85 ? "text-red-500" : "text-brand-emerald"}`}>{budgetPercentage}%</span>
          </div>

          {/* Mini digital twin fallback rotating outline */}
          <div className="flex items-center gap-3 p-3.5 bg-gray-50/50 dark:bg-brand-cardDark/30 border border-gray-100 dark:border-brand-borderDark/20 rounded-2xl">
            <svg className="h-10 w-10 text-brand-sky animate-spin-slow flex-shrink-0" viewBox="0 0 40 40" stroke="currentColor" strokeWidth="1.5" fill="none">
              <circle cx="20" cy="20" r="16" strokeDasharray="3 3" />
              <path d="M20 4 V36 M4 20 H36" opacity="0.3" />
            </svg>
            <div className="text-left">
              <span className="text-[10px] font-bold text-brand-sky uppercase block">Twin Earth Synced</span>
              <span className="text-[9px] text-gray-400">Status: Stable (Energy score 65)</span>
            </div>
          </div>
        </div>

        {/* Center Column: Radar Comparison & Projections */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            
            {/* Sustainability Radar */}
            <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-bold">Sustainability Radar</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Emissions distribution across sectors</p>
              </div>

              <div 
                className="h-56 w-full relative"
                role="img"
                aria-label="Sustainability Radar Chart showing emissions distribution across carbon categories"
              >
                <div className="sr-only">
                  <p>Emissions distribution by sector:</p>
                  <ul>
                    {radarData.map((d) => (
                      <li key={d.subject}>{d.subject}: {d.A} kg CO2e</li>
                    ))}
                  </ul>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" radius="70%" data={radarData}>
                    <PolarGrid stroke="#26354a" />
                    <PolarAngleAxis dataKey="subject" stroke="#888888" fontSize={9} />
                    <Radar name="Carbon Sector" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Action Feed */}
            <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
              <div>
                <h3 className="text-base font-bold">AI Active Copilot Feed</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Pending recommendations to optimize goals</p>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto max-h-[220px] pr-1">
                {aiActions.map((action) => (
                  <div key={action.id} className="p-3 bg-brand-cardDark/40 border border-brand-borderDark/30 rounded-xl text-left flex justify-between items-start gap-4">
                    <div className="flex gap-2.5 items-start">
                      <Brain className="h-4.5 w-4.5 text-brand-emerald mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-gray-800 dark:text-white block">{action.title}</span>
                        <span className="text-[10px] text-gray-400 mt-1 block leading-relaxed">{action.desc}</span>
                      </div>
                    </div>
                    <span className="text-[8px] uppercase font-bold text-brand-emerald bg-brand-emerald/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      {action.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Goal Trajectory Projections */}
          <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold">Goal Trajectory Projections</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Current performance compared to green targets and Business-As-Usual (BAU)</p>
            </div>

            <div 
              className="h-56 w-full"
              role="img"
              aria-label="Goal Trajectory Projections Chart showing current performance against target Green Path and Business-As-Usual projections"
            >
              <div className="sr-only">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Timeline</th>
                      <th scope="col">Current (kg)</th>
                      <th scope="col">Green Path Target (kg)</th>
                      <th scope="col">BAU No Action (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trajectoryData.map((d) => (
                      <tr key={d.name}>
                        <td>{d.name}</td>
                        <td>{d.Current !== null && d.Current !== undefined ? `${d.Current} kg` : "N/A"}</td>
                        <td>{d.Target} kg</td>
                        <td>{d.BAU} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBAU" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={9} />
                  <YAxis stroke="#888888" fontSize={9} unit="kg" />
                  <Tooltip contentStyle={{ backgroundColor: "#0b0f19", border: "none", borderRadius: "12px", fontSize: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Area type="monotone" dataKey="Current" stroke="#0ea5e9" strokeWidth={2} fill="transparent" name="Current Score" />
                  <Area type="monotone" dataKey="Target" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTarget)" name="Green Path" />
                  <Area type="monotone" dataKey="BAU" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorBAU)" name="BAU (No Action)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

      {/* Activity Logs History & Leaf map indicator */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recents list */}
        <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold">Telemetry Logs History</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Your recorded carbon log activities</p>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[280px] pr-1">
            {logs.map((log) => {
              const Icon = CATEGORY_ICONS[log.category] || Activity;
              const colorClass = CATEGORY_COLORS[log.category] || "text-gray-500 bg-gray-500/10";
              return (
                <div key={log.id} className="p-3 bg-brand-cardDark/20 border border-brand-borderDark/20 rounded-2xl flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <span className="text-xs font-bold capitalize block">{log.subcategory.replace("_", " ")}</span>
                      <span className="text-[9px] text-gray-400 block">{log.date} • {log.value} {log.unit}</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-brand-emerald">
                    +{log.co2_equivalent.toFixed(1)} kg
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaf offset map representation */}
        <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col justify-between gap-6">
          <div className="text-left">
            <h3 className="text-base font-bold">Geographic Offset Radar</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Locational view of verified forestry offsetting project deployments</p>
          </div>

          <div className="h-44 w-full border border-brand-borderDark/40 rounded-2xl bg-brand-cardDark/30 relative overflow-hidden flex items-center justify-center">
            {/* Visual Vector Grid Mapping representing global coordinates */}
            <svg className="absolute inset-0 h-full w-full text-brand-emerald/10" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
              <path d="M0 20 H100 M0 40 H100 M0 60 H100 M0 80 H100 M20 0 V100 M40 0 V100 M60 0 V100 M80 0 V100" />
              <circle cx="35" cy="45" r="4" fill="#0ea5e9" className="animate-ping" />
              <circle cx="35" cy="45" r="2.5" fill="#0ea5e9" />
              <circle cx="75" cy="30" r="4" fill="#10b981" className="animate-pulse" />
              <circle cx="75" cy="30" r="2.5" fill="#10b981" />
            </svg>
            <span className="absolute bottom-3 left-3 text-[8px] font-mono uppercase tracking-wider text-gray-400">Verifications: Amazon & Rajasthan</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Total Offset Portfolio</span>
            <span className="font-extrabold text-brand-sky">5,000 kg offsetted</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}
