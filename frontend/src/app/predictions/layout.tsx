import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Carbon Forecasts | CarboECO",
  description: "View 12-month carbon trend projections and get alerts about distribution drifts.",
};

export default function PredictionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
