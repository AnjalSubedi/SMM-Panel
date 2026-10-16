// Customer-facing descriptions only. Provider IDs, quantities and prices live in catalogData.js.
export const bundleCopy: Record<string, { name: string; badge: string; target: string; inclusions: readonly string[] }> = {
  COMBO_FB_MONETIZATION: {
    name: "Facebook followers & watch time", badge: "For video creators",
    target: "Facebook pages growing their video audience",
    inclusions: ["10,000 Facebook page followers", "60,000 video watch minutes", "30-day refill for follower drops", "Requires a 3-hour Facebook video"],
  },
  COMBO_CREATOR_STARTER: {
    name: "Facebook & Instagram starter", badge: "Two platforms",
    target: "Small businesses and creators using both platforms",
    inclusions: ["5,000 Facebook page followers/likes", "2,500 Instagram followers", "1,000 Facebook post likes"],
  },
  COMBO_VIRAL_PACK: {
    name: "Reel views & likes", badge: "Views & likes",
    target: "Creators sharing reels and short videos",
    inclusions: ["50,000 Instagram reel views", "2,000 Instagram reel likes", "25,000 Facebook video views"],
  },
  COMBO_YPP_COMPLETE: {
    name: "YouTube subscribers & watch time", badge: "For your channel",
    target: "YouTube channels adding subscribers and watch time",
    inclusions: ["1,000 YouTube subscribers", "4,000 hours of public watch time", "Estimated delivery: 5–7 days"],
  },
};

const serviceNames: Record<string, string> = {
  FB_01: "Facebook page likes & followers (refill available)",
  FB_02: "Facebook page followers",
  FB_03: "Facebook public profile followers",
  FB_04: "Facebook followers from Nepal & South Asia",
  FB_05: "Facebook post likes",
  FB_06: "Facebook post reactions (Love, Care, Wow or Haha)",
  FB_07: "Facebook video & reel views",
  FB_08: "Facebook video watch time (60,000 minutes)",
  FB_09: "Facebook live viewers (30 minutes)",
  FB_10: "Facebook live viewers (60 minutes)",
  FB_11: "Facebook group members",
  FB_12: "Facebook post shares",
  FB_13: "Facebook comments (your text or emojis)",
  FB_14: "Facebook 5-star page reviews & recommendations",
  IG_01: "Instagram followers (30-day refill)",
  IG_02: "Instagram followers (365-day protection)",
  IG_03: "Instagram followers from South Asia",
  IG_04: "Instagram post & reel likes",
  IG_05: "Instagram likes for your next 30 posts",
  IG_06: "Instagram reel & video views",
  IG_07: "Instagram views for all active stories",
  IG_08: "Instagram story poll votes",
  IG_09: "Instagram post saves & shares",
  IG_10: "Instagram reach & impressions",
  IG_11: "Instagram comments (your text)",
  IG_12: "Instagram live video viewers",
  YT_01: "YouTube subscribers (60-day refill)",
  YT_02: "YouTube video views (longer viewing time)",
  YT_03: "YouTube Shorts views",
  YT_04: "YouTube views from ads & suggested videos",
  YT_05: "YouTube public watch time (1,000 hours)",
  YT_06: "YouTube public watch time (4,000 hours)",
  YT_07: "YouTube video & Shorts likes",
  YT_08: "YouTube video shares",
  YT_09: "YouTube premiere & live viewers (1 hour)",
  YT_10: "YouTube comments (your text)",
  TT_01: "TikTok followers (refill available)",
  TT_02: "TikTok video likes",
  TT_03: "TikTok video views",
  TT_04: "TikTok video views (large orders)",
  TT_05: "TikTok video shares",
  TT_06: "TikTok video saves",
  TT_07: "TikTok live viewers & battle points",
  TT_08: "TikTok comments (your text)",
  TG_01: "Telegram channel & group members",
  TG_02: "Telegram views for your last 5 posts",
  TG_03: "Telegram post reactions",
  TW_01: "X (Twitter) followers",
  TW_02: "X (Twitter) post likes",
  TW_03: "X (Twitter) reposts",
  TW_04: "X (Twitter) post views & impressions",
  LI_01: "LinkedIn company page followers",
  LI_02: "LinkedIn profile connections & followers",
  LI_03: "LinkedIn post likes & reactions",
  SP_01: "Spotify track plays",
  SP_02: "Spotify artist & playlist followers",
  WD_01: "Discord server members",
  WD_02: "Website visits from Nepal & other countries",
};

export function customerItemName(id: string, fallback: string): string {
  return bundleCopy[id]?.name ?? serviceNames[id] ?? fallback;
}

export function serviceHelp(id: string): string | undefined {
  if (id === "IG_01") return "A refill replaces followers that drop within 30 days. Contact us with your order number if this happens.";
  if (id === "IG_02") return "This option includes 365-day protection against follower drops. Ask us about the coverage before ordering.";
  if (id === "YT_01") return "A refill replaces subscribers that drop within 60 days. Contact us with your order number if this happens.";
  if (["FB_01", "TT_01"].includes(id)) return "Refill means replacing followers that drop after delivery. Ask us about the refill period before ordering.";
  if (id === "IG_10" || id === "TW_04") return "Reach counts accounts that see your content. Impressions count how many times it is displayed.";
  if (id === "IG_05") return "This covers likes on your next 30 posts. It is a one-time purchase, not a recurring payment.";
  if (["FB_08", "YT_05", "YT_06"].includes(id)) return "Watch time is the time spent watching your videos. The platform decides which hours count toward monetization.";
  return undefined;
}
