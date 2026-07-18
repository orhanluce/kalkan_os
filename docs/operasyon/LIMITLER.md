# Kaynak Limitleri ve Kullanım Ölçümü (M16 üretim kapanışı)

**Tarih:** 18 Temmuz 2026 · service_role ile salt-okur ölçüldü (canlı proje).

## 1. Ölçülen kullanım (pilot ölçek)

| Kaynak | Ölçüm | Not |
|---|---|---|
| tenants / profiles | 2 / 3 | pilot + e2e kiracısı |
| controls / tenant_controls | 17 / 34 | seed'li kontrol kütüphanesi |
| evidences | 0 | (e2e temizliği sonrası) |
| findings / audit_log | 2 / 14 | |
| sod_import_onizlemeleri / manifestleri / rollbacklari | 36 / 23 / 11 | e2e birikimi |
| sod_outbox | 57 | drenaj DONE + tetik olayları (temizlik borcu, aşağıda) |
| simulation_runs | 4 | |
| Storage (evidence bucket) | 24 nesne / ~840 bayt | içerik-adresli; küçük e2e dosyaları |
| pg_cron | 1 iş (`kalkan-sure-dolumu`, `*/5`, active) | duplicate yok |

## 2. Değerlendirme
- Veri hacmi pilot ölçekte önemsiz — Supabase free/pro limitlerinin çok altında.
- **Bağlantı:** uygulama @supabase/ssr (istek başına kısa ömürlü); script'ler
  session pooler. Bağlantı sızıntısı gözlenmedi; pool doygunluğu pilotta risk
  değil. Ölçek büyürken transaction pooler + pool-boyut ayarı gözden geçirilir.
- **RLS-ağır sorgu:** `/sod` panosu 7 paralel sorgu çeker; pilot satır sayısında
  (<100) sorun yok. Büyük tenant'ta `sod_atamalari`/`sod_catismalari` sayfalama
  gerektirir (bugün `/sod/atamalar` 500 satır sınırı DÜRÜSTÇE gösteriliyor).

## 3. Temizlik borcu (izlenecek)
- `sod_outbox`: DONE olaylar birikiyor (57 kayıt). İşlevsel sorun değil (drenaj
  yalnız PENDING'e bakar) ama ileride bir retention işi (ör. 90 günden eski DONE
  olayları arşivle/sil) gerekir — pg_cron'a eklenebilir. **Şimdilik borç.**
- e2e import kayıtları (`sod_import_*`) canlı e2e kiracısında birikiyor;
  fixture temizliği bunları silmiyor (SoD import tabloları setup-e2e-fixtures
  temizlik listesinde değil). Küçük; izlenir.

## 4. Ölçüm tekrarı
Bu tablo her üretim kapısı gözden geçirmesinde yenilenir (salt-okur script,
kalıcı iz bırakmaz). Büyüme trendi görülürse retention + sayfalama önceliklenir.
