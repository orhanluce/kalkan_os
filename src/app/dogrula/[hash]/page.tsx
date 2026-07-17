"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

// Bağımsız doğrulama — OTURUMSUZ çalışır (rapordaki QR'ı okutan denetçinin
// hesabı yoktur). paylasim/[token] ile aynı desen.
//
// BU SAYFA RAPORUN İÇERİĞİNİ GÖSTERMEZ VE GÖSTERMEMELİ (M9 kabul kriteri:
// "QR doğrulama hassas veri sızdırmıyor"). Söylediği tek şey: "elindeki
// belgenin rapor hash'i, mühürlenmiş kayıtla eşleşiyor mu?". Puanı, kurumu
// veya senaryoyu buraya eklemek, hash'i ele geçiren herkese o bilgiyi
// açardı — doğrulama bunu gerektirmiyor.
//
// Veri minimizasyonu istemcide DEĞİL veritabanında: manifest_dogrula RPC'si
// zaten yalnızca beş alan döndürür (bkz. 20260717180000). Burası bir filtre
// değil, görüntüleyici — filtre istemcide olsaydı ağ sekmesini açan herkes
// fazlasını görürdü.

interface DogrulamaVerisi {
  report_data_hash: string;
  muhurlendi_at: string;
  durum: string;
  saglayici: string | null;
  anchored_at: string | null;
}

function trTarihSaat(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DogrulamaPage() {
  const params = useParams<{ hash: string }>();
  const [veri, setVeri] = useState<DogrulamaVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    async function yukle() {
      const db = createClient();
      const { data } = await db.rpc("manifest_dogrula", { target_hash: params.hash });
      setVeri((data as DogrulamaVerisi[] | null)?.[0] ?? null);
      setYukleniyor(false);
    }
    void yukle();
  }, [params.hash]);

  if (yukleniyor) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-muted-foreground">Doğrulanıyor…</p>
      </main>
    );
  }

  // BULUNAMADI: "hash yok" ile "görme yetkin yok" ayrımı yapılmaz, çünkü
  // burada yetki diye bir şey yok — RPC de boş döner.
  if (!veri) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Doğrulanamadı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Bu karekod veya adres, mühürlenmiş bir tatbikat sonucuna karşılık gelmiyor.
            </p>
            <p className="text-muted-foreground">
              Bu, belgenin sahte olduğu anlamına gelebileceği gibi, adresin eksik
              kopyalandığı anlamına da gelebilir. Elinizdeki raporda yazan manifest
              hash&apos;iyle aşağıdaki değeri karşılaştırın.
            </p>
            <p className="break-all font-mono text-xs">{params.hash}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const sabitlendi = veri.durum === "sabitlendi";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-emerald-700">Mühür geçerli</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Bu adres, KALKAN-OS tarafından mühürlenmiş bir tatbikat sonucuna karşılık
            geliyor. Aşağıdaki <strong>rapor verisi hash&apos;i</strong>, elinizdeki
            raporda yazan değerle aynıysa rapor mühürlendiği andan bu yana
            değiştirilmemiştir.
          </p>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Rapor verisi hash (SHA-256)
            </div>
            <p className="break-all font-mono text-xs">{veri.report_data_hash}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Mühürlenme</dt>
              <dd>{trTarihSaat(veri.muhurlendi_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sabitleme durumu</dt>
              <dd>{sabitlendi ? "Sabitlendi" : "Beklemede"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sabitleme zamanı</dt>
              <dd>{trTarihSaat(veri.anchored_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sağlayıcı</dt>
              <dd>{veri.saglayici ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-xs text-muted-foreground">
          <p>
            <strong>Bu sayfa raporun içeriğini göstermez.</strong> Yalnızca mührün
            varlığını ve rapor hash&apos;ini bildirir; puan, kurum ve senaryo bilgisi
            bilinçli olarak paylaşılmaz.
          </p>
          <p>
            Sabitleme sağlayıcısı <em>yerel append-only</em> kayıttır: mühür bu sistemin
            kendi kaydına dayanır, bağımsız bir üçüncü taraf zaman damgası (RFC 3161)
            değildir. Yani &quot;bu kayıt değiştirilmemiş&quot; der; &quot;bu tarihi
            bağımsız bir taraf onayladı&quot; demez.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
