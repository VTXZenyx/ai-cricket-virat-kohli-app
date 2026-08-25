import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meet AI Virat Kohli!!! — Fan-made AI Mentor",
  description: "A fan-made AI cricket, mindset and motivation mentor inspired by publicly known aspects of Virat Kohli's cricket mentality.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
