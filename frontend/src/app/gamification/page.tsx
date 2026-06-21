"use client";
import { getApiUrl, getAuthHeaders } from "@/utils/api";


import { useState, useEffect } from "react";
import { Award, Flame, Trophy, Sparkles, ShieldCheck, Heart, Star, ChevronRight, Lock, Share2 } from "lucide-react";
import { Achievement, LeaderboardResponse } from "@/types";
import { useEcoStore } from "@/store/useEcoStore";
import { motion, AnimatePresence } from "framer-motion";

const FALLBACK_ACHIEVEMENTS: Achievement[] = [
  { name: "First Steps", description: "Log your first carbon footprint activity.", xp_reward: 100, badge_code: "first_log", icon: "🌱", unlocked: true },
  { name: "Transit Champion", description: "Log 5 public transit journeys.", xp_reward: 150, badge_code: "transit_master", icon: "🚇", unlocked: true },
  { name: "Herbivore Hero", description: "Log 5 plant-based or vegan meals.", xp_reward: 150, badge_code: "green_eater", icon: "🥗", unlocked: false },
  { name: "Circular Warrior", description: "Log 5 recycling or composting activities.", xp_reward: 150, badge_code: "zero_waste", icon: "♻️", unlocked: false },
  { name: "Consistent Green", description: "Maintain a 3-day active logging streak.", xp_reward: 200, badge_code: "streak_3", icon: "🔥", unlocked: true },
  { name: "Eco Habitual", description: "Maintain a 7-day active logging streak.", xp_reward: 350, badge_code: "streak_7", icon: "👑", unlocked: false }
];

const FALLBACK_LEADERBOARD: LeaderboardResponse = {
  leaderboard: [
    { rank: 1, user_id: 10, full_name: "EcoAlice", xp: 1820, level: 4, streak_count: 12, avatar: "avatar_2.png" },
    { rank: 2, user_id: 11, full_name: "GreenBob", xp: 1250, level: 3, streak_count: 7, avatar: "avatar_3.png" },
    { rank: 3, user_id: 1, full_name: "You", xp: 620, level: 2, streak_count: 3, avatar: "default_avatar.png" },
    { rank: 4, user_id: 13, full_name: "SustainCharlie", xp: 610, level: 2, streak_count: 3, avatar: "avatar_2.png" }
  ],
  user_rank: 3
};

// Avatar Progression Systems Ranks
const AVATAR_RANKS = [
  { 
    id: "rookie", 
    name: "Eco Rookie", 
    levelRequired: 1, 
    color: "#B45309", 
    theme: "from-amber-700/20 to-amber-900/10 border-amber-600/30 text-amber-500",
    glow: "rgba(180, 83, 9, 0.15)",
    perk: "Access carbon calculator & local logging streams.",
    desc: "Beginning your sustainability exploration. Take first steps."
  },
  { 
    id: "explorer", 
    name: "Green Explorer", 
    levelRequired: 2, 
    color: "#94A3B8", 
    theme: "from-slate-400/20 to-slate-600/10 border-slate-400/30 text-slate-300",
    glow: "rgba(148, 163, 184, 0.15)",
    perk: "Access to multi-step AI roadmaps and comparative goals.",
    desc: "Actively monitoring footprint sectors and logging consistent actions."
  },
  { 
    id: "warrior", 
    name: "Carbon Warrior", 
    levelRequired: 3, 
    color: "#10B981", 
    theme: "from-emerald-500/20 to-emerald-700/10 border-emerald-500/30 text-emerald-400",
    glow: "rgba(16, 185, 129, 0.2)",
    perk: "Unlock full GIS Geo-commute routing simulation filters.",
    desc: "Combating high carbon sectors. Swapping to energy efficient options."
  },
  { 
    id: "guardian", 
    name: "Climate Guardian", 
    levelRequired: 4, 
    color: "#0EA5E9", 
    theme: "from-sky-500/20 to-sky-700/10 border-sky-500/30 text-sky-400",
    glow: "rgba(14, 165, 233, 0.25)",
    perk: "Unlock verified offset certificates in global marketplace.",
    desc: "Shielding local communities. Organizing regional zero waste groups."
  },
  { 
    id: "protector", 
    name: "Planet Protector", 
    levelRequired: 5, 
    color: "#8B5CF6", 
    theme: "from-violet-500/20 to-violet-700/10 border-violet-500/30 text-violet-400",
    glow: "rgba(139, 92, 246, 0.3)",
    perk: "Priority AI Copilot responses with custom contextual memory.",
    desc: "Neutralizing annual emissions to net-zero bounds."
  },
  { 
    id: "titan", 
    name: "Earth Titan", 
    levelRequired: 6, 
    color: "#F59E0B", 
    theme: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 text-yellow-400",
    glow: "rgba(245, 158, 11, 0.35)",
    perk: "Co-host regional milestones and customize digital twin parameters.",
    desc: "Complete carbon neutrality achieved. Leadership status in global movement."
  }
];

