import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { ClientProviders } from "@/components/store-provider";
import { TEMA_INLINE_SCRIPT } from "@/lib/tema";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display/başlık yüzü (tasarım dili): Archivo — kurumsal grotesk, latin-ext
// (ğışöüç) tam destekli. Gövde Geist'te kalır; Archivo yalnız başlıklarda
// (--font-heading → font-heading utility) konuşur. Türkçe UI için subset şart.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WardProof",
  description: "Finans kuruluşları için sürekli uyum ve doğrulanabilir kanıt çalışma alanı.",
};

// Yalnızca fontlar + yerel store/auth — header/nav (app) grubuna, guest
// paylaşım görünümüne (paylasim/[token]) sızmasın diye ayrı tutuluyor.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: inline tema script'i sunucunun bilmediği
    // .dark class'ını ilk paint'ten önce basar — React bunu "uyumsuzluk"
    // sanmasın (bilinçli ve yalnız <html> için; ADR-T2).
    <html
      lang="tr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {/* Hydration flash önleme: tema, gövde içeriği paint edilmeden ÖNCE
            uygulanır — script body'nin İLK çocuğu olduğu için parser ona
            gelene kadar hiçbir içerik çizilmez (master talimat §6). App
            Router manuel <head> çocuklarını yok saydığı için head'e DEĞİL
            buraya konur. Mantık src/lib/tema.ts'te tek yerde. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_INLINE_SCRIPT }} />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
