# PR-0 — Dikey E, E2: Proof Room Tenant Bütünlüğü + Telafi Edici Kontrol (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz onikinci talimatı — iki ardışık kapı: Kapı 1
Proof Room tenant bütünlüğü güvenlik forward-fix'i (E1'in kendi ADR §7'sinde
kayıtlı bulunan borç), Kapı 2 kritik/yüksek tedarikçi bulgusu için telafi
edici kontrol bağlantısı. Baz çizgi: `a9eb19c`/`3af2466` (Dikey E1), yeniden
yapılmıyor.

## 0. Grep sweep — bulgular

`proof_room_links`'e dokunan 11 migration, `proof_room_goruntule`'a dokunan 7
migration bulundu; GÜNCEL sürümler E1'in kendi kaydıyla (`20260720270000`/
`20260720260000`) doğrulandı, DEĞİŞMEDİ. Dört hedef tablosu da (`test_runs`,
`roi_export_runs`, `impact_graph_snapshots`, `cloud_assurance_profile_
snapshots`) kendi `tenant_id`'sini taşıyor.

`controls` **tenant-scoped DEĞİL** (çerçeveye bağlı global katalog) —
`control_test_definitions` ve `test_runs` tenant'a özgü. Bu yüzden "cross-
tenant control" kavramı `control_id`'nin kendisinde değil, seçilen
`test_run`'ın hem tenant'a hem de `control_id`'ye tutarlılığında yaşıyor.

**M16 SoD telafi edici kontrol modeli** (`sod_telafi_edici_kontroller`,
`20260718000000`) incelendi:

- **Yeniden kullanılabilir ilkeler:** (1) telafinin geçerliliği M12'nin
  `test_runs.sonuc = 'PASSED'`'ine dayanır — motor kendi test kavramını
  UYDURMAZ, mevcut M12 test motorunu REUSE eder (`sod_catisma_durum_guard`'ın
  `MITIGATED` dalıyla AYNI ilke). (2) İdempotent `pg_cron` süre-dolumu deseni
  (`kanit_suresi_dolanlari_isle`/`sod_istisna_suresi_dolanlari_isle`):
  `for update skip locked`, `current_date` bazlı, defansif `DO` bloğu (PGlite'ta
  no-op, kural: BullMQ YOK). (3) Kendi-kendine-onay yasağı trigger'da (RLS'e
  değil) zorlanır — `talep_eden != onaylayan` (E1'in bağımsız kapanışıyla AYNI
  desen). (4) Karara bağlanmış kayıt DONAR; uzatma YENİ kayıt zinciriyle
  yapılır (`onceki_istisna_id`), mevcut satır mutasyona uğratılmaz.
- **Neden `sod_telafi_edici_kontroller` DOĞRUDAN kullanılamıyor:** (a) o
  tablonun kendi maker-checker'ı YOK — `submitted_by`/`reviewed_by` alanı
  taşımıyor, güven TAMAMEN test sonucuna dayanıyor (E2 açıkça "bağımsız
  doğrulama" — telafi KAYDININ KENDİSİNİN insan tarafından incelenmesini —
  istiyor, bu SoD modelinde YOK); (b) `conflict_id`'ye (iç görev ayrılığı
  çatışması) FK'lı — yanlış alan, tedarikçi bulgusuyla hiçbir ilişkisi yok;
  (c) geçerlilik penceresi kavramı YOK (`gereken_siklik_gun` bir TEKRAR
  SIKLIĞI, `valid_from`/`valid_until` gibi sabit bir onay penceresi değil).
  Kurucunun kendi talimatı da bunu doğruluyor ("aynı isim diye kullanma").
- **`sod_istisnalari`** yapısal olarak (talep_eden/onaylayan/başlangıç/bitiş/
  durum) E2'nin istediğine daha yakın ama o da YANLIŞ DOMAIN (istisna =
  kuralı ATLAMA, telafi edici kontrol = kuralı BAŞKA bir kontrolle
  KARŞILAMA) — kopyalanmadı, yalnız ŞEKLİ ilke (maker-checker + pencere)
  ayrı bir tabloda yeniden üretildi.
