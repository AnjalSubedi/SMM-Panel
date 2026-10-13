// Presentation helpers stay independent of the full provider catalog.
export const platformOrder = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Telegram",
  "X (Twitter)",
  "LinkedIn",
  "Spotify",
  "Web & Discord",
] as const;

export function formatPrice(price: number): string {
  return `NPR ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("en-US");
}
