import { create } from "zustand";
import { User, UserProfile, CarbonLog, EcoGroup, SimulationRun, Achievement } from "@/types";

export interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
}

export interface EcoState {
  // Auth & Profile
  user: User | null;
  profile: UserProfile;
  mfaVerified: boolean;
  avatarRank: string;

  // Carbon logs & queue
  logs: CarbonLog[];
  pendingLogsCount: number;

  // AI Copilot
  copilotMessages: Message[];
  copilotTyping: boolean;

  // Simulator
  scenarios: SimulationRun[];

  // Gamification & Missions
  achievements: Achievement[];
  streakCount: number;

  // Community
  groups: EcoGroup[];
  joinedGroups: number[];

  // Actions
  login: (email: string) => void;
  logout: () => void;
  verifyMfa: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  
  addLog: (log: CarbonLog) => void;
  setPendingLogsCount: (count: number) => void;
  
  addCopilotMessage: (text: string, sender: "user" | "copilot") => void;
  setCopilotTyping: (typing: boolean) => void;
  
  saveScenario: (scenario: SimulationRun) => void;
  awardXp: (amount: number) => void;
  joinGroup: (id: number) => void;
  createGroup: (name: string, description: string) => EcoGroup;
}

export const getAvatarRank = (level: number): string => {
  if (level === 1) return "Eco Rookie";
  if (level === 2) return "Green Explorer";
  if (level === 3) return "Carbon Warrior";
  if (level === 4) return "Climate Guardian";
  if (level === 5) return "Planet Protector";
  return "Earth Titan";
};

const INITIAL_PROFILE: UserProfile = {
  id: 1,
  user_id: 1,
  full_name: "Sustain User",
  avatar: "avatar_1.png",
  xp: 620,
  level: 2,
  streak_count: 3,
  last_active_date: new Date().toISOString().split("T")[0],
  carbon_budget: 15.0
};

const INITIAL_LOGS: CarbonLog[] = [
  {
    id: 101,
    user_id: 1,
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    category: "transportation",
    subcategory: "petrol_car",
    value: 45,
    unit: "km",
    co2_equivalent: 8.1,
    explanation: "Commute in petrol sedan.",
    metadata_json: null,
    created_at: new Date().toISOString()
  },
  {
    id: 102,
    user_id: 1,
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    category: "energy",
    subcategory: "electricity",
    value: 12,
    unit: "kWh",
    co2_equivalent: 5.04,
    explanation: "Standard electric home usage.",
    metadata_json: null,
    created_at: new Date().toISOString()
  },
  {
    id: 103,
    user_id: 1,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    category: "food",
    subcategory: "beef",
    value: 0.5,
    unit: "kg",
    co2_equivalent: 13.5,
    explanation: "Diet emissions from beef intake.",
    metadata_json: null,
    created_at: new Date().toISOString()
  },
  {
    id: 104,
    user_id: 1,
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    category: "digital",
    subcategory: "streaming",
    value: 4,
    unit: "hours",
    co2_equivalent: 0.2,
    explanation: "Video streaming data emissions.",
    metadata_json: null,
    created_at: new Date().toISOString()
  }
];

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { name: "First Steps", description: "Log your first carbon footprint activity.", xp_reward: 100, badge_code: "first_log", icon: "Leaf", unlocked: true },
  { name: "Transit Champion", description: "Log 5 public transit journeys.", xp_reward: 150, badge_code: "transit_master", icon: "Train", unlocked: false },
  { name: "Herbivore Hero", description: "Log 5 plant-based meals.", xp_reward: 150, badge_code: "green_eater", icon: "Flame", unlocked: true },
  { name: "Circular Warrior", description: "Log 5 recycling or composting activities.", xp_reward: 150, badge_code: "zero_waste", icon: "Trash2", unlocked: false },
  { name: "Consistent Green", description: "Maintain a 3-day active logging streak.", xp_reward: 200, badge_code: "streak_3", icon: "Award", unlocked: true }
];

const INITIAL_GROUPS: EcoGroup[] = [
  { id: 1, name: "Zero Waste Neighborhood", description: "Local community group aiming to compost and recycle all household waste.", members_count: 142 },
  { id: 2, name: "Metro Commuters Collective", description: "Reducing reliance on combustion engines by riding the metro together.", members_count: 89 },
  { id: 3, name: "Plant-Based Professionals", description: "Corporate employees sharing vegetarian and vegan recipes to reduce dietary impacts.", members_count: 54 }
];

export const useEcoStore = create<EcoState>((set) => ({
  user: {
    id: 1,
    email: "user@carboeco.org",
    role: "user",
    is_active: true,
    created_at: new Date().toISOString()
  },
  profile: INITIAL_PROFILE,
  mfaVerified: false,
  avatarRank: getAvatarRank(INITIAL_PROFILE.level),

  logs: INITIAL_LOGS,
  pendingLogsCount: 0,

  copilotMessages: [
    {
      id: "init-1",
      sender: "copilot",
      text: "Hello! I am your CarboECO Sustainability Copilot. How can I help you optimize your carbon budget today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ],
  copilotTyping: false,

  scenarios: [],

  achievements: INITIAL_ACHIEVEMENTS,
  streakCount: 3,

  groups: INITIAL_GROUPS,
  joinedGroups: [1],

  // Actions
  login: (email: string) => set((state) => ({
    user: {
      id: 1,
      email,
      role: "user",
      is_active: true,
      created_at: new Date().toISOString()
    },
    mfaVerified: false
  })),

  logout: () => set({ user: null, mfaVerified: false }),

  verifyMfa: () => set({ mfaVerified: true }),

  updateProfile: (updates: Partial<UserProfile>) => set((state) => {
    const updatedProfile = { ...state.profile, ...updates };
    return {
      profile: updatedProfile,
      avatarRank: getAvatarRank(updatedProfile.level)
    };
  }),

  addLog: (log: CarbonLog) => set((state) => ({
    logs: [log, ...state.logs]
  })),

  setPendingLogsCount: (count: number) => set({ pendingLogsCount: count }),

  addCopilotMessage: (text: string, sender: "user" | "copilot") => set((state) => ({
    copilotMessages: [
      ...state.copilotMessages,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]
  })),

  setCopilotTyping: (typing: boolean) => set({ copilotTyping: typing }),

  saveScenario: (scenario: SimulationRun) => set((state) => ({
    scenarios: [scenario, ...state.scenarios]
  })),

  awardXp: (amount: number) => set((state) => {
    const nextXp = state.profile.xp + amount;
    // Simple level progression: 500 XP per level
    const nextLevel = Math.floor(nextXp / 500) + 1;
    const updatedProfile = {
      ...state.profile,
      xp: nextXp,
      level: nextLevel
    };
    return {
      profile: updatedProfile,
      avatarRank: getAvatarRank(nextLevel)
    };
  }),

  joinGroup: (id: number) => set((state) => {
    if (state.joinedGroups.includes(id)) return {};
    const updatedGroups = state.groups.map((g) =>
      g.id === id ? { ...g, members_count: g.members_count + 1 } : g
    );
    return {
      joinedGroups: [...state.joinedGroups, id],
      groups: updatedGroups
    };
  }),

  createGroup: (name: string, description: string) => {
    const newGroup: EcoGroup = {
      id: Date.now(),
      name,
      description,
      members_count: 1
    };
    set((state) => ({
      groups: [newGroup, ...state.groups],
      joinedGroups: [...state.joinedGroups, newGroup.id]
    }));
    return newGroup;
  }
}));
