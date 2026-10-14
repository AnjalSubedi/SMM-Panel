import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import AccountProvider from "../components/AccountProvider";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { isPreview, privateRobots, siteName, siteUrl } from "../lib/seo";
import "./globals.css";

const geist = localFont({ src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Digital Marketing NP", template: "%s | Digital Marketing NP" },
  applicationName: siteName,
  metadataBase: new URL(siteUrl),
  robots: isPreview ? privateRobots : { index: true, follow: true },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  description: "Compare social media followers, views, likes and watch-time services. See prices in NPR and pay with eSewa or your account wallet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Browser extensions may inject attributes on body before React hydrates.
  // Keep the exception on body only; application components still report mismatches.
  return <html lang="en" className={geist.variable + " " + geistMono.variable}><body suppressHydrationWarning className="bg-[#FAFAFA] font-sans text-slate-900 antialiased"><a href="#main-content" className="fixed left-4 top-3 z-[60] -translate-y-24 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white focus:translate-y-0">Skip to content</a><AccountProvider><Header /><main id="main-content" tabIndex={-1}>{children}</main><Footer /></AccountProvider></body></html>;
}
