import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quick Carbon Calculator | CarboECO",
  description: "Calculate emissions for transport, food, energy, waste, and shopping in seconds.",
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
