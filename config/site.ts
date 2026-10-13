// Public contact details only. Provider keys must remain server-side.
export const site = {
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "9779744505435",
  esewaId: process.env.NEXT_PUBLIC_ESEWA_ID || "",
  esewaQrUrl: process.env.NEXT_PUBLIC_ESEWA_QR_URL || "/esewa-qr.jpg",
};

export const websiteInquiryUrl = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent("Hi, I am interested in a custom website for my business.")}`;

export const supportUrl = `https://wa.me/${site.whatsappNumber}`;
