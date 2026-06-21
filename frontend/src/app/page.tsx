"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { 
  Leaf, Brain, BarChart3, Users, BookOpen, Compass, Zap, Flame, 
  ArrowRight, Sparkles, ShieldCheck, Heart, Landmark, Globe, CheckCircle2,
  TrendingDown, ShieldAlert, Cpu
} from "lucide-react";
import { cinematicVariants, cardVariants, easeTokens } from "@/utils/motion";
import { getApiUrl } from "@/utils/api";

const ThreeEarth = dynamic(() => import("@/components/ThreeEarth"), { ssr: false });

export default function Home() {
  const shouldReduceMotion = useReducedMotion();

  // Global Carbon stats state
  const [stats, setStats] = useState({
    total_co2: 14805492.4,
    active_citizens: 34182,
    trees_equivalent: 672976,
    energy_saved_kwh: 12140503.7,
    missions_logged: 118504
  });

  const [liveEvents, setLiveEvents] = useState<Array<{ id: number; user: string; action: string; co2: string }>>([]);
  const [tickerCo2, setTickerCo2] = useState(14805492.4);

  const [activeTab, setActiveTab] = useState<"copilot" | "metrics" | "simulator">("copilot");
  const [simKm, setSimKm] = useState(12000);
  const [simDiet, setSimDiet] = useState(3);

  // Sync ticker with fetched total CO2
  useEffect(() => {
    setTickerCo2(stats.total_co2);
  }, [stats.total_co2]);

  useEffect(() => {
    // 1. Fetch dynamic global statistics from backend
    const fetchGlobalStats = async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/carbon/global-summary`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            total_co2: data.total_co2,
            active_citizens: data.active_citizens,
            trees_equivalent: data.trees_equivalent,
            energy_saved_kwh: data.energy_saved_kwh,
            missions_logged: data.missions_logged
          });
          setLiveEvents(data.recent_events);
        }
      } catch (err) {
        console.error("Failed to fetch global carbon summary:", err);
      }
    };

    fetchGlobalStats();
    
    // Poll updates every 10 seconds
    const fetchInterval = setInterval(fetchGlobalStats, 10000);

    // Increment carbon counter in real-time smoothly
    const counterInterval = setInterval(() => {
      setTickerCo2((prev) => prev + 0.42);
    }, 1000);

    // 2. Register PWA service worker client-side
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
          .catch((err) => console.error("Service Worker registration failed:", err));
      });
    }

    return () => {
      clearInterval(fetchInterval);
      clearInterval(counterInterval);
    };
  }, []);

  const simulatedSavings = Math.round((simKm * 0.13) + (simDiet * 52 * 6.7));

  return (
    <div className="flex flex-col gap-24 py-6 relative overflow-hidden">
      
      {/* 1. Hero Earth Experience */}
      <section className="relative min-h-[85vh] flex items-center justify-center py-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 w-full max-w-6xl relative z-10">
          {/* Left Column: Headline */}
          <div className="flex-1 flex flex-col gap-6 items-start text-left">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-brand-emerald/30 bg-brand-emerald/10 px-4 py-1.5 text-xs font-semibold text-brand-emerald dark:bg-brand-emerald/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-emerald animate-pulse" />
              <span>Next-Gen Sustainability Operating System</span>
            </motion.div>

            <motion.h1
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, ease: easeTokens.apple }}
              className="font-heading text-4xl font-extrabold tracking-tight sm:text-6xl text-gray-900 dark:text-white leading-[1.1]"
            >
              Understand Your Impact. <br />
              <span className="bg-gradient-to-r from-brand-emerald via-brand-emerald to-brand-sky bg-clip-text text-transparent">
                Shape A Greener Future.
              </span>
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1, ease: easeTokens.apple }}
              className="text-base text-gray-600 dark:text-gray-400 max-w-lg leading-relaxed"
            >
              AI-powered carbon tracking, multi-variate ML forecasting, and interactive coaching. CarboECO is the ultimate mission control dashboard for your environmental impact.
            </motion.p>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: easeTokens.apple }}
              className="flex flex-wrap gap-4 mt-2"
            >
              <Link
                href="/auth"
                className="rounded-xl bg-brand-emerald px-6 py-3 font-semibold text-white hover:bg-brand-forest shadow-lg shadow-brand-emerald/25 transition-all hover:scale-[1.03] duration-200"
              >
                Access Command Center
              </Link>
              <Link
                href="/calculator"
                className="rounded-xl border border-gray-300 dark:border-brand-borderDark bg-white/40 dark:bg-brand-cardDark/50 px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-brand-cardDark transition-colors"
              >
                Try Quick Calculator
              </Link>
            </motion.div>
          </div>

          {/* Right Column: 3D Earth Globe Canvas */}
          <div className="flex-1 w-full max-w-md relative flex items-center justify-center">
            <ThreeEarth />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SIGNATURE FEATURE #4: GLOBAL IMPACT WALL
          ═══════════════════════════════════════ */}
      <section className="w-full max-w-5xl mx-auto flex flex-col gap-6">
        <div className="text-center">
          <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest block mb-1">
            Global Impact Wall
          </span>
          <h2 className="font-heading text-2xl font-bold">A Live Movement Driving Real Carbon Abatement</h2>
        </div>

        {/* Global Impact Wall Dashboard Panel */}
        <div className="glass-card rounded-3xl p-8 border border-white/20 dark:border-brand-borderDark/40 grid gap-6 sm:grid-cols-2 md:grid-cols-5 text-center shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-brand-emerald/5 to-transparent pointer-events-none -z-10" />

          {/* Total CO2 Reduced */}
          <div className="flex flex-col gap-1.5 items-center justify-center p-3">
            <TrendingDown className="h-6 w-6 text-brand-emerald animate-bounce" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Total CO₂ Reduced</span>
            <span className="text-2xl font-black text-brand-emerald font-mono leading-none mt-1">
              {tickerCo2.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
            </span>
          </div>

          {/* Total Users */}
          <div className="flex flex-col gap-1.5 items-center justify-center border-l border-gray-100 dark:border-brand-borderDark/30 p-3">
            <Globe className="h-6 w-6 text-brand-sky animate-spin-slow" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Active Citizens</span>
            <span className="text-2xl font-black text-white font-mono leading-none mt-1">
              {stats.active_citizens.toLocaleString()}
            </span>
          </div>

          {/* Trees Equivalent */}
          <div className="flex flex-col gap-1.5 items-center justify-center border-l border-gray-100 dark:border-brand-borderDark/30 p-3">
            <Leaf className="h-6 w-6 text-brand-sky" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Trees Equivalent</span>
            <span className="text-2xl font-black text-brand-sky font-mono leading-none mt-1">
              {stats.trees_equivalent.toLocaleString()} trees
            </span>
          </div>

          {/* Energy Saved */}
          <div className="flex flex-col gap-1.5 items-center justify-center border-l border-gray-100 dark:border-brand-borderDark/30 p-3">
            <Zap className="h-6 w-6 text-yellow-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Energy Saved</span>
            <span className="text-2xl font-black text-yellow-500 font-mono leading-none mt-1">
              {stats.energy_saved_kwh.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
            </span>
          </div>

          {/* Challenges Completed */}
          <div className="flex flex-col gap-1.5 items-center justify-center border-l border-gray-100 dark:border-brand-borderDark/30 p-3">
            <CheckCircle2 className="h-6 w-6 text-brand-emerald" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Missions Logged</span>
            <span className="text-2xl font-black text-white font-mono leading-none mt-1">
              {stats.missions_logged.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Live scrolling Event stream tape */}
        <div 
          aria-live="polite" 
          className="w-full bg-brand-darkBg/60 border border-brand-borderDark/30 rounded-2xl p-4 overflow-hidden relative"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 px-3 py-1 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald rounded-lg text-[9px] font-bold uppercase tracking-wider">
            <Cpu className="h-3 w-3 animate-pulse" />
            <span>Eco Telemetry Stream</span>
          </div>

          <div className="flex items-center justify-end overflow-hidden pl-36 h-6">
            <div className="flex gap-10 animate-marquee whitespace-nowrap text-xs text-gray-400 font-semibold">
              <AnimatePresence mode="popLayout">
                {liveEvents.map((evt) => (
                  <motion.span 
                    key={evt.id} 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className="text-white font-bold">{evt.user}</span>
                    <span>{evt.action}</span>
                    <span className="text-brand-emerald font-bold">(-{evt.co2} CO₂e)</span>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Feature Showcase Selector Tabs (Stripe/Notion style) */}
      <section className="flex flex-col gap-10 w-full max-w-5xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold">Intelligent Platform Capabilities</h2>
          <p className="text-sm text-gray-400 mt-2">Explore the tools driving localized emissions reduction</p>
        </div>

        {/* Tab selection */}
        <div className="flex justify-center border-b border-gray-100 dark:border-brand-borderDark/40 max-w-md mx-auto">
          {(["copilot", "metrics", "simulator"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-6 font-bold text-xs uppercase tracking-wider transition-all border-b-2 capitalize ${
                activeTab === tab 
                  ? "border-brand-emerald text-brand-emerald"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "copilot" ? "AI Copilot" : tab === "metrics" ? "Command Metrics" : "Impact Simulator"}
            </button>
          ))}
        </div>

        {/* Dynamic tab contents */}
        <div className="min-h-[350px]">
          {activeTab === "copilot" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col gap-5 text-left">
                <div className="h-10 w-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20"><Brain /></div>
                <h3 className="text-2xl font-bold font-heading">ChatGPT + Apple Intelligence Copilot</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Our custom Copilot uses Context Memory. Ask questions about offsetting, obtain tailored home utility roadmaps, and forecast the carbon impact of daily habits instantly.
                </p>
                <div className="flex flex-col gap-2.5 text-xs text-gray-400">
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-emerald" /> Strict context memory retention</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-emerald" /> Micro roadmap action node generation</span>
                </div>
              </div>
              <div className="glass-card rounded-3xl p-6 border border-white/10 flex flex-col gap-4 text-left">
                <div className="flex items-center gap-2 border-b border-brand-borderDark/40 pb-3">
                  <div className="h-3 w-3 rounded-full bg-brand-emerald" />
                  <span className="text-[10px] font-mono text-gray-400">sustainability_copilot_v2</span>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-brand-cardDark/50 rounded-xl text-[11px] max-w-[85%] self-end">
                    How can I reduce my transportation emissions in Denver?
                  </div>
                  <div className="p-3 bg-brand-emerald/10 border border-brand-emerald/20 rounded-xl text-[11px] max-w-[85%] self-start flex gap-2">
                    <Sparkles className="h-4 w-4 text-brand-emerald flex-shrink-0 mt-0.5" />
                    <p>Swapping the weekly 50km petrol drive for the local electric rail reduces your yearly emissions by 340kg CO2e, planting 15 trees equivalent.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "metrics" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8 items-center">
              <div className="glass-card rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold">Comparative Carbon Budget</span>
                  <span className="text-brand-emerald font-black">Score: 4.8 / 15.0 limit</span>
                </div>
                <div className="w-full bg-brand-cardDark rounded-full h-3 overflow-hidden border border-brand-borderDark">
                  <div className="bg-brand-emerald h-full rounded-full" style={{ width: "32%" }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { c: "transportation", v: "8.1 kg" },
                    { c: "energy", v: "5.0 kg" },
                    { c: "food", v: "13.5 kg" }
                  ].map(x => (
                    <div key={x.c} className="p-3 bg-brand-cardDark/40 border border-brand-borderDark/30 rounded-xl text-center">
                      <span className="text-[8px] uppercase text-gray-400 block font-bold">{x.c}</span>
                      <span className="text-xs font-black mt-1 block">{x.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-5 text-left">
                <div className="h-10 w-10 bg-brand-emerald/10 text-brand-emerald rounded-xl flex items-center justify-center border border-brand-emerald/20"><BarChart3 /></div>
                <h3 className="text-2xl font-bold font-heading">Mission Control Console</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Analyze Carbon summaries. Display category breakdowns (Transportation, Utilities, Shopping) and calculate daily score bounds compared to target thresholds.
                </p>
                <div className="flex gap-4 text-xs font-bold mt-2">
                  <Link href="/dashboard" className="text-brand-emerald hover:underline">Launch Command Center →</Link>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "simulator" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col gap-5 text-left">
                <div className="h-10 w-10 bg-brand-sky/10 text-brand-sky rounded-xl flex items-center justify-center border border-brand-sky/20"><Compass /></div>
                <h3 className="text-2xl font-bold font-heading">Interactive Impact Simulator</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Use the sliders to adjust your transportation habits and meat consumption. View exactly how much carbon you would save on a yearly basis.
                </p>
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex flex-col gap-1 text-xs">
                    <label htmlFor="sim-km-slider" className="text-gray-400 font-bold">Annual Car Travel: {simKm.toLocaleString()} km</label>
                    <input
                      id="sim-km-slider"
                      type="range"
                      min="1000"
                      max="30000"
                      step="1000"
                      value={simKm}
                      onChange={(e) => setSimKm(parseInt(e.target.value))}
                      className="w-full h-1 bg-brand-borderDark rounded appearance-none cursor-pointer accent-brand-emerald"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <label htmlFor="sim-meat-slider" className="text-gray-400 font-bold">Meatless Days / Week: {simDiet} days</label>
                    <input
                      id="sim-meat-slider"
                      type="range"
                      min="0"
                      max="7"
                      step="1"
                      value={simDiet}
                      onChange={(e) => setSimDiet(parseInt(e.target.value))}
                      className="w-full h-1 bg-brand-borderDark rounded appearance-none cursor-pointer accent-brand-emerald"
                    />
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-3xl p-8 border border-brand-emerald/30 bg-brand-emerald/5 flex flex-col gap-4">
                <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-wider block">Simulated Annual Savings</span>
                <h3 className="text-4xl font-extrabold text-brand-emerald">-{simulatedSavings.toLocaleString()} <span className="text-xs font-normal text-gray-400">kg CO2e</span></h3>
                <div className="p-3 bg-brand-cardDark/50 border border-brand-borderDark/40 rounded-2xl text-[10px] text-gray-400 flex items-center justify-center gap-1">
                  <span>Equates to planting <b>{Math.round(simulatedSavings / 22)}</b> new trees absorption!</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* 4. AI Sustainability Future Projection Timeline */}
      <section className="flex flex-col gap-8 w-full max-w-5xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold">AI Sustainability Pathway Projections</h2>
          <p className="text-sm text-gray-400 mt-2">Simulate long-term sustainability alignment on target paths</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4 relative mt-4">
          <div className="hidden md:block absolute top-[50%] left-[10%] right-[10%] h-[1px] bg-brand-borderDark -z-10" />
          {[
            { step: "Today", text: "15.0 kg baseline", desc: "Current daily average carbon log intake" },
            { step: "1 Month", text: "12.8 kg trajectory", desc: "Carbon reduction utilizing green smart-roadmaps" },
            { step: "1 Year", text: "9.2 kg average", desc: "Swapping grid energy for home solar integration" },
            { step: "2030 Goal", text: "2.0 kg net target", desc: "Complete eco carbon neutrality goal achieved" }
          ].map((item, idx) => (
            <div key={item.step} className="glass-card rounded-2xl p-5 border border-white/10 text-left flex flex-col gap-2 relative">
              <span className="text-[10px] font-bold text-brand-emerald uppercase">{item.step}</span>
              <span className="text-sm font-black mt-1">{item.text}</span>
              <span className="text-[10px] text-gray-400 mt-1 leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Community Impact Wall & Testimonials */}
      <section className="flex flex-col gap-10 w-full max-w-5xl mx-auto">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold">Climate Impact Wall</h2>
          <p className="text-sm text-gray-400 mt-2">Read testimonials from community climate guardians</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            { user: "Sarah L.", role: "Zero Waste Organizer", text: "CarboECO completely changed how our neighborhood tracks waste. The gamified challenges keep everyone active!", rank: "Climate Guardian" },
            { user: "Marcus V.", role: "EV Commuter", text: "The GIS transit simulator proved exactly how much CO2 I save taking the train. Plus, the dynamic garden twin is beautiful.", rank: "Carbon Warrior" },
            { user: "Elena P.", role: "Climate Blogger", text: "The AI sustainability roadmap broke down complex carbon goals into small micro actions. Essential platform!", rank: "Planet Protector" }
          ].map((t, idx) => (
            <div key={t.user} className="glass-card rounded-2xl p-6 border border-white/10 text-left flex flex-col justify-between gap-6">
              <p className="text-xs text-gray-400 italic leading-relaxed">"{t.text}"</p>
              <div className="flex justify-between items-center border-t border-brand-borderDark/40 pt-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold">{t.user}</span>
                  <span className="text-[9px] text-gray-400">{t.role}</span>
                </div>
                <span className="text-[8px] uppercase font-bold text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/20 px-2 py-0.5 rounded">
                  {t.rank}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Product Launch Signoff CTA */}
      <section className="glass-card rounded-3xl p-10 lg:p-16 border border-brand-emerald/30 bg-brand-emerald/5 text-center relative overflow-hidden flex flex-col items-center gap-6">
        <div className="absolute inset-0 bg-radial-gradient from-brand-emerald/5 to-transparent pointer-events-none -z-10" />
        <Leaf className="h-12 w-12 text-brand-emerald animate-bounce" />
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl max-w-2xl leading-tight">
          Ready to Surpass Your Sustainability Goals?
        </h2>
        <p className="text-sm text-gray-400 max-w-md leading-relaxed">
          Create a free account, secure your MFA configuration, and begin tracking with our AI Sustain Copilot.
        </p>
        <Link
          href="/auth"
          className="px-8 py-3.5 bg-brand-emerald hover:bg-brand-forest text-white font-bold rounded-xl shadow-lg shadow-brand-emerald/25 transition-transform hover:scale-[1.03]"
        >
          Access Platform Console
        </Link>
      </section>
    </div>
  );
}
