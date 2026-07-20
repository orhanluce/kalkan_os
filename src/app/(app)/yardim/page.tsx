import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DURUM_SOZLUGU,
  HAFTALIK_RUTIN_UYUM_YONETICISI,
  KISA_CUMLELER,
  MODUL_YARDIMLARI,
  ROLLER,
  SIK_YAPILMAMASI_GEREKENLER,
} from "@/lib/yardim-icerik";

// Ana Kullanıcı Kılavuzu (Kullanıcı Kılavuzu talimatı §Eklenecek sayfalar/1).
// Sunucu bileşeni — statik içerik, tenant verisi OKUMAZ (oturumsuz erişilse
// bile hiçbir tenant bilgisi sızmaz — bu sayfa yalnız `(app)` kabuğu altında,
// yani oturum zorunlu; ayrıca oturumsuz bir yüzey AÇILMADI, bkz. §15 raporu).
export const metadata = { title: "Kullanıcı Kılavuzu — KALKAN_OS" };

export default function YardimPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kullanıcı Kılavuzu</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          KALKAN_OS&apos;u nasıl kullanacağınızı, ekranların ne işe yaradığını ve durumların ne anlama geldiğini açıklar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="contents">İçindekiler</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <nav aria-label="Yardım içeriği" className="flex flex-col gap-1 text-sm">
            <Link href="/yardim/hizli-baslangic" className="text-primary hover:underline">
              İlk kullanım (5 adımda hızlı başlangıç)
            </Link>
            {MODUL_YARDIMLARI.map((m) => (
              <a key={m.id} href={`#${m.id}`} className="text-primary hover:underline">
                {m.baslik}
              </a>
            ))}
            <a href="#roller" className="text-primary hover:underline">Kullanıcı rolleri</a>
            <a href="#durumlar" className="text-primary hover:underline">Durumların anlamı</a>
            <a href="#sss" className="text-primary hover:underline">Sık sorulan sorular</a>
            <a href="#destek" className="text-primary hover:underline">Destek ve hata bildirimi</a>
            <Link href="/yardim/sozluk" className="text-primary hover:underline">
              Sözlük
            </Link>
          </nav>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="contents">KALKAN_OS nedir?</h2></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>KALKAN_OS, kurumun siber güvenlik ve mevzuata uyum işlerini tek yerde düzenlemesine yardımcı olan bir çalışma platformudur.</p>
          <p>Kurum çalışanı açısından KALKAN_OS şunları kolaylaştırır:</p>
          <ul className="list-inside list-disc">
            <li>Hangi kurala uymanız gerektiğini görmek,</li>
            <li>Bu kuralın kurumunuz için geçerli olup olmadığını anlamak,</li>
            <li>Yapılması gereken işi doğru kişiye atamak,</li>
            <li>Kontrolün gerçekten çalışıp çalışmadığını test etmek,</li>
            <li>Kanıtları tek yerde toplamak,</li>
            <li>Eksikleri ve bulguları takip etmek,</li>
            <li>Denetçiye veya yönetime açıklanabilir rapor sunmak.</li>
          </ul>
          <p className="text-muted-foreground">
            KALKAN_OS bir hukuk bürosu, sızma testi aracı veya SIEM sistemi değildir. Kurumunuzun mevcut hukuk, bilgi teknolojileri,
            siber güvenlik, risk, denetim ve yönetim çalışmalarını aynı iş akışında birleştirir.
          </p>
        </CardContent>
      </Card>

      {MODUL_YARDIMLARI.map((m) => (
        <Card key={m.id} id={m.id} className="scroll-mt-20">
          <CardHeader>
            <CardTitle><h2 className="contents">{m.baslik}</h2></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p><span className="font-medium">Nedir?</span> {m.nedir}</p>
            <p><span className="font-medium">Ne işe yarar?</span> {m.neIseYarar}</p>
            <div>
              <p className="font-medium">Çalışan ne yapar?</p>
              <ul className="mt-1 list-inside list-disc">
                {m.neYapar.map((madde, i) => (
                  <li key={i}>{madde}</li>
                ))}
              </ul>
            </div>
            {m.dikkat ? (
              <p role="note" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {m.dikkat}
              </p>
            ) : null}
            {m.routeler.length > 0 ? (
              <div className="flex flex-wrap gap-3 border-t pt-2">
                {m.routeler.map((r) => (
                  <Link key={r.yol} href={r.yol} className="text-xs text-primary hover:underline">
                    {r.etiket} ekranına git →
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bu bölümün kendine ait bir menü ekranı yoktur — ilgili ekranlardaki “Proof Room Linki Oluştur” düğmesinden ulaşılır.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      <Card id="roller" className="scroll-mt-20">
        <CardHeader>
          <CardTitle><h2 className="contents">Kullanıcı rolleri</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 pr-4 font-medium">Rol</th>
                  <th className="py-1.5 font-medium">Temel sorumluluk</th>
                </tr>
              </thead>
              <tbody>
                {ROLLER.map((r) => (
                  <tr key={r.rol} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-medium">{r.rol}</td>
                    <td className="py-1.5 text-muted-foreground">{r.sorumluluk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card id="durumlar" className="scroll-mt-20">
        <CardHeader>
          <CardTitle><h2 className="contents">Ekranlarda kullanılan durumların anlamı</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 pr-4 font-medium">Durum</th>
                  <th className="py-1.5 font-medium">Anlamı</th>
                </tr>
              </thead>
              <tbody>
                {DURUM_SOZLUGU.map((d) => (
                  <tr key={d.durum} className="border-b last:border-0">
                    <td className="py-1.5 pr-4 font-medium">{d.durum}</td>
                    <td className="py-1.5 text-muted-foreground">{d.anlami}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="contents">Sık yapılmaması gerekenler</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc text-sm">
            {SIK_YAPILMAMASI_GEREKENLER.map((madde, i) => (
              <li key={i}>{madde}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="contents">Haftalık rutin (uyum yöneticisi için)</h2></CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-inside list-decimal text-sm">
            {HAFTALIK_RUTIN_UYUM_YONETICISI.map((madde, i) => (
              <li key={i}>{madde}</li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card id="sss" className="scroll-mt-20">
        <CardHeader>
          <CardTitle><h2 className="contents">Sık sorulan sorular</h2></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="font-medium">Bir kayıt neden “doğrulanmadı” ya da “inceleme bekliyor” görünüyor?</p>
            <p className="text-muted-foreground">
              Sistem, kaynağı veya kanıtı henüz bağımsız bir yetkili tarafından onaylanmamış hiçbir bilgiyi kesin gerçek olarak
              göstermez. Bu, bir hata değil — sistemin kasıtlı çalışma biçimidir.
            </p>
          </div>
          <div>
            <p className="font-medium">Neden kendi talebimi/kararımı onaylayamıyorum?</p>
            <p className="text-muted-foreground">
              Kritik işlemlerde hazırlayan ve onaylayan kişinin farklı olması zorunludur (bkz. sözlükte “maker-checker”). Bu bir
              yetki sorunu değil, tasarım kuralıdır.
            </p>
          </div>
          <div>
            <p className="font-medium">Denetçiye ne paylaşılıyor?</p>
            <p className="text-muted-foreground">
              Yalnızca ilgili ekrandan oluşturulan, süreli ve sınırlı bir Proof Room bağlantısı — kurumun tüm verisi değil. Bkz.
              yukarıda “Proof Room” bölümü.
            </p>
          </div>
          <div>
            <p className="font-medium">Bir kanıtın süresi dolarsa ne olur?</p>
            <p className="text-muted-foreground">
              İlgili kontrolün güvence seviyesi otomatik olarak düşürülür (“kısmi” gibi) veya yeniden inceleme gerektirir — sessizce
              “karşılanıyor” görünmeye devam etmez.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="destek" className="scroll-mt-20">
        <CardHeader>
          <CardTitle><h2 className="contents">Destek ve hata bildirimi</h2></CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Bir ekranda beklenmeyen bir davranış veya hata mesajıyla karşılaşırsanız kurumunuzun BT/uyum yöneticisiyle iletişime
            geçin; hata mesajları genellikle ne olduğunu, neden olduğunu ve ne yapmanız gerektiğini açıklar.
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {KISA_CUMLELER.map((c, i) => (
          <p key={i}>“{c}”</p>
        ))}
      </div>
    </div>
  );
}
