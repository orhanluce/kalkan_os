import type { NextConfig } from "next";

// Güvenlik başlıkları (master talimat §26, PR-1).
//
// CSP REPORT-ONLY başlar (bilinçli): Next.js inline script'leri (hydration,
// tema no-flash script'i) ve Supabase bağlantıları var — enforce moduna
// geçmeden önce rapor modunda gerçek ihlal envanteri toplanır; körlemesine
// enforce, canlıda sayfayı sessizce kırar. Enforce'a geçiş PR-2 kapısında,
// rapor temizse.
//
// HSTS BURADA YOK (bilinçli): kontrollü rollout ister (belge §26) — yanlış
// max-age ile erken HSTS, TLS sorunu yaşayan kullanıcıyı siteden tümüyle
// kilitler. Hostinger TLS zorunluluğu doğrulandıktan sonra kısa max-age ile
// ayrı adımda açılır.
const guvenlikBasliklari = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      // 'unsafe-inline'/'unsafe-eval': Next dev + hydration + tema inline
      // script'i. Enforce'a geçerken nonce'a evrilecek (PR-2).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Supabase: REST + Auth + Storage + Realtime (wss).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/giris",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }],
      },
      { source: "/(.*)", headers: guvenlikBasliklari },
    ];
  },
};

export default nextConfig;
