import FlowGuidance from "./ui/FlowGuidance";
import SupportEntry from "./SupportEntry";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SpaceCase",
  description: "School, teacher and family workspaces from Pinnacle Sentle Group.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<SupportEntry/><FlowGuidance/></body>
    </html>
  );
}
