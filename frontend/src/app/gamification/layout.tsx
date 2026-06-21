import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Citizen Leaderboard & Achievements | CarboECO",
  description: "Compete with other citizens, maintain active streaks, and unlock environmental achievements.",
};

export default function GamificationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
