import type { CatalogItem } from "./catalog";

// Storefront groupings only; the provider catalog and its rates stay untouched.
const groups: Record<string, readonly string[]> = {
  "Followers & subscribers": ["FB_01", "FB_02", "FB_03", "FB_04", "IG_01", "IG_02", "IG_03", "YT_01", "TT_01", "TW_01", "LI_01", "LI_02", "SP_02"],
  "Likes & reactions": ["FB_05", "FB_06", "IG_04", "YT_07", "TT_02", "TG_03", "TW_02", "LI_03"],
  "Video & reel views": ["FB_07", "IG_06", "YT_02", "YT_03", "YT_04", "TT_03", "TT_04"],
  "Watch time & monetization": ["FB_08", "YT_05", "YT_06"],
  "Live stream viewers": ["FB_09", "FB_10", "IG_12", "YT_09", "TT_07"],
  "Group & channel members": ["FB_11", "TG_01", "WD_01"],
  "Shares, saves & reposts": ["FB_12", "IG_09", "YT_08", "TT_05", "TT_06", "TW_03"],
  "Comments": ["FB_13", "IG_11", "YT_10", "TT_08"],
  "Reviews & recommendations": ["FB_14"],
  "Auto-likes subscriptions": ["IG_05"],
  "Story views & poll votes": ["IG_07", "IG_08"],
  "Reach & impressions": ["IG_10", "TW_04"],
  "Post views": ["TG_02"],
  "Track plays & streams": ["SP_01"],
  "Website traffic": ["WD_02"],
};

const categoryById = new Map(Object.entries(groups).flatMap(([category, ids]) => ids.map((id) => [id, category] as const)));

export function getServiceCategory(service: CatalogItem): string {
  return categoryById.get(service.id) ?? "Other services";
}
