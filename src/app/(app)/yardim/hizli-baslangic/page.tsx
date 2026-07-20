import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HIZLI_BASLANGIC_ADIMLARI } from "@/lib/yardim-icerik";

export const metadata = { title: "Hızlı Başlangıç — KALKAN_OS" };

export default function HizliBaslangicPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hızlı Başlangıç</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          İlk kez giriş yaptıysanız, KALKAN_OS&apos;un temel akışını 5 adımda tanıyın.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {HIZLI_BASLANGIC_ADIMLARI.map((adim) => (
          <li key={adim.sira}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <h2 className="contents">
                    <span
                      aria-hidden
                      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    >
                      {adim.sira}
                    </span>
                    {adim.baslik}
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">{adim.aciklama}</p>
                <Link href={adim.route} className="text-xs text-primary hover:underline">
                  Bu adımı şimdi uygula →
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Link href="/yardim" className="text-sm text-primary hover:underline">
        ← Tam Kullanıcı Kılavuzu&apos;na dön
      </Link>
    </div>
  );
}
