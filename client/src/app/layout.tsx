import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { Geist, Playfair_Display } from "next/font/google";
import { brand } from "@/config/brand";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${brand.restaurantName} · In-Room Dining`,
  description: `Order from ${brand.restaurantName} straight to your room at ${brand.hotelName}.`,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: brand.colors.background };

// Push brand colors from brand.ts into CSS variables used by the Tailwind tokens.
const c = brand.colors;
const brandVars = {
  "--brand-background": c.background, "--brand-surface": c.surface, "--brand-ink": c.ink,
  "--brand-muted": c.muted, "--brand-line": c.line, "--brand-accent": c.accent,
  "--brand-accent-dark": c.accentDark, "--brand-accent-soft": c.accentSoft, "--brand-brass": c.brass,
  "--brand-veg": c.veg, "--brand-non-veg": c.nonVeg,
} as CSSProperties;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable} h-full antialiased`} style={brandVars}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
