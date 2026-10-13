type PlatformIconProps = {
  platform: string;
  className?: string;
};

export default function PlatformIcon({ platform, className = "size-4" }: PlatformIconProps) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (platform === "Facebook") {
    return <svg {...common}><path d="M14 8h3V4.5h-3.2C10.6 4.5 9 6.35 9 9.2V11H6v3.5h3V21h4v-6.5h3.2L17 11h-4V9.4c0-.95.35-1.4 1-1.4Z" /></svg>;
  }
  if (platform === "Instagram") {
    return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.7" r=".8" fill="currentColor" stroke="none" /></svg>;
  }
  if (platform === "YouTube") {
    return <svg {...common}><path d="M21 12s0-4.2-.55-5.55a2.5 2.5 0 0 0-1.75-1.77C17.15 4.25 12 4.25 12 4.25s-5.15 0-6.7.43a2.5 2.5 0 0 0-1.75 1.77C3 7.8 3 12 3 12s0 4.2.55 5.55a2.5 2.5 0 0 0 1.75 1.77c1.55.43 6.7.43 6.7.43s5.15 0 6.7-.43a2.5 2.5 0 0 0 1.75-1.77C21 16.2 21 12 21 12Z" /><path d="m10 9 5 3-5 3V9Z" /></svg>;
  }
  if (platform === "TikTok") {
    return <svg {...common}><path d="M14.5 4v10.25a4.25 4.25 0 1 1-3.25-4.13" /><path d="M14.5 4c.7 2.45 2.05 3.85 4.5 4.25" /></svg>;
  }
  if (platform === "Telegram") {
    return <svg {...common}><path d="m3.5 11 16.4-6.4-3 14.8-5.15-4.1-3.1 2.8.65-5.35L17 7.3 7.7 11.9 3.5 11Z" /></svg>;
  }
  if (platform === "X (Twitter)") {
    return <svg {...common}><path d="M5 4.5 18.5 20M19 4.5 5.5 20" /></svg>;
  }
  if (platform === "LinkedIn") {
    return <svg {...common}><rect x="4" y="9" width="3" height="10" /><circle cx="5.5" cy="5.5" r="1.5" /><path d="M11 19V9h3v1.7c.8-1.25 2-2 3.55-2C19.75 8.7 21 10.2 21 13v6h-3v-5.4c0-1.35-.55-2.1-1.75-2.1-1.3 0-2.25.9-2.25 2.7V19h-3Z" /></svg>;
  }
  if (platform === "Spotify") {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M7.5 9.2c3.4-1 7.4-.7 10.1.7M8.4 12.4c2.8-.7 6.3-.45 8.65.65M9.1 15.4c2.3-.5 4.9-.3 6.85.55" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.45 3.2 5.45 3.2 9s-1 6.55-3.2 9M12 3C9.8 5.45 8.8 8.45 8.8 12s1 6.55 3.2 9" /></svg>;
}
