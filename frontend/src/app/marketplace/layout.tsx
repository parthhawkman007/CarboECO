import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carbon Offset Marketplace | CarboECO",
  description: "Offset your footprints by investing in Gold Standard and VCS verified projects.",
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
