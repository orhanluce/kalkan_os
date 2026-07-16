export interface YkBeyaniData {
  tenantName: string;
  donemEtiketi: string;
  hazirlanmaTarihi: string; // ISO tarih, çağıran taraf sağlar (bu modül Date.now() kullanmaz)
  olgunlukSkoru: number;
  acikBulgularSayisi: number;
  kritikBulgularSayisi: number;
  sonSizmaTestiTarihi: string | null;
  toplamKanitSayisi: number;
  rtoSaat: number | null;
  rpoSaat: number | null;
}

function trTarih(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * YK Beyanı için tek sayfalık HTML rapor üretir (Playwright ile PDF'e
 * çevrilmek üzere). Saf fonksiyon — DOM/tarayıcı API'sine bağımlı değil,
 * bu yüzden Vitest'te doğrudan test edilebilir.
 */
export function renderYkBeyaniHtml(data: YkBeyaniData): string {
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>YK Beyanı — ${esc(data.tenantName)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #1a1a1a; margin: 48px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
  .card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.03em; }
  .card .value { font-size: 28px; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 8px 0; border-bottom: 1px solid #eee; }
  td:first-child { color: #666; width: 50%; }
  .disclaimer { margin-top: 40px; font-size: 11px; color: #999; }
</style>
</head>
<body>
  <h1>Yönetim Kurulu Beyanı — ${esc(data.tenantName)}</h1>
  <p class="subtitle">Dönem: ${esc(data.donemEtiketi)} · Hazırlanma tarihi: ${trTarih(data.hazirlanmaTarihi)}</p>

  <div class="grid">
    <div class="card">
      <div class="label">Olgunluk Skoru</div>
      <div class="value">${data.olgunlukSkoru}/100</div>
    </div>
    <div class="card">
      <div class="label">Açık Bulgular</div>
      <div class="value">${data.acikBulgularSayisi}</div>
    </div>
  </div>

  <table>
    <tbody>
      <tr><td>Kritik önem düzeyindeki açık bulgu sayısı</td><td>${data.kritikBulgularSayisi}</td></tr>
      <tr><td>Son sızma testi tarihi</td><td>${trTarih(data.sonSizmaTestiTarihi)}</td></tr>
      <tr><td>Toplam yüklenmiş kanıt sayısı</td><td>${data.toplamKanitSayisi}</td></tr>
      <tr><td>Kurtarma Süresi Hedefi (RTO)</td><td>${data.rtoSaat ?? "—"} saat</td></tr>
      <tr><td>Kurtarma Noktası Hedefi (RPO)</td><td>${data.rpoSaat ?? "—"} saat</td></tr>
    </tbody>
  </table>

  <p class="disclaimer">
    Bu belge KALKAN-OS yerel geliştirme ortamında, mock/yerel oturum verisiyle üretilmiştir —
    canlı bir Supabase projesine bağlı değildir ve resmi bir YK Beyanı olarak kullanılamaz.
  </p>
</body>
</html>`;
}
