# ADR — Dikey F, F4: Kurtarma Ölçümü Yakalama ve Provenance Katmanı

**Tarih:** 21 Temmuz 2026
**Durum:** KABUL EDİLDİ (kurucu "Kararlarım" — bu belge onları yansıtır)

## 1. Bağlam

F3 kapandı: onaylı etki toleransı (`impact_tolerances`, HEDEF eşiği) test
paketinde görünür ama **nicel karşılaştırma yapılmadı** — çünkü `test_runs`'ta
ölçülen gerçek kesinti/veri-kaybı için YAPISAL bir alan yok. Bir denetim
keşfi (Explore) bunu doğruladı: `baslangic_at`/`bitis_at` testin ÇALIŞMA
(wall-clock) penceresidir, kurtarma penceresi DEĞİL (üstelik UI ikisine de
`now` yazıyor — `kontrol-test-bolumu.tsx:302-306`); `RESTORE_TEST` bir `tur`
değeri ama kendine özel hiçbir kolon/mantık yok.

F4, gerçek nicel karşılaştırmadan ÖNCE gelmesi gereken adımdır: **ölçülen
gerçek kurtarma verisinin güvenilir, immutable ve kanıtlı biçimde kaydı.**

## 2. İşin özü: "güvenilir" = provenance

Bir insanın elle girdiği "4 saat" bir ölçüm değil, **beyandır.** Proje
omurgası bu ayrımı zaten yapıyor (`evidences.tip` beyan/dosya, `FULL_ENVELOPE`
vs `LEGACY_FILE_HASH_ONLY`, `signer_ad=local-dev` uyarısı, F3'ün
`karsilastirmaYapildi:false`). Bu yüzden ölçüm kaydı bir **güvenilirlik
katmanı** taşır ve gelecekteki karşılaştırma motoru beyanı ölçüm gibi sunamaz.

## 3. Depolama (Karar 1)

**Ayrı, immutable tablo: `test_run_recovery_measurements`.** `test_runs`'a
kolon EKLENMEZ (mevcut immutable yapı korunur; ölçüm koşu satırından SONRA
netleşebilir). `execution_legal_snapshots` deseni: koşuya FK + kanonik
snapshot + immutable trigger. Düzeltme = yeni INSERT + `supersedes_measurement_
id` soyu; eski kayıt fiziksel korunur. "Güncel" TÜRETİLİR (kimse supersede
etmemişse güncel), stored bayrak yok. Soy LİNEER: her kayıt en fazla bir kez
supersede edilir (partial unique index).

## 4. Ne kaydedilir (Karar 2)

Birincil veri **ham olay zamanları**; süreler SUNUCUDA türetilir (istemci
süresine güvenilmez → Postgres `generated always as` kolonları):
- Kesinti: `kesinti_baslangic_at` → `hizmet_geri_geldi_at` ⇒ `olculen_kesinti_saat` (generated)
- Veri kaybı: `son_tutarli_veri_at` → `kurtarma_noktasi_at` ⇒ `olculen_veri_kaybi_saat` (generated)

Süre-yalnız beyan da desteklenir ama AÇIKÇA beyan olarak: `beyan_kesinti_saat`,
`beyan_veri_kaybi_saat`. Kurallar (DB CHECK + guard):
- Ham zaman ile aynı olgu için süre-yalnız beyan BİRLİKTE gönderilemez (`girdi_modu` ayrımı).
- `NULL` ≠ sıfır; negatif süre reddedilir; başlangıç ≤ bitiş; veri kaybı penceresi ≥ 0.
- Birim kalıcı sözleşmede açıkça **SAAT**; UI saat/dakika biçimleyebilir, kanonik değer değişmez.

## 5. Güvenilirlik katmanı (Karar 3)

İki katman şemada: `MANUEL_BEYAN`, `OTOMATIK_OLCUM`.
- **MANUEL_BEYAN**: MVP kullanıcı formundan; zorunlu beyan eden + kayıt zamanı +
  girdi biçimi + açık uyarı + tercihen kanıt. UI/Proof Room: "Bu kayıt kullanıcı
  beyanıdır; otomatik sistem ölçümü değildir." Kanıt eklenmesi beyanı ölçüme
  DÖNÜŞTÜRMEZ.
