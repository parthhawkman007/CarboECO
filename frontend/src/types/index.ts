export interface User {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string | null;
  avatar: string;
  xp: number;
  level: number;
  streak_count: number;
  last_active_date: string | null;
  carbon_budget: number;
}

export interface CarbonLog {
  id: number;
  user_id: number;
  date: string;
  category: string;
  subcategory: string;
  value: number;
  unit: string;
  co2_equivalent: number;
  explanation: string | null;
  metadata_json: Record<string, any> | null;
  created_at: string;
}

export interface CategorySummary {
  category: string;
  co2_equivalent: number;
  percentage: number;
  logs_count: number;
}

export interface CarbonSummary {
  daily_co2: number;
  weekly_co2: number;
  monthly_co2: number;
  annual_co2: number;
  daily_budget: number;
  efficiency_rating: string;
  category_breakdown: CategorySummary[];
}

export interface AIRecommendation {
  id: number;
  user_id: number;
  title: string;
  description: string;
  impact_score: number;
  category: string;
  explanation: string;
  status: string;
  created_at: string;
}

export interface Achievement {
  name: string;
  description: string;
  xp_reward: number;
  badge_code: string;
  icon: string;
  unlocked: boolean;
}

export interface LeaderboardUser {
  user_id: number;
  full_name: string;
  xp: number;
  level: number;
  streak_count: number;
  avatar: string;
  rank: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardUser[];
  user_rank: number | null;
}

export interface LearningLesson {
  id: number;
  path_id: number;
  title: string;
  content: string;
  quiz_question: string | null;
  quiz_options: string[] | null;
  quiz_answer: string | null;
  xp_reward: number;
}

export interface LearningPath {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  xp_reward: number;
  lessons: LearningLesson[];
}

export interface SimulationRun {
  id: number;
  user_id: number;
  name: string;
  inputs_json: Record<string, any>;
  co2_saved: number;
  created_at: string;
}

export interface OffsetProject {
  id: number;
  name: string;
  description: string;
  cost_per_ton: number;
  co2_offset: number;
  image_url: string | null;
  verified_by: string;
}

export interface OffsetCertificate {
  id: number;
  amount_bought: number;
  co2_offsetted: number;
  purchased_at: string;
  project: OffsetProject;
}

export interface DigitalTwinResponse {
  id: number;
  user_id: number;
  tree_growth_stage: number;
  energy_efficiency_score: number;
  current_avatar_state_json: {
    health: number;
    theme: string;
    leaves_color: string;
    accessories: string[];
    last_watered_date?: string;
  };
  updated_at: string;
}

export interface EcoGroup {
  id: number;
  name: string;
  description: string;
  members_count: number;
}
