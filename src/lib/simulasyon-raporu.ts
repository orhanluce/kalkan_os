// Simülasyon raporu HTML'i (docs/ROADMAP.md M9). Playwright ile PDF'e çevrilir.
//
// SAF FONKSİYON: Date.now(), DOM veya dış çağrı yok — her şey parametreyle
// gelir. yk-beyani.ts'teki desenin aynısı; Vitest'te doğrudan test edilebilir.
//
// NE BASAR VE NEDEN: raporun gövdesi ReportData'dan gelir ve ReportData'nın
// hash'i (reportDataHash) çekirdek manifestin içinde mühürlüdür. Yani buraya
// ReportData DIŞINDAN bir olgu basmak, mühürlenmemiş bir iddia basmak
// demektir — hash'i bozmadan değiştirilebilir. Yeni bir alan eklemek
// istiyorsan önce ReportData'ya ekle (bkz. kurumAdi gerekçesi).
//
// İKİ İSTİSNA bilinçli: coreManifestHash ve QR. Bunlar raporun İÇERİĞİ değil,
// raporun nasıl doğrulanacağının adresi — mührün kendisi mühürlenemez.
//
// BURAYA pdfFileHash VEYA packageManifestHash BASILMAZ: ikisi de bu PDF
// üretildikten SONRA doğar (bkz. simulation-manifest.ts'teki üretim sırası).
// Bir belge kendi hash'ini içeremez.

import type { ReportData } from "./simulation-manifest";

export interface SimulasyonRaporuData {
  veri: ReportData;
  /** Çekirdek manifest hash'i — QR'ın işaret ettiği ve doğrulamanın anahtarı olan değer. */
  coreManifestHash: string;
  /** ReportData'nın hash'i. Denetçi bunu manifest_dogrula'nın döndürdüğüyle karşılaştırır. */
  reportDataHash: string;
  /** QR'ın data: URL'i. Çağıran üretir (qrcode kütüphanesi async'tir, bu modül saf kalsın). */
  qrDataUrl: string;
  /** QR'ın çözüldüğünde gideceği adres — insan da okuyabilsin diye ayrıca basılır. */
  dogrulamaUrl: string;
  /** Mühür sabitlendi mi ('sabitlendi' | 'beklemede'). */
  muhurDurumu: string;
  anchorSaglayici: string | null;
  /** JWS imza anahtarı kimliği (kid). İmzasız (eski) manifestte null. */
  imzaKid: string | null;
  /** İmzalayıcı kimliği ('local-dev-es256' / 'kms-...'). local-dev-* production değildir. */
  imzalayici: string | null;
}

const DURUM_ETIKET: Record<string, string> = {
  BASARILI: "Başarılı",
  KISMI: "Kısmi",
  BASARISIZ: "Başarısız",
  CRITICAL_FAILURE: "Kritik başarısızlık",
};

const SATIR_ETIKET: Record<string, string> = {
  gecti: "Geçti",
  kaldi: "Kaldı",
  uygulanamadi: "Uygulanamadı",
};