- **OTOMATIK_OLCUM**: şema + DB kuralları hazır, ama normal formdan SEÇİLEMEZ —
  yalnız güvenilir sunucu (service_role) INSERT edebilir. Zorunlu: `source_system`,
  `source_event_id`, `evidence_id`, olay zamanları, (mümkünse) kaynak payload
  hash. **DB guard sahte yükseltmeyi engeller**: `auth.role() <> 'service_role'`
  iken `OTOMATIK_OLCUM` reddedilir. Bu dilimde gerçek connector geliştirilmez →
  fiilen üretilen kayıtlar MANUEL_BEYAN olur; ama otomatik katmanın güvenlik
  sözleşmesi şimdiden kurulur. `TANIKLI_BEYAN` bu dilimde EKLENMEZ.

## 6. Karşılaştırma motoru (Karar 4)

Bu dilim karşılaştırma motoruna KESİNLİKLE dokunmaz. "RTO/RPO karşılandı",
"tolerans içinde/aşıldı", "hedef sağlandı", sayısal güven skoru — üretilmez.
`impact_tolerances` ölçüm tablosuna BAĞLANMAZ, hedef değer snapshot'a
KOPYALANMAZ. `comparisonPerformed: false` (payload'da her zaman).

## 7. Ölçüm snapshot sözleşmesi

Şema: `WARDPROOF_TEST_RUN_RECOVERY_MEASUREMENT_V1`. Payload (kurucu sözleşmesi,
`src/lib/recovery-measurement.ts` `TestRunRecoveryMeasurement`): testRunId,
measurementId, measurementSource, inputMode, outage{startedAt/restoredAt/
declaredHours/derivedHours}, dataLoss{lastConsistentDataAt/recoveryPointAt/
declaredHours/derivedHours}, provenance{evidenceId/sourceSystem/sourceEventId/
sourcePayloadHash/declarantPresent}, supersedesMeasurementId, measuredAt,
recordedAt, comparisonPerformed:false. **Ham kullanıcı UUID'si ve PII Proof
Room payload'ında YER ALMAZ** (declarantPresent boolean; ham `beyan_eden`
dönmez).

## 8. İmmutability + kanıt (ayrık olgular)

`UPDATE`/`DELETE` service_role dahil reddedilir (ELS deseni). Kanıt zinciri:
canonical JSON → RFC 8785 `canonicalHash` → JWS (`ManifestSigner`) → ledger
outbox → SCITT anchor (generic `ledger_outbox_enqueue_trg`,
`RECOVERY_MEASUREMENT` kind). **Ledger durumu ile ölçüm kaynağı AYRI olgulardır:**
`OTOMATIK_OLCUM` = verinin nasıl üretildiği; JWS/SCITT = kaydın değiştirilmediği.
İmza/ledger başarısızlığı bir kaydı "otomatik ölçüm"e YÜKSELTMEZ.

## 9. Proof Room

Ölçüm bir test koşusuna bağlıdır. Proof Room'un MEVCUT `test_run_id` dalı
İLİŞKİSEL genişletilir (güncel kurtarma ölçümü minimize özet olarak eklenir) —
**altıncı polimorfik hedef AÇILMAZ** (F3'ün "gereksiz yeni dal açma" dersi).
Minimize: kaynak/mod/süreler/birim + "bu bir beyandır" uyarısı; ham
`beyan_eden` UUID'si YOK.

## 10. Bilinçli kapsam dışı

RTO/RPO karşılaştırması, `impact_tolerances` tüketimi, başarı/aşım hükmü,
sayısal güven skoru, M8 dakikalarıyla birleştirme, connector geliştirme,
test-run manifest mutasyonu, otomatik ölçüm yokken otomatik etiket üretme,
`TANIKLI_BEYAN`. Gerçek nicel karşılaştırma AYRI bir sonraki dikey.
