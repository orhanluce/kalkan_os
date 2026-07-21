-- Dikey F, F5 hazırlık — kurucu Karar D (docs/adr/PR0-dikeyF-f5-kurtarma-
-- karsilastirmasi-2026-07-21.md): `measured_at` yaşam döngüsü düzeltmesi.
--
-- BUGÜNE KADAR: UI `measured_at` hiç göndermiyordu, route sessizce
-- `recorded_at`'e düşürüyordu (route.ts, F4). Canlıda doğrulandı: tek TRRM
-- kaydında `hizmet_geri_geldi_at=09:00` iken `measured_at=recorded_at=
-- (form gönderim anı)` — "ölçümün gerçekleştiği an" ile "formun gönderildiği
-- an" birbirine karışmıştı. Bu forward-fix DB seviyesinde iki invariant ekler
-- (motor katmanında recovery-measurement.ts'e AYNI iki kural zaten eklendi —
-- savunma derinliği, tek sözleşme):
--   1) measured_at, recorded_at'ten makul olmayan ölçüde ileri olamaz (gelecek
--      zamana ayarlanamaz) — 5 dk tolerans, motorun GELECEK_TOLERANS_DK'sıyla
--      BİREBİR aynı.
--   2) Kesinti olay zamanları mevcutsa (hizmet_geri_geldi_at dolu), measured_at
--      o ana EŞİT olmalı (route bunu server-side türetir; DB bunu ayrıca
--      zorlar) — motorun OLCUM_ZAMANI_TUTARSIZ kuralıyla birebir aynı.
--
-- NOT VALID (bilinçli): canlıda F4 e2e/smoke debris'i olan TEK kayıt
-- (id=49aaa6c2-...) bu ikinci kuralı ihlal ediyor (measured_at != hizmet_geri_
-- geldi_at, ÇÜNKÜ o kayıt bu forward-fix'ten ÖNCE, eski route mantığıyla
-- yazıldı). Kayıt append-only bir e2e fixture kiracısına ait, immutable
-- (UPDATE edilemez) — geriye dönük "düzeltilemez" ve SİLİNMEZ (kural: veri
-- uydurulmaz/gizlenmez). `NOT VALID` bu TEK geçmiş satırı sessizce ATLAR
-- (Postgres onu taramaz) ama BUGÜNDEN İTİBAREN HER YENİ INSERT/UPDATE'İ
-- KOŞULSUZ ZORLAR — geriye dönük veri kirletme YOK, ileriye dönük gevşeklik
-- YOK. Bilinen istisna açıkça buradadır, gizlenmemiştir.

alter table public.test_run_recovery_measurements
  add constraint trrm_measured_at_gelecek_degil
  check (measured_at <= recorded_at + interval '5 minutes')
  not valid;

alter table public.test_run_recovery_measurements
  add constraint trrm_measured_at_olay_tutarli
  check (hizmet_geri_geldi_at is null or measured_at = hizmet_geri_geldi_at)
  not valid;
