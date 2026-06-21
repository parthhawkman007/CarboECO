import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interactive Transition Simulator | CarboECO",
  description: "Simulate the carbon saving effects of transition policies like EVs and solar panels.",
};

export default function SimulatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
