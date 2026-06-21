import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | CarboECO",
  description: "Access the CarboECO Command Center and manage your sustainability dashboard.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
