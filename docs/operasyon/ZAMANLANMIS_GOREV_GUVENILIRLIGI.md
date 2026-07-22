# Zamanlanmış Görev Güvenilirliği ve Operasyonel İzlenebilirlik (K2)

**Tarih:** 22 Temmuz 2026 · **Durum:** Repo-içi kısım `K2_LOCAL_READY`,
canlı doğrulama `K2_LIVE_VALIDATION_PENDING`. Tam mimari analiz:
`docs/adr/PR0-K2-kritik-zamanlanmis-gorev-guvenilirligi-2026-07-22.md`.

Bu belge, `ledger_outbox` (kanıt zinciri kuyruğu) ile ilgili günlük
operasyon sorularının kısa cevaplarını taşır.

## 1. Job backlog nasıl kontrol edilir

```sql
select public.ledger_outbox_saglik_ozeti();
```
Oturumunuz `platform_operator` ise TÜM tenant'ların toplamını
(`kapsam: "GLOBAL"`), değilse yalnız kendi tenant'ınızın özetini
(`kapsam: "TENANT"`) döner. Dönen alanlar: `pendingSayisi`,
`staleProcessingSayisi`, `processingSayisi`, `failedSayisi`,
`enEskiPendingYasSaniye`, `jobTuruBazinda`.

Alarm eşikleri (`src/lib/ledger-outbox-saglik.ts`, kod sabiti):
pending 30 dakikadan eskiyse, 1+ stale-PROCESSING varsa, 1+ FAILED varsa,
veya pending sayısı bir önceki ölçümden +20 sıçradıysa — bunlar
`ledgerOutboxAlarmDegerlendir()` ile değerlendirilir (harici alarm servisi
YOK, bu turda yalnız yerel/kod-seviyesi).

## 2. Stale PROCESSING nasıl teşhis edilir

`staleProcessingSayisi > 0` ise bir işlem 5 dakikadan uzun süre
`PROCESSING`'de kalmış — normal drenaj döngüsünde bu OTOMATİK olarak
`PENDING`'e döner (`ledger_outbox_claim` her çağrıda önce bunu yapar),
elle müdahale GEREKMEZ. Sürekli tekrar ediyorsa (aynı kayıt defalarca
stale oluyorsa) drenaj sürecinin (route/worker) kendisi hatalı/yavaş demektir
— `son_hata` sütununu kontrol edin.

## 3. Manuel retry ne zaman yapılır

Bir kayıt `FAILED` (dead-letter, 5 deneme tükendi) olduğunda ve kök neden
DÜZELTİLDİĞİNDE (örn. geçici bir bağlantı sorunu geçtiyse):
```sql
select public.ledger_outbox_manual_retry('<outbox-id>');
```
Yalnız `admin`/`uyum` rolü çağırabilir. `deneme_sayisi` sıfırlanır, taze bir
5-deneme bütçesiyle `PENDING`'e döner. Audit izi otomatik düşer
(`outbox_kaydi_manuel_yeniden_denendi`). İkinci bir paralel çağrı (kayıt
artık `FAILED` olmadığı için) no-op'tur — yanlışlıkla iki kez tetiklemek
zararsızdır.

## 4. Hangi hata retry edilmemeli

Kök nedeni **yapılandırma/wiring eksikliği** olan hatalar (örn. "Artefakt
turu icin manifest kurulamadi" — bu artefakt türü için `ledger-outbox.ts`'te
henüz bir `manifestKur` dalı yok) retry ile KENDİLİĞİNDEN düzelmez —
kod değişikliği gerekir. Bu sınıf otomatik olarak `ledger_outbox_mark_
failed_terminal` ile TEK denemede `FAILED`'e düşer (5 hak beklenmez).
Geçici hatalar (ağ zaman aşımı, imzalama servisi anlık kullanılamaz) normal
`ledger_outbox_mark_failed` ile 5 hakka kadar otomatik yeniden denenir —
bunlara ELLE müdahale GEREKMEZ, kendiliğinden düzelirse akış devam eder.

## 5. Duplicate risk nasıl kontrol edilir

```sql
select tenant_id, hedef_tablo, hedef_id, detay
from audit_log
where eylem = 'olasi_orphan_leaf_tespit_edildi'
order by created_at desc;
```
Boş dönmesi beklenir (uygulama katmanındaki idempotency ön-kontrolü bunu
neredeyse hiç oluşturmaz — bkz. ADR §6). Satır varsa: o `hedef_id`
(artefakt) için Merkle ağacında bağlanmamış bir "orphan leaf" var demektir
— **SİLİNMEZ** (immutable defter), yalnız operatör bilgilendirilir. Domain
kaydının (test_runs vb.) kendisi ETKİLENMEZ, yalnız o BELİRLİ imzalama
denemesi ziyan olmuştur.

## 6. Consumer güvenli biçimde nasıl durdurulur/açılır

```sql
-- Durdur (yalnız platform_operator):
update public.ledger_outbox_ayarlari set consumer_etkin = false where id = 1;

-- Aç:
update public.ledger_outbox_ayarlari set consumer_etkin = true where id = 1;

-- Durumu oku (herkes):
select consumer_etkin, degistiren, updated_at from public.ledger_outbox_ayarlari where id = 1;
```
Kapalıyken `ledger_outbox_claim()` HİÇBİR satır claim etmez — bekleyen
kayıtlar `PENDING` olarak GÜVENLE bekler, kaybolmaz.

## 7. Restore sonrası outbox neden varsayılan kapalıdır

K1 kararı 5 (`docs/operasyon/YEDEKLEME_GERI_YUKLEME.md` §6.0): restore
edilmiş bir hedefte cron/worker/consumer varsayılan KAPALI başlamalı —
backup anında `PENDING`/`PROCESSING` kalan kayıtların OTOMATİK claim
edilip yeniden işlenmesi, restore doğrulaması TAMAMLANMADAN istenmeyen bir
davranıştır (bkz. K1 ADR §10, "restore güven sınırı"). **Somut adım:**
her restore provasının İLK işlemi `consumer_etkin = false` yapmak olmalı —
doğrulama (§9 K1 test matrisi) TAMAMLANDIKTAN SONRA bilinçli olarak açılır.

## 8. Kanıt paketi için hangi metrikler kaydedilir

Bir K2 canlı doğrulama/incident sonrası kanıt paketine: doğrulama
zamanı, `ledger_outbox_saglik_ozeti()` çıktısı (öncesi/sonrası), kaç kayıt
manuel retry edildi (id listesi, hata YOK), orphan-leaf tespit sayısı
(varsa), kill-switch durumu (açık/kapalı, kim değiştirdi), Git commit SHA,
migration head.

## 9. İncident sırasında hangi secret/log bilgileri paylaşılmaz

- `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`
  hiçbir zaman incident kaydına/chat'e/log'a yazılmaz.
- `ledger_outbox.son_hata` ve `audit_log.detay` payload/PII İÇERMEZ
  (yalnız artefakt kimliği + hata özeti) — ama yine de dış paylaşımdan önce
  gözden geçirin, connector'lar geldiğinde bu alan genişleyebilir.
- `ledger_outbox_saglik_ozeti()`'nin `GLOBAL` kapsamı tasarım gereği
  tenant kimliği taşımaz — ama `TENANT` kapsamlı çıktı KENDİ tenant'ınıza
  aittir, başka bir tenant'la paylaşılmamalı.
