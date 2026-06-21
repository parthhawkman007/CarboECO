import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Sustainability Coach | CarboECO",
  description: "Get real-time suggestions and abating strategies from our RAG-enhanced sustainability coach.",
};

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
