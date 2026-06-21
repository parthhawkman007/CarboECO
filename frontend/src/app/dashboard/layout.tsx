import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Command Center Dashboard | CarboECO",
  description: "View your daily carbon budget, category breakdowns, and track habits.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
