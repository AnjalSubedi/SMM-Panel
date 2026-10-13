import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import AccountProvider from "../components/AccountProvider";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./globals.css";

const geist = localFont({ src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

const spaceGrotesk = localFont({ src: "../public/fonts/SpaceGrotesk-Variable.ttf", variable: "--font-space-grotesk", weight: "300 700", display: "swap" });

export const metadata: Metadata = {
  title: "Digital Marketing NP | Growth for Nepali Creators & Brands",
  description: "Audience acquisition, page monetization, and transparent NPR pricing for Nepali creators and brands. Browse growth bundles and build your order.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Browser extensions may inject attributes on body before React hydrates.
  // Keep the exception on body only; application components still report mismatches.
  return <html lang="en" className={geist.variable + " " + geistMono.variable + " " + spaceGrotesk.variable}><body suppressHydrationWarning className="bg-[#FAFAFA] font-sans text-zinc-900 antialiased"><a href="#main-content" className="fixed left-4 top-3 z-[60] -translate-y-24 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white focus:translate-y-0">Skip to content</a><AccountProvider><Header /><main id="main-content" tabIndex={-1}>{children}</main><Footer /></AccountProvider></body></html>;
}
