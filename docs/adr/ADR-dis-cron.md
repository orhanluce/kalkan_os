# ADR — Dış Cron / Değerlendirme Drenaj Tetiği (KARAR AÇIK: K2)

**Bağlam:** SoD değerlendirmesi motoru TS'te (canonicalHash → pg_cron TS
koşamaz). Atama/kural değişimi ve import apply, outbox'a `SOD_YENIDEN_
DEGERLENDIR`/`SOD_ATAMALARI_*` olayı yazar (transactional). Bu olayların bir
DRENAJLA işlenmesi gerekir. Bugün drenaj: `/sod` sayfası açılışında oto-drenaj
+ manuel buton. Eksik: kimse UI'ı açmazsa değerlendirme gecikebilir (V2 hedefi:
"resmî değişiklikten doğrulanmış etki <24 saat" — SoD için de düzenli tetik iyi).

**Karar gereği (kurucu):** üç seçenekten biri.

## Seçenek A — pg_cron + pg_net → route (servis token'lı uç)
- pg_cron her N dakikada `/api/sod/outbox/isle`'ı `pg_net`'le POST eder.
- **Yeni güvenlik yüzeyi:** route'un servis-token doğrulaması gerekir (bugün
  admin/uyum oturumu ister; token'lı bir varyant açılmalı). Token .env'de.
- Artı: mevcut drenaj mantığını yeniden kullanır (tek motor). Eksi: yeni
  auth yüzeyi + Hostinger'a giden dış çağrı.

## Seçenek B — Supabase Edge Function (schedule)
- Edge Function zamanlı çalışıp drenaj rotasını (veya doğrudan sodDegerlendir'i
  Deno'da) tetikler.
- Artı: Supabase içinde kalır. Eksi: motoru Deno'ya taşımak = ikinci motor
  riski (kural 11 "tek kaynak") VEYA yine route'a çağrı = A ile aynı token
  yüzeyi. Edge Function bugün repo'da hiç yok (yeni altyapı).

## Seçenek C — Mevcut oto-drenaj yeterli (yeni altyapı yok)
- `/sod` açılışı + buton yeterli kabul edilir; SoD değerlendirmesi kullanıcı
  panosu açtığında tazelenir.
- Artı: sıfır yeni yüzey, sıfır token. Eksi: kimse paneli açmazsa gecikme;
  "otomatik" değil.

## Öneri (bağlayıcı değil)
Pilot ölçek için **C** yeterli; ilk gerçek müşteride **A** (servis-token'lı uç,
pg_cron `*/15`). B yalnız başka Edge ihtiyaçları doğarsa. Karar kurucuya:
- **K2 = A / B / C?**
- A/B seçilirse: servis token nasıl saklanır (mevcut `.env` deseni) + route'a
  token doğrulama eklenir (ayrı küçük PR, güvenlik testli).

Bu ADR karar verilene dek **C fiilen yürürlükte** (oto-drenaj canlıda).