export default function Gamification() {
  const profile = useEcoStore((state) => state.profile);
  const [achievements, setAchievements] = useState<Achievement[]>(FALLBACK_ACHIEVEMENTS);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>(FALLBACK_LEADERBOARD);
  const [loading, setLoading] = useState(true);

  // Selector for previewing the Carbon Avatar ranks
  const [previewRankId, setPreviewRankId] = useState("rookie");

  useEffect(() => {
    const fetchGamificationData = async () => {
      try {
        const lRes = await fetch(`${getApiUrl()}/api/gamification/leaderboard`, {
          headers: getAuthHeaders()
        });
        if (lRes.ok) {
          const lData: LeaderboardResponse = await lRes.json();
          setLeaderboard(lData);
        }
        
        const aRes = await fetch(`${getApiUrl()}/api/gamification/achievements`, {
          headers: getAuthHeaders()
        });
        const myRes = await fetch(`${getApiUrl()}/api/gamification/my-achievements`, {
          headers: getAuthHeaders()
        });
        
        if (aRes.ok && myRes.ok) {
          const allAchs = await aRes.json();
          const myAchs = await myRes.json();
          const myCodes = new Set(myAchs.map((m: any) => m.achievement.badge_code));
          
          const mapped: Achievement[] = allAchs.map((a: any) => ({
            name: a.name,
            description: a.description,
            xp_reward: a.xp_reward,
            badge_code: a.badge_code,
            icon: a.badge_code === "first_log" ? "🌱" : a.badge_code === "transit_master" ? "🚇" : a.badge_code === "green_eater" ? "🥗" : a.badge_code === "zero_waste" ? "♻️" : a.badge_code === "streak_3" ? "🔥" : "👑",
            unlocked: myCodes.has(a.badge_code)
          }));
          setAchievements(mapped);
        }
      } catch (err) {
        console.log("Leaderboard syncing complete.");
      } finally {
        setLoading(false);
      }
    };
    fetchGamificationData();
  }, []);

  // Sync preview rank tab with actual user level initially
  useEffect(() => {
    const currentRank = AVATAR_RANKS.reduce((prev, curr) => {
      if (profile.level >= curr.levelRequired) return curr;
      return prev;
    }, AVATAR_RANKS[0]);
    setPreviewRankId(currentRank.id);
  }, [profile.level]);

  // Render progression SVG badges based on Rank ID (Signature Feature #2)
  const renderAvatarBadge = (rankId: string, glowColor: string) => {
    const baseSvgProps = {
      viewBox: "0 0 100 100",
      className: "h-36 w-36 drop-shadow-[0_0_12px_var(--glow)]",
      style: { "--glow": glowColor } as React.CSSProperties
    };

    if (rankId === "rookie") {
      return (
        <svg {...baseSvgProps} aria-label="Eco Rookie Badge">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#B45309" strokeWidth="2" strokeDasharray="3 3" />
          <polygon points="50,15 80,35 80,65 50,85 20,65 20,35" fill="rgba(180, 83, 9, 0.15)" stroke="#B45309" strokeWidth="3" />
          <path d="M50 35 C58 35, 62 48, 50 62 C38 48, 42 35, 50 35" fill="#B45309" />
          <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
        </svg>
      );
    }
    if (rankId === "explorer") {
      return (
        <svg {...baseSvgProps} aria-label="Green Explorer Badge">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#94A3B8" strokeWidth="2.5" />
          <polygon points="50,12 83,32 83,68 50,88 17,68 17,32" fill="rgba(148, 163, 184, 0.15)" stroke="#94A3B8" strokeWidth="3" />
          {/* Orbiting ring */}
          <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="#64748B" strokeWidth="1.5" transform="rotate(-20 50 50)" />
          {/* Leaves */}
          <path d="M50 32 C58 32, 60 44, 50 54 M50 32 C42 32, 40 44, 50 54" fill="#94A3B8" />
          <circle cx="50" cy="54" r="5" fill="#94A3B8" />
        </svg>
      );
    }
    if (rankId === "warrior") {
      return (
        <svg {...baseSvgProps} aria-label="Carbon Warrior Badge">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#10B981" strokeWidth="1.5" />
          <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" fill="rgba(16, 185, 129, 0.18)" stroke="#10B981" strokeWidth="3.5" />
          {/* Shield cross leaves */}
          <path d="M50 22 L50 68" stroke="#10B981" strokeWidth="3" />
          <path d="M30 45 L70 45" stroke="#10B981" strokeWidth="3" />
          <circle cx="50" cy="45" r="14" fill="#047857" stroke="#10B981" strokeWidth="2" />
          <path d="M50 38 Q56 45 50 52 Q44 45 50 38" fill="#FFFFFF" />
        </svg>
      );
    }
    if (rankId === "guardian") {
      return (
        <svg {...baseSvgProps} aria-label="Climate Guardian Badge">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#0EA5E9" strokeWidth="2" strokeDasharray="5 2" />
          <polygon points="50,8 88,28 88,72 50,92 12,72 12,28" fill="rgba(14, 165, 233, 0.2)" stroke="#0EA5E9" strokeWidth="4" />
          {/* Wings wrapping globe */}
          <path d="M22 45 Q35 30 50 38 Q65 30 78 45 Q50 65 22 45" fill="none" stroke="#0EA5E9" strokeWidth="2" />
          <circle cx="50" cy="45" r="11" fill="none" stroke="#0EA5E9" strokeWidth="2.5" />
          <path d="M40 45 H60 M50 35 V55" stroke="#0EA5E9" strokeWidth="1.5" opacity="0.6" />
        </svg>
      );
    }
    if (rankId === "protector") {
      return (
        <svg {...baseSvgProps} aria-label="Planet Protector Badge">
          {/* Outer glowing rings */}
          <circle cx="50" cy="50" r="44" fill="none" stroke="#8B5CF6" strokeWidth="3" />
          <polygon points="50,6 90,26 90,74 50,94 10,74 10,26" fill="rgba(139, 92, 246, 0.2)" stroke="#8B5CF6" strokeWidth="4.5" />
          {/* Orbiting ring and planet */}
          <circle cx="50" cy="50" r="14" fill="#6D28D9" stroke="#8B5CF6" strokeWidth="2" />
          <ellipse cx="50" cy="50" rx="28" ry="8" fill="none" stroke="#C084FC" strokeWidth="2" transform="rotate(-25 50 50)" />
          <circle cx="35" cy="43" r="2.5" fill="#FFFFFF" />
          <circle cx="65" cy="57" r="2.5" fill="#FFFFFF" />
        </svg>
      );
    }
    // Titan
    return (
      <svg {...baseSvgProps} aria-label="Earth Titan Badge">
        <polygon points="50,4 92,24 92,76 50,96 8,76 8,24" fill="rgba(245, 158, 11, 0.22)" stroke="#F59E0B" strokeWidth="5" />
        {/* Crown Earth */}
        <circle cx="50" cy="54" r="16" fill="#D97706" stroke="#F59E0B" strokeWidth="3" />
        {/* Crown peaks */}
        <polygon points="34,36 42,24 50,32 58,24 66,36" fill="#F59E0B" />
        <circle cx="50" cy="22" r="3" fill="#FFFFFF" />
        {/* Star highlights */}
        <path d="M50 48 L50 60 M44 54 H56" stroke="#FFFFFF" strokeWidth="2" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent" />
      </div>
    );
  }

  // Calculate current rank tier
  const activeRank = AVATAR_RANKS.find(r => r.id === previewRankId) || AVATAR_RANKS[0];
  const userRank = AVATAR_RANKS.reduce((prev, curr) => {
    if (profile.level >= curr.levelRequired) return curr;
    return prev;
  }, AVATAR_RANKS[0]);

  const xpProgress = profile.xp % 500;
  const xpPercent = Math.min(100, Math.round((xpProgress / 500) * 100));

  return (
    <div className="flex flex-col gap-10 py-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-brand-borderDark/30 pb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <span>Streaks & Achievements</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Grow your Personal Carbon Avatar, unlock achievements, and lead the global movement
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          SIGNATURE FEATURE #2: PERSONAL CARBON AVATAR PROGRESSION
          ═══════════════════════════════════════ */}
      <section className="glass-card rounded-3xl p-6 border border-white/20 grid gap-8 md:grid-cols-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-brand-emerald/5 rounded-full blur-3xl pointer-events-none -z-10" />
        
        {/* Left Column: Avatar Showcase */}
        <div className="md:col-span-2 flex flex-col items-center justify-between text-center border-r border-brand-borderDark/30 pr-6">
          <div className="w-full">
            <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest block mb-1">
              Personal Carbon Avatar
            </span>
            <span className="text-[11px] text-gray-400">Appearance evolves based on sustainability rank</span>
          </div>

          {/* Glowing Badge Area */}
          <div className="my-6 p-4 rounded-3xl bg-brand-darkBg/60 border border-brand-borderDark/30 flex items-center justify-center min-h-[170px] min-w-[170px]">
            {renderAvatarBadge(previewRankId, activeRank.glow)}
          </div>

          <div className="w-full">
            <span className="block text-xl font-heading font-black capitalize tracking-tight">{activeRank.name}</span>
            <div className="flex items-center justify-center gap-1.5 text-xs text-brand-emerald mt-1 font-semibold">
              <Star className="h-3.5 w-3.5 fill-brand-emerald" />
              <span>Level Required: {activeRank.levelRequired}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Progression Stepper */}
        <div className="md:col-span-3 flex flex-col justify-between gap-6 text-left">
          {/* User's current rank card */}
          <div className="p-4 bg-brand-cardDark/50 border border-brand-borderDark/30 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <span className="text-xs text-gray-400">Your Current Progression Status:</span>
              <h4 className="text-lg font-black text-brand-emerald mt-0.5">{userRank.name} (Level {profile.level})</h4>
            </div>

            {/* Progress ring to next level */}
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-xs font-bold font-mono">{xpProgress} / 500 XP</span>
              <div className="w-32 bg-brand-borderDark h-2 rounded-full overflow-hidden mt-1.5 border border-brand-borderDark/50">
                <div className="bg-brand-emerald h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
              </div>
              <span className="text-[9px] text-gray-400 mt-1">Level {profile.level + 1} unlocks in {500 - xpProgress} XP</span>
            </div>
          </div>

          {/* Selector Tabs to Preview all levels */}
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
              Preview Rank Hierarchy
            </span>
            <div className="flex flex-wrap gap-2">
              {AVATAR_RANKS.map((rank) => {
                const isSelected = previewRankId === rank.id;
                const isUnlocked = profile.level >= rank.levelRequired;
                return (
                  <button
                    key={rank.id}
                    onClick={() => setPreviewRankId(rank.id)}
                    className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                      isSelected
                        ? "bg-brand-emerald text-white border-brand-emerald shadow-md shadow-brand-emerald/10 scale-[1.03]"
                        : "glass-card text-gray-400 hover:text-gray-200 hover:border-brand-emerald/40"
                    }`}
                  >
                    {!isUnlocked && <Lock className="h-3 w-3 text-red-500" />}
                    <span>{rank.name.split(" ")[1] || rank.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details on the active previewed rank */}
          <div className="p-4 bg-gray-50/50 dark:bg-brand-cardDark/30 border border-gray-100 dark:border-brand-borderDark/20 rounded-2xl flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rank Description & unlocked Perks</span>
            <p className="text-xs text-gray-300 leading-relaxed">
              {activeRank.desc}
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-sky border-t border-brand-borderDark/30 pt-3">
              <ShieldCheck className="h-4.5 w-4.5 text-brand-sky flex-shrink-0" />
              <span>Rank Perk: {activeRank.perk}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Badges & Leaderboard */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Columns: Badges */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-6 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Award className="h-5.5 w-5.5 text-brand-emerald" />
                <span>Sustainability Achievements</span>
              </h3>
              <span className="text-[10px] text-gray-400">Complete challenges to unlock badges & XP rewards</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-left">
              {achievements.map((ach) => (
                <div 
                  key={ach.badge_code}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                    ach.unlocked 
                      ? "bg-brand-emerald/5 border-brand-emerald/30 text-gray-800 dark:text-white"
                      : "bg-gray-100/40 border-gray-200 dark:bg-brand-cardDark/20 dark:border-brand-borderDark/40 opacity-60"
                  }`}
                >
                  <div className="text-3xl p-2.5 bg-white dark:bg-brand-cardDark rounded-xl shadow-sm flex-shrink-0">
                    {ach.icon}
                  </div>
                    <div>
                      <span className="block font-bold text-sm">{ach.name}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-normal">{ach.description}</p>
                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            ach.unlocked 
                              ? "bg-brand-emerald/10 text-brand-emerald"
                              : "bg-gray-200 dark:bg-brand-borderDark text-gray-400"
                          }`}>
                            {ach.unlocked ? "Unlocked" : "Locked"}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400">+{ach.xp_reward} XP</span>
                        </div>
                        {ach.unlocked && (
                          <button
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: `I earned the "${ach.name}" badge on CarboECO! 🌿`,
                                  text: `${ach.description} Join me in reducing carbon footprints!`,
                                  url: window.location.href
                                });
                              } else {
                                navigator.clipboard.writeText(
                                  `I earned "${ach.name}" on CarboECO! 🌿 ${window.location.href}`
                                );
                              }
                            }}
                            aria-label={`Share ${ach.name} achievement`}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-brand-emerald dark:hover:text-emerald-400 transition-colors"
                          >
                            <Share2 className="w-3 h-3" />
                            Share
                          </button>
                        )}
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Leaderboard */}
        <div className="glass-card rounded-3xl p-6 border border-white/20 flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-brand-borderDark/50 pb-4">
              <Trophy className="h-5.5 w-5.5 text-yellow-500" />
              <span>Eco Leaderboard</span>
            </h3>

            <div className="flex flex-col gap-3">
              {leaderboard.leaderboard.map((u) => {
                const isUser = u.full_name.toLowerCase() === "you";
                return (
                  <div 
                    key={u.rank}
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
                      isUser 
                        ? "bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald" 
                        : "bg-gray-50/50 dark:bg-brand-cardDark/35 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-5 text-center font-heading font-black text-sm ${
                        u.rank === 1 ? "text-yellow-500" : u.rank === 2 ? "text-gray-400" : "text-gray-500"
                      }`}>
                        #{u.rank}
                      </span>
                      <div className="h-8.5 w-8.5 rounded-full bg-brand-emerald/10 text-brand-emerald flex items-center justify-center font-bold text-xs uppercase border border-brand-emerald/20">
                        {u.full_name.slice(0, 2)}
                      </div>
                      <div className="text-left">
                        <span className="block text-xs font-bold text-gray-800 dark:text-white capitalize">{u.full_name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>Level {u.level}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-orange-500">
                            <Flame className="h-3 w-3 fill-orange-500" stroke="none" />
                            {u.streak_count}d streak
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-extrabold">{u.xp} XP</span>
                  </div>
                );
              })}
            </div>
          </div>

          {leaderboard.user_rank && (
            <div className="p-3 bg-brand-sky/10 border border-brand-sky/20 rounded-xl text-center text-xs font-semibold text-brand-sky mt-6">
              You are currently ranked #{leaderboard.user_rank} globally! Keep logging to climb.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