- **Tedarikçi bulgusunun bağlanacağı mevcut kayıtlar:** `controls` (madde) +
  `control_test_definitions` (tenant'ın test tanımı) + `test_runs` (M12'nin
  gerçek koşusu, `sonuc`/`evidence_id` taşır) — YENİ bir test altyapısı
  AÇILMADI, aynen SoD'nin kendi kararı gibi.
- **`assessment_tamamla_guard()`'ın tam davranışı** (`20260719100000`,
  DEĞİŞMEDİ, bkz. §7): `third_party_assessments.durum = 'TAMAMLANDI'`
  geçişini yalnız o assessment'a bağlı `assessment_findings.ciddiyet =
  'KRITIK' AND durum <> 'KAPANDI'` satırı VARSA reddeder.
- **`YUKSEK` bulgu için mevcut davranış:** GUARD YOK — `assessment_tamamla_
  guard()` yalnız `KRITIK`'i kontrol eder, `YUKSEK` sign-off'u hiç
  ETKİLEMEZ. Bu davranış E2'de KORUNUYOR (§9).
- **`KRITIK` bulgu için mevcut davranış:** açık (KAPANDI olmayan) tek bir
  `KRITIK` bulgu bile `TAMAMLANDI`'yı MUTLAK engeller — istisna yok.

## 1. Kapı 1 kararı — merkezi `proof_room_link_target_guard()`

E1'in kendi ADR'sinde kayıtlı borç doğrulandı: `test_run_id`/`roi_export_
run_id`/`graph_snapshot_id` hiçbir zaman FK-hedef tenant doğrulaması
görmedi — yalnız satırın kendi `tenant_id`'si RLS'le korunuyordu.
`cloud_assurance_profile_id` için E1'de dar bir guard (`20260720270000`)
eklenmişti; bu turda o dar guard KALDIRILDI ve YERİNE dört hedefi TEK
fonksiyonda doğrulayan merkezi bir guard kondu — kurucunun "ayrı ve tekrar
eden trigger oluşturma" şartı gereği.

`proof_room_link_target_guard()`: `before insert or update`, her doğrulanan
hedef için AYNI şekil — `if new.X is not null then hedef tablo var mı VE
tenant_id = new.tenant_id mi` kontrolü, yoksa `raise exception`. Dördü de
TEK fonksiyonda, dördü de INSERT VE UPDATE'te (hedef alanı sonradan
değiştirme ihtimaline karşı). `security definer` + trigger — RLS'e değil
trigger'a dayanır, `service_role` dahil atlanamaz.

## 2. Kapı 1 — tarihsel tarama sonucu
Bkz. §14 (rapor gövdesi) — canlı veri salt-okur tarandı, DEĞİŞTİRİLMEDİ.

## 3. Kapı 2 model kararı — Seçenek A (dar ilişki tablosu)

`assessment_finding_compensating_controls`, kurucunun önerdiği alan setine
yakın, tenant-scoped, `assessment_findings`/`controls`/`test_runs`'a FK'li.
**Seçenek B reddedildi:** repoda bu semantiği taşıyan genel bir "exception/
compensating" tablosu yok (`policy_lifecycle`'ın `exceptions`'ı POLİTİKA
istisnası, farklı domain). **Seçenek C reddedildi:** §0'da gerekçeli.

Karar ölçütleri: tek kaynak (M12 test_runs REUSE, yeni test altyapısı yok),
semantik doğruluk (yanlış domain'e FK yok), RLS+tenant (own_tenant deseni),
maker-checker (submitted_by≠reviewed_by, DB trigger'da), expiry (idempotent
cron, SoD'nin AYNI deseni), audit (INSERT/UPDATE audit_log), gelecek
genişleme (vendor/cloud/fourth-party — tablo yalnız `assessment_finding_id`
FK'li, M16'ya HİÇ bağımlı değil).

## 4. Durum makinesi ve immutable alanlar

`TASLAK → INCELEMEDE → AKTIF | REDDEDILDI`; `AKTIF → SURESI_DOLDU |
IPTAL_EDILDI`; `TASLAK/INCELEMEDE → IPTAL_EDILDI`. Terminal durumlar
(`REDDEDILDI`/`SURESI_DOLDU`/`IPTAL_EDILDI`) DONAR — hiçbir geçiş kabul
etmez. **AKTIF olmuş bir kayıtta `control_id`/`test_run_id`/`valid_from`/
`valid_until`/`gerekce` bir daha DEĞİŞTİRİLEMEZ** — uzatma/değişiklik YENİ
kayıt (`onceki_id` zinciri, SoD istisna uzatmasının AYNI deseni) ister.

`INCELEMEDE → AKTIF` şartları (§9 talimatındaki liste birebir DB guard'ında
zorlanır): `reviewed_by IS NOT NULL`, `reviewed_by != submitted_by`, kimlik
atfı (`auth.uid()` doluysa `reviewed_by` ona eşit olmalı), `test_run.sonuc =
'PASSED'`, `test_run.tenant_id = new.tenant_id`, `test_run.control_id =
new.control_id`, kanıt güncelliği (`evidences.gecerlilik_bitis` doluysa
`>= current_date`), `valid_until > current_date`, bağlı bulgu hâlâ
`KAPANDI` değil. **"Kaynak yalnız PROVIDER_ATTESTATION olamaz" ve "UNKNOWN
olumlu kabul edilemez" şartları YAPISAL OLARAK zaten karşılanıyor** —
`test_run_id` zorunlu FK'si M12'nin GERÇEK test koşusuna (`sonuc` beş ayrı
durumdan yalnız `PASSED`) bağlıyor, Cloud Pack'in `PROVIDER_ATTESTATION`
kaynaklı bir cevabına asla değil; bu yüzden tabloya ayrı bir `kaynak_turu`
kolonu EKLENMEDİ (yapının kendisi zaten dışlıyor, çift bir alan uydurma
güvence katmadan karmaşıklık ekler).

## 5. Sign-off kararı — dar hesaplanmış etiket (Seçenek "Alternatif")

`third_party_assessments.durum`'a `KOSULLU_GUVENCE` EKLENMEDİ.
**`assessment_tamamla_guard()` ve `third_party_assessments` şeması
DOKUNULMADAN kalıyor** — KRITIK bulgu sign-off'u bugün olduğu gibi MUTLAK
engellemeye devam ediyor, hiçbir bypass yolu AÇILMADI.

Gerekçe: yeni enum değeri; `assessment_tamamla_guard()` forward-fix'i
(üretimde çalışan bir invariant'a dokunmak); `third_party_assessments_
ledger_outbox_enqueue` trigger'ının WHEN yan tümcesini yeniden düşünmek;
`bulguOzeti()` (saf fonksiyon, "Tamamla" düğmesini süren) davranış
değişikliği; İKİ ayrı UI yüzeyi (`/tedarikciler/[id]` kurum görünümü VE
`/tedarikci-erisim/[token]` tedarikçi görünümü) — toplam etki kurucunun
kendi "aşırı riskli" eşiğini geçiyor. Kurucunun kendi §5 gereken cümlesi
zaten SADECE BULGU hakkında ("Bulgu açık kalmaktadır...") — assessment
sign-off'undan hiç bahsetmiyor; bu, dar etiketin metinsel olarak da doğru
seçim olduğunu doğruluyor.

`KRITIK_BULGU_TELAFI_ALTINDA` yalnız HESAPLANMIŞ bir çıktı —
`cloud-assurance.ts`'nin `genelDurum` birleşimine YENİ bir değer olarak
eklendi (mevcut `ENGELLENDI`'nin YERİNE, yalnız TÜM açık KRITIK bulgular
GEÇERLİ+AKTİF bir telafiyle kaplıysa; kaplanmamış bir KRITIK bulgu kalırsa
hâlâ `ENGELLENDI`). Snapshot JSONB'ye eklendi (şema sürümü V2), DB CHECK
kısıtı DEĞİŞMEDİ.

## 6. Bilinçli kapsam dışı (kurucunun kendi listesi, korunuyor)
RTO/RPO zinciri; yapılandırılmış SLA/IAM/yedekleme alanları; fourth-party
değişiklik bildirimi; sözleşme düzeyi graph granülerliği; SCITT bağlantısı;
KMS/JWS/TSA; hukuk/AI sağlayıcısı seçimi; tedarikçi riskine sayısal skor;
bulgunun telafi yoluyla otomatik kapanması; telafinin kendi kendine onayı;
dış saldırı/hack-back.
