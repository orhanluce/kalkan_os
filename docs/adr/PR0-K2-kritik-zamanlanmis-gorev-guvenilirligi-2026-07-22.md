# ADR — K2: Kritik Zamanlanmış Görev Güvenilirliği ve Operasyonel İzlenebilirlik

**Tarih:** 22 Temmuz 2026
**Durum:** REPO-İÇİ KISIM UYGULANDI — **K2_LOCAL_READY** (canlı Supabase
smoke/cron doğrulaması AYRI, sonraki bir onay ister — §17). Bu turda
production/staging Supabase'e bağlanılmadı, Supabase MCP kullanılmadı,
pg_cron canlıda değiştirilmedi, production migration çalıştırılmadı, deploy
yapılmadı, gerçek e-posta gönderilmedi, secret okunmadı/yazılmadı. K1
durumu (ayrı, açık operasyonel borç) DEĞİŞMEDİ.

## 1. Bağlam

Önceki oturumların (Dikey K, K1) bulgusu doğrulandı: `ledger_outbox`
kayıtlarını güvenilir biçimde tüketen üretim cron/consumer sözleşmesi
GERÇEKTEN eksikti — bugün drenaj yalnız ROUTE-TETİKLİ (kullanıcı bir işlem
yaptığında `ledgerOutboxDrain` senkron çağrılır) veya manuel butonla olur;
hiçbir pg_cron işi `ledger_outbox`'u kendi başına drenaj etmez (`docs/adr/
ADR-dis-cron.md`, "K2 = A/B/C?" — bugün fiilen **C** yürürlükte). Bu ADR o
boşluğu KAPATMAZ (dış tetik kararı hâlâ AÇIK, §17) ama ALTINDAKİ modeli
(idempotency, claim, retry, görünürlük) production-hazır hâle getirir —
dış tetik (A/B/C) HANGİSİ seçilirse seçilsin AYNI güçlendirilmiş modele
konuşacak.

## 2. Kritik iş envanteri (repo gerçekliği, dosya referanslarıyla)

### Sınıf 1 — Ledger/transparency outbox (BU ADR'nin ana odağı)

| Alan | Değer |
|---|---|
| İş adı | `ledger_outbox` drenajı |
| Tetikleyici | Route-tetikli (`ledgerOutboxDrain` çağıran ~6 route) + manuel (`/api/seffaflik/outbox/isle`) |
| Tenant kapsamı | `current_tenant_id()` ile TEK tenant — claim/kill-switch bunun üzerine |
| Girdi tablosu | `ledger_outbox` (10 farklı artefakt türünden trigger'la beslenir — `test_runs`, `dsar_fulfillment_packages`, +8 diğeri `ledger-outbox.ts`'in `manifestKur` dispatch'inde) |
| Çıktı/yan etki | `transparency_ledger_entries` + `artifact_ledger_links` |
| Idempotency | `unique(artifact_table, artifact_id)` (outbox VE link tablosunda) — **ZAYIF NOKTA: `transparency_ledger_entries`'in kendisinde YOK** (§6) |
| Retry davranışı | `deneme_sayisi`, 5. denemede FAILED (mevcut) |
| Başarısızlık görünürlüğü | `durum='FAILED'` sorgulanabilir ama TOPLU görünürlük YOKTU (§7'de eklendi) |
| Stale-job davranışı | 5 dk PROCESSING → PENDING (mevcut, `ledger_outbox_claim`) |
| Kritiklik | YÜKSEK — kanıt zincirinin bütünlüğü buna bağlı |
| Mevcut test kapsamı | `rls-ledger-outbox.test.ts` (9 test) — RLS+idempotent enqueue+claim+mark |
| Eksik koruma (bu ADR'de kapatıldı) | orphan-leaf görünürlüğü, terminal-hata kısayolu, kill-switch, manuel retry, sağlık özeti |

### Sınıf 2 — Manifest/immutable artefakt üretimi

Ayrı bir "iş" DEĞİL — Sınıf 1'in `manifestKur` dispatch'inin bir parçası
(aynı outbox satırı, aynı drenaj). DSAR paketi, TPR sign-off, AI olay/
receipt kapanışı, YK beyanı attestation, RoI export, kurtarma ölçümü/
karşılaştırması — hepsi AYNI `ledger_outbox` satırından, AYNI güvenilirlik
katmanından geçer. Ayrı bir envanter maddesi olarak SAYILMAZ (kural: mevcut
model, yeni bir tane değil).

### Sınıf 3 — Snapshot üretimi (impact_graph, cloud_assurance, kritik_hizmet_test_paketi)

| Alan | Değer |
|---|---|
| Tetikleyici | Kullanıcı eylemiyle SENKRON (route içinde INSERT) — zamanlanmış/kuyruklu DEĞİL |
| Retry/idempotency | Uygulanamaz — istek başarısız olursa kullanıcı tekrar dener, kuyruk YOK |
| Kritiklik | Orta — ama zamanlanmış bir iş SINIFI değil, bu ADR'nin kapsamı DIŞINDA |

### Sınıf 4 — Auth/onboarding ile ilişkili zamanlanmış işler

`tenant_provisioning` durum makinesi GUARD-tetiklidir (insan eylemiyle geçiş
yapar), bir CRON'u YOKTUR. **Gerçek zamanlanmış işler** (pg_cron, 9 adet,
hepsi "süre-dolumu süpürme" deseninde — Sınıf 1'den TAMAMEN FARKLI bir
şekil, kuyruk/consumer değil, periyodik durum-geçiş taraması):

| Cron adı | Sıklık | İşlev |
|---|---|---|
| `kalkan-sure-dolumu` | */5 dk | SoD istisna + kanıt süre-dolumu |
| `kalkan-tpr-sozlesme-dolumu` | günlük 02:30 | Tedarikçi sözleşme süre-dolumu |
| `kalkan-policy-sure-dolumu` | günlük 02:15 | Politika istisna süre-dolumu |
| `kalkan-iddia-yeniden-inceleme` | günlük 04:00 | Assurance claim yeniden inceleme |
| `kalkan-roi-export-yeniden-inceleme` | günlük 05:00 | DORA RoI export yeniden inceleme |
| `kalkan-egitim-periyot-yenile` | günlük 03:00 | Eğitim periyodu yenileme |
| `kalkan-e2-telafi-suresi-dolumu` | */5 dk | Telafi edici kontrol süre-dolumu |
| `kalkan-tedarikci-anket-suresi-dolumu` | */5 dk | Tedarikçi anket süre-dolumu |

Bu 9 iş, KENDİ tabloları içinde `FOR UPDATE SKIP LOCKED` + per-row
`EXCEPTION` izolasyonu kullanan, TEK BAŞINA idempotent (`WHERE durum =
'onaylandi'` gibi guard'lar — ikinci koşu bulacak bir şey bulamaz)
fonksiyonlardır. **Bu ADR'de DOKUNULMADI** — zaten sağlam, ayrı bir
sorun sınıfı (kuyruk değil, süpürme), yeniden mühendislik gerektirmiyor.

### Sınıf 5 — Bildirim/e-posta işleri

**Bugün kuyruklu bir e-posta işi YOK.** Supabase Auth e-postaları (davet/
reset) SENKRON gönderilir (`db.auth.admin.inviteUserByEmail` doğrudan route
içinde), bir outbox/kuyruk'tan GEÇMEZ. K1'in SMTP kapanışı bunu zaten
doğruladı. Bu sınıf için bugün EK bir güvenilirlik katmanı gerekmiyor.

### Sınıf 6 — Gelecekte connector polling için ortak scheduler altyapısı

Henüz YOK (Entra ID Connector MVP K1/K2/mevzuat/pilot kapıları kapanmadan
başlamıyor — CLAUDE.md kural 20/25). **Bu ADR'nin ürettiği kill-switch +
sağlık özeti + manuel retry deseni**, ileride bir connector-polling
scheduler'ı kurulduğunda AYNI `ledger_outbox` desenini (yeni bir tablo
DEĞİL, yeni bir `statement_kind`/`artifact_table` girişi) kullanabilir —
şimdiden bunun için bir hazırlık YAPILMADI, yalnız YOL AÇIK bırakıldı.

## 3. Ortak job sözleşmesi kararı — YENİ GENEL QUEUE TABLOSU KURULMADI

Talimattaki asgari alan listesi (`id`, `tenant_id`, `job_type`, `status`,
`attempt_count`, `lease_expires_at`, vb.) değerlendirildi. **Karar: mevcut
`ledger_outbox` GÜÇLENDİRİLDİ, yeni bir genel queue tablosuna
TAŞINMADI.** Gerekçe:

- `ledger_outbox` zaten bu alanların ÇOĞUNU taşıyor (`tenant_id`,
  `statement_kind`≈`job_type`, `artifact_table`+`artifact_id`≈`payload
  referansı`, `durum`≈`status`, `deneme_sayisi`≈`attempt_count`,
  `islenme_at`≈`claimed_at`/lease izleme, `son_hata`≈`last_error_summary`).
- Sınıf 4'ün 9 cron işi FARKLI bir şekle (süpürme, kuyruk değil) sahip —
  onları AYNI queue tablosuna zorlamak MEVCUT, ÇALIŞAN, TEST EDİLMİŞ kodu
  gereksiz yere kırma riski taşırdı (kural: "mevcut tabloları gereksiz
  yere genel queue tablosuna taşımaya çalışma").
- Sınıf 5 (e-posta) bugün kuyruklu değil — genelleştirilecek bir şey yok.

**Eklenenler additive'dir** (§4-§7), `ledger_outbox`/`artifact_ledger_links`
şemasının YAPISI değişmedi (kolon eklenmedi bile — yalnız YENİ tablo +
YENİ fonksiyonlar).

## 4. Claim/lease/idempotency semantiği

Değişmedi (zaten sağlamdı, testle doğrulandı): `FOR UPDATE SKIP LOCKED`
race-safe claim, `tenant_id`-scoped (cross-tenant karışma imkânsız —
`current_tenant_id()` her sorguya girer), 5 dakikalık lease + otomatik
stale-reclaim, `unique(artifact_table, artifact_id)` çift kayıt engeli.
**Yeni:** kill-switch kontrolü `claim()`'in en başına eklendi — kapalıyken
sıfır satır claim edilir (K1 kararı 5'in somut mekanizması).

## 5. Retry ve dead-letter yaklaşımı

- Exponential backoff: **YOK, bilinçli** — mevcut model sabit-aralıklı
  retry kullanıyor (drenaj her route-çağrısında/manuel butonda tetiklenir,
  zamanlanmış bir backoff mekanizması yok). Bu ADR bunu EKLEMEDİ — dış
  tetik kararı (§1, ADR-dis-cron.md) netleşmeden bir backoff zamanlaması
  kurmak erken olurdu.
- Maksimum retry: 5 (mevcut, sabit).
- Retry edilebilir/edilemez ayrımı: **YENİ** — `ledger_outbox_mark_failed_
  terminal` RPC'si (AYRI isim, mevcut `ledger_outbox_mark_failed`
  DOKUNULMADI — §6 açıklıyor neden DROP+yeniden-imza YOLU seçilmedi).
  Manifest builder eksikliği (wiring hatası, retry ile düzelmez) bu yeni
  yola yönlendirildi (`ledger-outbox.ts`).
- Dead-letter görünürlüğü: **YENİ** — `ledger_outbox_saglik_ozeti()`
  `failedSayisi` alanı.
- Manuel retry audit: **YENİ** — `ledger_outbox_manual_retry` RPC'si,
  admin/uyum-gated, audit_log yazar.
- Paralel manuel retry engeli: **YENİ** — `WHERE durum = 'FAILED'` guard'ı
  doğal olarak sağlıyor (ikinci çağrı 0 satır günceller, no-op).

## 6. Ledger için özel korumalar — orphan-leaf

**Bulgu (Dikey K'nın önceki tespitiyle aynı sınıf, bu turda test EDİLEREK
doğrulandı):** `ledger_outbox_mark_processed`'in `artifact_ledger_links`
insert'i `ON CONFLICT (artifact_table, artifact_id) DO NOTHING` kullanır —
crash-retry sonrası AYNI artefakt için FARKLI bir `ledger_entry_id` ile
ikinci kez çağrılırsa, outbox satırı yine PROCESSED'e döner (davranışsal
yakınsama SAĞLANIR) ama YENİ imzalanan `transparency_ledger_entries` satırı
HİÇBİR ZAMAN bağlanmaz — Merkle ağacına dahil olmuş, ama hiçbir domain
artefaktına geri-referanslı olmayan bir "orphan leaf" olarak kalır.

**Çözüm — İKİ katman:**
1. **Önleme (uygulama seviyesi, `ledger-outbox.ts`):** drenaj, YENİ bir
   statement imzalamadan ÖNCE `artifact_ledger_links`'te bu artefakt için
   ZATEN bir bağlantı olup olmadığını kontrol eder; varsa YENİDEN
   imzalamaz, doğrudan mevcut `ledger_entry_id` ile `mark_processed`'e
   yakınsar. Bu, orphan-leaf'in neredeyse tamamını ÖNLER.
2. **Görünürlük (DB seviyesi, `mark_processed`):** önleme katmanı bir
   yarış durumunda atlanırsa (teorik olarak mümkün — iki AYRI oturumun TAM
   olarak aynı anda önleme kontrolünü geçmesi), `mark_processed` artık
   FARKLI bir `ledger_entry_id` tespit ettiğinde `audit_log`'a
   `olasi_orphan_leaf_tespit_edildi` yazar (silme YOK — immutable deftere
   dokunulmaz, yalnız İZ bırakılır). Test: `rls-ledger-outbox-k2.test.ts`.

**Neden DROP+recreate ile 3-parametreli `mark_failed` YAPILMADI (§5):**
PGlite test harness'i (`helpers/pg.ts`) TÜM migration dosyalarındaki
`revoke ... on function` satırlarını, migration'lar bittikten SONRA tekrar
uygular. Bir fonksiyonun imzasını DROP+CREATE ile değiştirmek, ESKİ
migration dosyasındaki (dokunulmayan, dokunulMAmalı) revoke satırını STALE
bırakır — o satır artık var olmayan bir imzayı hedefler, patlama.
**Genel ders (bu ADR'nin kalıcı katkısı):** bu repo'da mevcut bir RPC'nin
İMZASINI (parametre sayısı/tipi) DEĞİŞTİRMEK yerine YENİ, AYRI isimli bir
fonksiyon eklemek TERCİH EDİLMELİ — eski migration'ların revoke/grant
satırları sonsuza dek geçerli kalır.

- Backup anındaki PENDING outbox: DEĞİŞMEDİ — restore sonrası normal akışla
  işlenir (K1 kararı 5, kill-switch İLE korunuyor artık — restore hedefinde
  `consumer_etkin=false` yapılırsa hiçbiri otomatik claim edilmez).
- Duplicate anchor riski: yukarıdaki önleme+görünürlük ikilisi kapsıyor.
- "Consumer error ≠ FAILED kanıt": veri seviyesinde test edildi
  (`rls-ledger-outbox-k2.test.ts`, son describe bloğu) — `ledger_outbox`
  hatası `test_runs.sonuc`'a HİÇ dokunmuyor, iki kayıt tamamen bağımsız.

## 7. Operasyonel görünürlük

`ledger_outbox_saglik_ozeti()` — salt-okur, `SECURITY DEFINER`:
- Normal kullanıcı (admin/uyum): yalnız KENDİ tenant'ının özeti
  (`kapsam: "TENANT"`).
- `platform_operator`: TÜM tenant'ların TOPLAMI (`kapsam: "GLOBAL"`) —
  hiçbir tenant kimliği, kullanıcı e-postası, evidence içeriği veya payload
  DÖNMEZ, yalnız sayılar (test: `JSON.stringify(veri)` iki tenant id'sini
  de İÇERMEDİĞİ doğrulandı).
- Alanlar: `pendingSayisi`, `staleProcessingSayisi`, `processingSayisi`,
  `failedSayisi`, `enEskiPendingYasSaniye`, `jobTuruBazinda` (statement_kind
  → adet).

## 8. Alarm eşikleri (kod sabiti, harici servis YOK)

`src/lib/ledger-outbox-saglik.ts` → `LEDGER_OUTBOX_ESIKLERI` +
`ledgerOutboxAlarmDegerlendir()` (saf fonksiyon, kural 11 deterministik):
pending yaş eşiği (30dk), processing lease (5dk, bilgi amaçlı — claim'in
KENDİ davranışını değiştirmez), maksimum deneme (5), failed-alarm eşiği
(1+), stale-processing alarm eşiği (1+), backlog-sıçraması eşiği (+20,
önceki ölçüm verilirse). 5 alarm kodu: `ESKI_PENDING`, `STALE_PROCESSING`,
`FAILED_BACKLOG`, `BACKLOG_SICRAMASI`, `CONSUMER_HIC_CALISMAMIS`. Harici
alarm servisi entegrasyonu bu turda YAPILMADI — yalnız ölçülebilir durum +
runbook (§11, `docs/operasyon/ZAMANLANMIS_GOREV_GUVENILIRLIGI.md`).

## 9. Migration güvenliği

Tek migration: `20260722070000_ledger_outbox_guvenilirlik.sql`. Additive:
1 yeni tablo (`ledger_outbox_ayarlari`, tek satır, `default true`), 3 yeni
fonksiyon (`ledger_outbox_mark_failed_terminal`, `ledger_outbox_manual_
retry`, `ledger_outbox_saglik_ozeti`), 2 `CREATE OR REPLACE` (`claim`,
`mark_processed` — AYNI imza, davranış SADECE eklemeli genişledi). Mevcut
2 kayıt üzerinde hiçbir `ALTER`/`DROP` YOK. RLS: yeni tablo `select`
authenticated-geneli, `update` yalnız `platform_operator`. Unique constraint
eklenmedi (mevcut ikisi zaten yeterliydi). **Production'a UYGULANMADI** —
yalnız repo dosyası; PGlite'a karşı test edildi (19+9+10 test yeşil).

## 10-11. Runbook

`docs/operasyon/ZAMANLANMIS_GOREV_GUVENILIRLIGI.md` (YENİ) — backlog
kontrolü, stale-PROCESSING teşhisi, manuel retry ne zaman, hangi hata retry
edilmemeli, duplicate riski kontrolü, consumer güvenli açma/kapama
(`ledger_outbox_ayarlari`), restore sonrası neden varsayılan kapalı (K1
çapraz referansı), kanıt paketi metrikleri, incident sırasında paylaşılmayacak
bilgiler.

## 12. Kabul kriterleri — durum

- [x] Kritik iş envanteri çıkarıldı (§2).
- [x] Claim atomik ve testli (§4, mevcut + yeni testler).
- [x] Retry/backoff/terminal failure tanımlı (§5) — backoff YOK (bilinçli, §5).
- [x] Stale job recovery testli (§4).
- [x] Ledger duplicate/orphan koruması testli (§6).
- [x] Tenant izolasyonu testli (§7, §4).
- [x] Minimize edilmiş operasyon görünürlüğü mevcut (§7).
- [x] Runbook hazır (§10-11).
- [x] unit/PGlite/RLS testleri yeşil (1687 + 19 + 10 = 1716, `pnpm exec vitest run`).
- [x] typecheck, lint, build yeşil.
- [x] Canlı cron etkinleştirilmediği açıkça kayıtlı (bu belge + runbook).

**Sonuç: `K2_LOCAL_READY`.** Canlı Supabase cron/consumer smoke testi
yapılmadığı için K2'nin TAMAMI kapalı sayılmaz (§17).

## 13. Değişen/eklenen dosyalar

- `supabase/migrations/20260722070000_ledger_outbox_guvenilirlik.sql` (yeni)
- `src/lib/ledger-outbox.ts` (idempotency ön-kontrolü + terminal hata yolu)
- `src/lib/ledger-outbox-saglik.ts` (yeni, alarm eşikleri + saf değerlendirici)
- `src/lib/supabase/database.types.ts` (3 yeni RPC tipi — elle eklendi,
  canlı `pnpm db:types` bu turda ÇALIŞTIRILAMADI, kapsam dışı)
- `src/lib/__tests__/rls-ledger-outbox-k2.test.ts` (yeni, 19 test)
- `src/lib/__tests__/ledger-outbox-saglik.test.ts` (yeni, 10 test)
- `scripts/smoke-ozel-smtp.ts` (ilgisiz, önceden var olan bir typecheck
  hatası bu turda düzeltildi — build'i yeşile çıkarmak için gerekliydi)
- `docs/operasyon/ZAMANLANMIS_GOREV_GUVENILIRLIGI.md` (yeni runbook)
- `docs/ROADMAP.md`, `docs/DEVAM.md` (bu ADR'ye işaret)

## 14. Açık kurucu kararları

Bu turda YENİ bir açık karar İCAT EDİLMEDİ — asıl açık karar zaten
`ADR-dis-cron.md`'de duruyor (K2 dış tetik = A/B/C?). Bu ADR'nin ürettiği
altyapı HANGİ seçenek verilirse verilsin aynı şekilde çalışır; dış tetik
kararı hâlâ kurucuyu bekliyor, bu turda VERİLMEDİ.

## 15. Kod dışı/canlı işlem yapılmadığının teyidi

Production/staging Supabase'e bağlanılmadı, Supabase MCP kullanılmadı,
pg_cron canlıda değiştirilmedi, migration production'a UYGULANMADI, deploy
yapılmadı, Hostinger/DNS/SMTP dokunulmadı, gerçek e-posta gönderilmedi,
production secret okunmadı/yazılmadı, K1 durumuna dokunulmadı, connector
kodu yazılmadı.

## 16. Bu turda hiçbirinin gerçekleşmediği "dur ve karar iste" durumları

Kontrol edildi, hiçbiri çıkmadı: mevcut üretim verisini dönüştüren
destructive migration YOK, ledger hash/JWS formatı DEĞİŞMEDİ, Proof Room
doğrulaması KIRILMADI, yeni harici servis ihtiyacı YOK, ücretli servis/plan
gereksinimi YOK, production secret ihtiyacı YOK, canlı Supabase erişimi
ihtiyacı YOK.

## 17. Canlı doğrulama için sonraki adım — **K2_LIVE_VALIDATION_PENDING**

K2'nin repo-içi kısmı `K2_LOCAL_READY`, ama TAMAMI şunlar OLMADAN kapalı
sayılmaz:
1. Migration production'a uygulanır (`pnpm db:push`) — kurucunun açık
   onayını ister (bu ADR'nin KENDİSİ bu onayı VERMEZ).
2. `ledger_outbox_ayarlari`, `ledger_outbox_manual_retry`, `ledger_outbox_
   saglik_ozeti` canlıda GERÇEK bir smoke ile doğrulanır (script-YAZ-VE-SİL
   deseni, F5/G1 emsali — `docs/operasyon/YEDEKLEME_GERI_YUKLEME.md`'nin
   K1 durumundaki AYNI "canlı erişim gerektirir, Claude YÜRÜTEMEZ" sınırı
   burada da geçerli).
3. K2'nin GERÇEK açık kararı (`ADR-dis-cron.md`, dış tetik A/B/C) kurucu
   tarafından verilir — bu ADR'nin ürettiği altyapı o karardan BAĞIMSIZ
   çalışır ama seçim hâlâ bekliyor.
