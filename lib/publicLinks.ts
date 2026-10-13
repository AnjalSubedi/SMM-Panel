import "server-only";
import { isIP } from "node:net";
const socialDomains: Record<string, readonly string[]> = {
  Facebook: ["facebook.com", "fb.com", "fb.me", "fb.watch"],
  Instagram: ["instagram.com"], YouTube: ["youtube.com", "youtu.be"], TikTok: ["tiktok.com"],
  Telegram: ["t.me", "telegram.me", "telegram.org"], "X (Twitter)": ["x.com", "twitter.com", "t.co"],
  LinkedIn: ["linkedin.com", "lnkd.in"], Spotify: ["spotify.com", "spotify.link"],
};
export function isPublicWebLink(value: string, platform?: string): boolean {
  try {
    if (value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return false;
    const url = new URL(value); const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || (url.port && !["80", "443"].includes(url.port))) return false;
    if (host.startsWith("[") || isIP(host) || !host.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)) return false;
    const domains = platform ? socialDomains[platform] : undefined;
    return !domains || domains.some(domain => host === domain || host.endsWith("." + domain));
  } catch { return false; }
}
