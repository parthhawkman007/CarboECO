import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eco Learning Academy | CarboECO",
  description: "Take lessons, test your knowledge with quizzes, and earn XP rewards.",
};

export default function EducationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
