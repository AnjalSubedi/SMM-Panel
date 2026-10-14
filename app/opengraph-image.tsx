import { ImageResponse } from "next/og";

export const alt = "Digital Marketing NP - social media services and website design in Nepal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FAFAFA", padding: "64px", color: "#0F172A", borderTop: "12px solid #2563EB" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", fontSize: 32, fontWeight: 700 }}>
        <svg width="52" height="52" viewBox="0 0 32 32"><path d="M4 28v-7h4v7H4Zm8 0V17h4v11h-4Zm8 0V13h4v15h-4Z" fill="#0F172A"/><path d="m5 16 7-7 6 4 9-9m-7 0h7v7" fill="none" stroke="#2563EB" strokeWidth="2.5"/></svg>
        <span>Digital Marketing NP</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ fontSize: 66, fontWeight: 700, letterSpacing: "-2px", lineHeight: 1.12, maxWidth: 980 }}>Social media services. Clear prices. Built for Nepal.</div>
        <div style={{ fontSize: 26, color: "#475569" }}>Followers, views, watch time & website design</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #CBD5E1", paddingTop: 24, fontSize: 22, color: "#475569" }}><span>digitalmarketingnp.me</span><span>Prices in NPR / Pay with eSewa</span></div>
    </div>, size,
  );
}
