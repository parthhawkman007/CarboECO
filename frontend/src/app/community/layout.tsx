import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eco Community Sync | CarboECO",
  description: "Connect with other climate citizens and join localized environmental action groups.",
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