const MOD_ETIKET: Record<string, string> = {
  canli: "Canlı (yönetimli)",
  zamanli: "Zamanlı",
  hizlandirilmis: "Hızlandırılmış demo",
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function dakika(d: number | null): string {
  return d === null ? "—" : `${d} dk`;
}

export function renderSimulasyonRaporuHtml(data: SimulasyonRaporuData): string {
  const v = data.veri;

  // TATBİKAT ETİKETİ — kural 9. Bir uyum ürününde tatbikat raporunun gerçek
  // bir olay raporuyla karışması felakettir; etiket her sayfanın başında.
  const hizlandirilmisUyari =
    v.mod === "hizlandirilmis"
      ? `<p class="uyari">Bu tatbikat HIZLANDIRILMIŞ modda oynanmıştır (SIMULATED_ACCELERATED):
         süre ölçümleri gerçek zamanlı bir olaya karşılık gelmez.</p>`
      : "";

  const kritikBloku =
    v.kritikBasarisizliklar.length > 0
      ? `<div class="kritik">
           <div class="kritik-baslik">Kritik başarısızlık</div>
           <ul>${v.kritikBasarisizliklar.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>
           <p class="kritik-not">Zorunlu bir aksiyon eksik olduğu için genel puandan bağımsız
           olarak sonuç kritik başarısızlıktır.</p>
         </div>`
      : "";

  const satirlar = v.satirlar
    .map(
      (s) => `<tr>
        <td>${esc(s.kod)}</td>
        <td class="s-${esc(s.sonuc)}">${esc(SATIR_ETIKET[s.sonuc] ?? s.sonuc)}</td>
        <td class="num">${s.puan} / ${s.agirlik}</td>
      </tr>`,
    )
    .join("");

  const aksiyonlar = v.aksiyonlar
    .map(
      (a) => `<tr>
        <td>${esc(a.kod)}</td>
        <td>${a.tamamlandi ? "Tamamlandı" : "Tamamlanmadı"}</td>
        <td class="num">${dakika(a.dakika)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Tatbikat Raporu — ${esc(v.senaryoKodu)} — ${esc(v.kurumAdi)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 40px; }
  .tatbikat-etiket {
    display: inline-block; background: #b45309; color: #fff; font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; padding: 4px 10px; border-radius: 4px; margin-bottom: 12px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
  .subtitle { color: #666; font-size: 13px; margin: 0 0 24px; }
  .uyari { background: #fef3c7; border-left: 3px solid #b45309; padding: 8px 12px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
  .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.03em; }
  .card .value { font-size: 28px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 11px; color: #666; text-transform: uppercase; padding: 6px 0; border-bottom: 1px solid #ddd; }
  td { padding: 7px 0; border-bottom: 1px solid #eee; }
  td.num { text-align: right; white-space: nowrap; }
  .s-gecti { color: #15803d; }
  .s-kaldi { color: #b91c1c; }
  .s-uygulanamadi { color: #999; }
  .kritik { border: 1px solid #b91c1c; background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin-top: 16px; }
  .kritik-baslik { color: #b91c1c; font-weight: 700; font-size: 13px; }
  .kritik ul { margin: 8px 0; padding-left: 18px; font-size: 12px; }
  .kritik-not { font-size: 11px; color: #7f1d1d; margin: 4px 0 0; }
  .muhur { margin-top: 32px; border-top: 2px solid #1a1a1a; padding-top: 16px; display: flex; gap: 20px; }
  .muhur-qr img { width: 116px; height: 116px; }
  .muhur-bilgi { font-size: 11px; color: #444; }
  .hash { font-family: "SF Mono", Consolas, monospace; font-size: 9.5px; word-break: break-all; color: #1a1a1a; }
  .hash-label { color: #666; margin-top: 6px; }
  .disclaimer { margin-top: 24px; font-size: 10px; color: #999; line-height: 1.5; }
</style>
</head>
<body>
  <div class="tatbikat-etiket">TATBİKAT — GERÇEK OLAY DEĞİLDİR</div>
  <h1>Tatbikat Raporu — ${esc(v.senaryoKodu)} ${esc(v.senaryoAdi)}</h1>
  <p class="subtitle">
    ${esc(v.kurumAdi)} · ${esc(v.tatbikatAdi)} · Şablon sürümü ${v.sablonSurum} ·
    Mod: ${esc(MOD_ETIKET[v.mod] ?? v.mod)}<br />
    Başlangıç: ${trTarihSaat(v.basladiAt)} · Bitiş: ${trTarihSaat(v.bittiAt)}
  </p>
  ${hizlandirilmisUyari}

  <div class="grid">
    <div class="card">
      <div class="label">Genel Puan</div>
      <div class="value">${v.puan}/100</div>
    </div>
    <div class="card">
      <div class="label">Sonuç</div>
      <div class="value">${esc(DURUM_ETIKET[v.durum] ?? v.durum)}</div>
    </div>
  </div>
  ${kritikBloku}

  <h2>Puanlama satırları</h2>
  <table>
    <thead><tr><th>Kural</th><th>Sonuç</th><th class="num">Puan</th></tr></thead>
    <tbody>${satirlar}</tbody>
  </table>

  <h2>Beklenen aksiyonlar</h2>
  <table>
    <thead><tr><th>Aksiyon</th><th>Durum</th><th class="num">Senaryo dakikası</th></tr></thead>
    <tbody>${aksiyonlar}</tbody>
  </table>

  <h2>Bulgu önerileri</h2>
  <p style="font-size:12px;color:#444;margin:0;">
    Bu tatbikattan ${v.oneriSayisi} bulgu önerisi üretildi. Öneriler PROPOSED durumunda doğar;
    bir yetkili kabul etmeden gerçek bulguya dönüşmez.
  </p>

  <div class="muhur">
    <div class="muhur-qr"><img src="${data.qrDataUrl}" alt="Doğrulama karekodu" /></div>
    <div class="muhur-bilgi">
      <strong>Bağımsız doğrulama</strong><br />
      Karekodu okutun veya şu adrese gidin:<br />
      <span class="hash">${esc(data.dogrulamaUrl)}</span>
      <div class="hash-label">Çekirdek manifest hash (SHA-256)</div>
      <div class="hash">${esc(data.coreManifestHash)}</div>
      <div class="hash-label">Rapor verisi hash (SHA-256)</div>
      <div class="hash">${esc(data.reportDataHash)}</div>
      <div class="hash-label">
        Mühür durumu: ${data.muhurDurumu === "sabitlendi" ? "Sabitlendi" : "Beklemede"}${
          data.anchorSaglayici ? ` · Sağlayıcı: ${esc(data.anchorSaglayici)}` : ""
        }
      </div>
      ${
        data.imzaKid
          ? `<div class="hash-label">İmza (JWS ES256) · anahtar: ${esc(data.imzaKid)}</div>`
          : `<div class="hash-label">İmza: yok (bu manifest imza öncesi mühürlendi)</div>`
      }
    </div>
  </div>

  <p class="disclaimer">
    Doğrulama sayfası bu raporun içeriğini göstermez; yalnızca yukarıdaki rapor verisi
    hash'inin mühürlenmiş kayıtla eşleşip eşleşmediğini söyler. Rapor verisi hash'i,
    PDF dosyasının BAYTLARININ değil, raporda yer alan verinin RFC 8785 kanonik
    temsilinin SHA-256'sıdır — bu yüzden PDF yeniden üretildiğinde de aynı kalır.
    <br />
    Sabitleme sağlayıcısı yerel append-only kayıttır: mühür bu sistemin kendi kaydına
    dayanır, bağımsız bir üçüncü taraf zaman damgası (RFC 3161) DEĞİLDİR.
    ${
      data.imzalayici && data.imzalayici.startsWith("local-dev")
        ? `<br />İmza bir GELİŞTİRME anahtarıyla atılmıştır (${esc(data.imzalayici)}): imza
           hattının bütünlüğünü gösterir, production authenticity''si taşımaz. Ayrıca
           nitelikli elektronik imza veya kurumsal e-mühür yerine geçmez.`
        : data.imzalayici
          ? `<br />İmza nitelikli elektronik imza/e-mühür yerine geçmez; sistem bütünlüğü
             ve paket kaynağı ispatı içindir.`
          : ""
    }
    <br />
    Senaryo içeriği UNVERIFIED_SAMPLE'dır: örnek amaçlıdır, doğrulanmış bir mevzuat
    eşlemesi değildir.
  </p>
</body>
</html>`;
}
