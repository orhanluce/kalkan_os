# ADR — Dikey K: Enterprise Readiness ve Otomatik Kanıt Altyapısı Analizi

**Tarih:** 22 Temmuz 2026
**Durum:** KEŞİF / KODSUZ ANALİZ — kurucu onayı bekliyor. Migration yok,
connector kodu yok, Microsoft Graph çağrısı yok, OAuth uygulaması yok,
secret oluşturma yok, UI yok, cron yok, canlı Supabase değişikliği yok.
Bu belge yalnızca üç paralel repo-araştırma turunun (evidence-control
modeli, test/manifest/ledger/Proof Room hattı, güvenlik/secret/tenant
izolasyonu) senteziyle üretilmiş bir mimari karar taslağıdır.

**Dikey J ile ilişki:** Dikey J (`PR0-dikeyJ-otomatik-kanit-toplama-
2026-07-22.md`) otomatik kanıt toplamanın YEDİ KATMANLI mimarisini
(Kurumsal Sistemler→Connector Layer→Evidence Collector→Kontrol Eşleştirme→
Test Motoru→Kriptografik Kanıt Zinciri→Proof Room) tanımladı ve son dört
katmanın zaten üretimde olduğunu gösterdi. **Dikey K, Dikey J'yi
GENİŞLETMEZ, DERİNLEŞTİRİR** — aynı yedi katmanı, gerçek şema/kod
kanıtlarıyla (migration satır numaraları, fonksiyon imzaları) tekrar
inceler, üç somut mimari alternatif arasında bir öneri üretir, Entra ID
MVP'sini Microsoft'un resmî belgeleriyle somutlaştırır ve OAuth/secret/
scheduler/ticari-değer boyutlarını ekler. Dikey J'nin ADR'si YÜRÜRLÜKTEN
KALKMAZ — Dikey K onu düzeltir/derinleştirir (bkz. §3.6 "Dikey J'ye
düzeltmeler"). **Enterprise Readiness şemsiyesi altında connector mimarisi
TEK belgede (bu ADR + Dikey J) yaşar — üçüncü bir isim açılmadı.**

---

## 1. Kapsam ve başlangıç repo durumu

Bu görevde kod YAZILMADI. Aşağıdaki analiz, bu oturumda çalıştırılan üç
paralel, salt-okur repo araştırmasının (grep sweep + hedefli dosya okuma)
sentezidir. WardProof bugün (§ kullanıcının bağlam listesiyle DOĞRULANDI):

- Kritik hizmet yönetimi, kontrol testleri, bulgu/düzeltici-faaliyet/retest
  zinciri, Proof Room, immutable snapshot/manifest, RFC 8785 canonical
  hash, JWS+Merkle şeffaflık defteri, RTO/RPO ölçüm+karşılaştırma, AI
  Güvence yönetişimi, kontrollü pilot provisioning, tenant izolasyonu/RLS/
  maker-checker/audit — HEPSİ üretimde, gerçek migration'larla doğrulandı.
- Gerçek connector YOK. AI model çağrısı YOK (AI Güvence, müşterinin AI
  sistemlerini yönetişime alır — WardProof kendisi AI çağırmaz). Blockchain
  YOK (kriptografik şeffaflık defteri + Merkle doğrulama var).

**Değiştirilemeyecek öncelik sırası (kural 20, bu görevde AYNEN korundu):**
özel SMTP → K1 staging+restore provası → K2 kritik zamanlanmış görev
güvencesi → hukukça doğrulanmış ilk mevzuat paketi → ilk kontrollü pilot →
pilot geri bildirimi → kanıt kaynak modeli güçlendirme → Entra ID Connector
MVP → M365/Azure/AWS genişlemesi → billing/self-servis → kontrollü yardımcı
AI. **Connector kodu ilk pilot ve geri bildirim TAMAMLANMADAN başlamaz.**

---

## 2. Grep sweep sonuçları — istenen terimlerin gerçek karşılıkları

Talep edilen terim listesi tarandı. Bazı terimler İSTENEN ADLA repo'da
BULUNAMADI — bunlar uydurulmadı, aşağıda açıkça "YOK" olarak işaretlendi.

| Terim | Durum | Gerçek karşılık |
|---|---|---|
| `evidences` | VAR | `supabase/migrations/20260716120006_evidences.sql` — çekirdek tablo |
| `evidence_versions` | **YOK** | Ayrı bir versiyon tablosu hiç yok; versiyonlama `evidences` üzerinde self-referencing kolonlarla (`version_no`, `previous_evidence_id`, `previous_file_hash`, `previous_envelope_hash`) yapılıyor — her SATIR bir sürüm (`20260717190000_evidence_envelope_alanlari.sql:8-10`) |
| `evidence_id` | VAR | `test_runs.evidence_id` (nullable, tekil FK), `evidence_reviews.evidence_id` (FK, çoklu inceleme) |
| `kaynak_kontrol_id` | **YOK (bilinen borç)** | `evidences` tablosunda kolon olarak yok; `src/lib/supabase/veri.ts:175-180` bunu kod seviyesinde `kaynakKontrolId: null` olarak sabitliyor, yorum: *"ŞEMA EKSİĞİ: evidences tablosunda kaynak_kontrol_id kolonu yok"* |
| `control_id` | VAR | `evidences.control_id` (NOT NULL, tekil FK), `control_test_definitions.control_id` (NOT NULL), `test_runs.control_id` (denormalize, sorgu kolaylığı için) |
| `control_test_definitions` | VAR | M12 çekirdek tablosu, `critical_service_id`/`scenario_template_id` (Dikey F1, nullable, opsiyonel) ile genişletildi |
| `test_runs` | VAR | `test_definition_id` + `control_id` + `evidence_id` (tekil, nullable) taşır |
| `Gozlem` | VAR | `src/lib/control-test.ts:52-72` — bkz. §4 |
| `kanit` | VAR (Türkçe eşdeğer) | "evidence"in Türkçe karşılığı kod genelinde değişken/fonksiyon adlarında (`kanit_eklendi`, `kanitId` vb.) — ayrı bir tablo değil |
| `kanit_turu` | **YOK** | Bu isimde HİÇBİR kolon/tip yok — istenen terim muhtemelen yanlış hatırlanmış; gerçek kolon `evidences.tip` (`CHECK IN ('dosya','link','beyan')`) |
| `kaynak_turu` | VAR ama İLGİSİZ ALAN | `assessment_question_templates.kaynak_turu` / `assessment_questions.kaynak_turu` (Dikey E1, TPRM/cloud-assurance anket soruları) — 8 değerli epistemik-kaynak enum'u (`LEGAL_REQUIREMENT`...`UNKNOWN`). **`evidences` tablosunda YOK.** Bir source-type enum'u eklenecekse bu, isim/şekil emsali olabilir (yeni bir enum icat edilecek, mevcut kolon paylaşılmayacak) |
| `FULL_ENVELOPE` / `LEGACY_FILE_HASH_ONLY` | VAR | `evidence_butunluk_durumu()` fonksiyonunun (`20260717190000...:114-135`) iki dönüş değeri — `envelope_schema_version` set mi değil mi'ye göre |
| `manifest` | VAR | Üç AYRI manifest ailesi var (bkz. §6) — bunları birbirine karıştırmamak ADR'nin kritik bir bulgusu |
| `ledger_outbox` | VAR | `public.ledger_outbox` (`20260719120000_ledger_outbox.sql`) — transactional outbox, ROUTE-tetikli, cron YOK (bkz. §7) |
| `transparency` | VAR | `src/lib/transparency.ts` — SignedStatement/STH/Merkle makbuz üretir, DB'ye YAZMAZ (persistans `ledger-outbox.ts`'te) |
| `proof_room` | VAR | 5 gerçek DB-seviyesi dal (nullable FK sütunu), bkz. §9 |
| `tenant_id` + `RLS` | VAR | 70+ migration'da tekrarlayan `tenant_id = current_tenant_id()` deseni |
| `service_role` | VAR | Yalnız server-side outbox drenajı/RPC'lerde; client asla `service_role` kullanmıyor |
| `pg_cron` | VAR | 9 gerçek iş (bkz. §10) — `ledger_outbox`'u drenaj eden YOK |
| `scheduler` | **YOK (bağımsız kavram olarak)** | Ayrı bir "scheduler" soyutlaması yok; yalnız pg_cron işleri + route-tetikli drenaj var |
| `retry` | VAR | `ledger_outbox.deneme_sayisi`, 5 denemede `FAILED` (dead-letter) |
| `connector` / `integration` | **YOK** | Gerçek kod yok, yalnız bu iki ADR'de tasarım metni olarak geçiyor |
| `oauth` | **YOK (service-to-service anlamda)** | Yalnız Supabase Auth'un kendi davet/oturum linki (`ilk-giris/page.tsx`) — üçüncü taraf API için hiçbir OAuth istemcisi yok |
| `secret` / `vault` / `encryption` | **YOK** | Hiçbir Supabase Vault/harici secret manager/at-rest encryption kolonu yok; yalnız gelecekteki KMS/HSM imzalayıcı için YORUM var (`manifest-signature.ts:11-166`) |
| `token` | VAR (farklı bağlamlarda) | `proof_room_links.token` (paylaşım), Supabase Auth `access_token`/`refresh_token` (giriş akışı) — connector token'ı YOK |
| `audit_logs` | VAR (tekil: `audit_log`) | Hash-zincirli, append-only, yalnız trigger yazabilir |
| `entitlement` | VAR | `src/lib/entitlement.ts` + `entitlement-server.ts`, plan bazlı server-side kapı (bkz. §14) |
| `stale` / `UNKNOWN` / `FAILED` / `EXCEPTION` | VAR | `TestSonuc`'un 4/5 durumu (`PASSED` beşincisi) — bkz. §4 |

---

## 3. Mevcut evidence modeli — tam şema

### 3.1 `evidences` tablosu (gerçek kolonlar, üç migration'dan birleşik)

Taban (`20260716120006_evidences.sql:5-15`):
```
id uuid PK · tenant_id uuid NOT NULL FK→tenants · control_id uuid NOT NULL FK→controls
tip text NOT NULL CHECK(dosya|link|beyan) · storage_path text · hash_sha256 text
yukleyen uuid FK→profiles ON DELETE SET NULL · gecerlilik_bitis date · created_at timestamptz
```
**`control_id` bugün ZORUNLU ve TEKİL** — bu, kullanıcının "Alternatif A"
önerisinin (kaynak_kontrol_id eklemek) çözmeye çalıştığı sorunun aslında
FARKLI bir sorun olduğunu gösteriyor (bkz. §3.3).

M9 zarf genişlemesi (`20260717190000_evidence_envelope_alanlari.sql:18-50`)
ekliyor: `version_no, previous_evidence_id, previous_file_hash,
previous_envelope_hash, file_size, mime_type, storage_object_key,
storage_version_id, source_system, captured_at, retention_class,
classification, hash_algorithm, legal_hold, envelope_schema_version`.

M11 redaksiyon genişlemesi (`20260717220000_evidence_redaksiyon.sql:20-29`)
ekliyor: `redaksiyon_kaynak_id, redaksiyon_notu,
redaksiyon_kaynak_file_hash, redaksiyon_kaynak_envelope_hash`.

**Kritik bulgu — dormant (kullanılmayan ama VAR OLAN) provenance alanları:**
`source_system` (free text) ve `captured_at` (timestamptz) M9'dan beri
tabloda duruyor ama HİÇBİR yazma yolu bunları doldurmuyor — `store.tsx:236-
239`'daki gerçek yükleme kodu `source_system: null` yazıyor, açık bir
yorumla: *"kanıt bir dış sistemden otomatik çekilmiyor; elle yükleniyor.
'MANUEL' gibi bir değer yazmak, olmayan bir kaynak sistemi varmış gibi
gösterirdi — null doğru cevap."* Bu, §6'daki provenance sözleşmesinin
büyük kısmının YENİ KOLON GEREKTİRMEDEN, sadece bu iki alanı doldurarak
başlayabileceği anlamına geliyor.

### 3.2 "Bir kanıt, dört çerçeve" — gerçek mekanizma ÇOĞALTMA, referans DEĞİL

Bu ADR'nin en önemli düzeltici bulgusu: proje dokümanlarında (ve Dikey J
ADR'sinde) "bir kanıt, dört çerçeve" bir REFERANS/paylaşım mekanizması gibi
anlatılır, ama gerçek kod (`src/lib/store.tsx:212-259`, `addEvidence`)
şunu yapıyor:
```ts
const hedefKontroller = [evidence.controlId, ...findEquivalentControlIds(...)];
for (const controlId of hedefKontroller) {
  await db.from("evidences").insert({ tenant_id, control_id: controlId, ... }); // HER KONTROL İÇİN AYRI SATIR
}
```
`control_mappings` (kontrol↔kontrol eşdeğerlik, `esdeger` ilişkisi, `20260716120004_frameworks_controls.sql:29-36`) hangi kontrollerin eşdeğer
olduğunu söylüyor; ama paylaşım DOSYA SEVİYESİNDE (content-addressed storage
key, `{tenantId}/{hashSha256}`) oluyor, VERİTABANI SATIRI SEVİYESİNDE
DEĞİL — her eşdeğer kontrol için bağımsız, kendi `id`'sine sahip yeni bir
`evidences` satırı INSERT ediliyor. **Hangi kontrolün "orijinal" yükleme
olduğu HİÇBİR SATIRDA tutulmuyor** (çünkü `kaynak_kontrol_id` yok) —
yalnız `audit_log.detay.kaynakKontrolId` içinde (client-side demo state
aynası, gerçek okuma yolunda hiç kullanılmıyor).

**Sonuç:** `evidences.kaynak_kontrol_id` borcu, kullanıcının "bir kanıt
birden fazla kontrolü desteklemesi" diye çerçevelediği sorunu ÇÖZMÜYOR —
o zaten (çoğaltmayla, verimsiz ama) çalışıyor. Asıl çözdüğü sorun daha
DAR: **çoğaltılmış bir kopyanın HANGİ orijinal yüklemeden/kontrolden
geldiğini kalıcı olarak kaydetmek** — tıpkı `previous_evidence_id`'nin
sürüm soyunu, `redaksiyon_kaynak_id`'nin redaksiyon soyunu kaydettiği gibi.
**Bu, `evidences` tablosunda ZATEN ÜÇ KEZ kullanılan bir self-referencing
lineage idiomunun DÖRDÜNCÜ örneği olurdu — yeni bir desen icat edilmiyor.**

### 3.3 Okuyucular — hepsi 1:1 varsayıyor

- `src/lib/supabase/veri.ts:143-183` (uygulamanın merkezi veri yükleyicisi):
  `evidences`'i çeker, `r.control_id`'ye göre `evidencesByControl: Record<string, Evidence[]>` kurar — **her kanıt satırı tam olarak bir kontrol
  anahtarının altına yerleşir.**
- `src/app/(app)/controls/[id]/page.tsx:80`: `evidencesByControl[params.id]`
  — aynı varsayımı devralır. `kaynakKontrolId` alanına dayalı bir "bu X
  kontrolünden yansıtıldı" linki VAR (satır ~600) ama gerçek DB yolunda bu
  alan her zaman `null` (ölü kod, yalnız yerel demo store'da çalışıyor).
- `proof_room_goruntule` RPC (`20260718220000_proof_room.sql:134-139`):
  `evidences`'e `test_runs.evidence_id` üzerinden TEKİL, kontrol bazlı DEĞİL
  bir sorgu yapıyor — kontrol↔kanıt ilişkisine hiç dokunmuyor.

**Sonuç: hiçbir okuyucu, bir kanıtın N kontrolü desteklediği bir görünüm
oluşturmuyor — böyle bir görünüm bugün YOK.**

---

## 4. Evidence-control ilişki alternatifleri — repo gerçekliğine göre değerlendirme

### Alternatif A — `evidences.kaynak_kontrol_id` (self-referencing FK)

**Düzeltme:** kullanıcının tarif ettiği gibi `controls(id)`'e değil,
`evidences(id)`'e self-referencing bir FK olmalı — çünkü kayıt etmek
istediğimiz şey "hangi kontrol" değil "hangi ORİJİNAL KANIT SATIRINDAN
çoğaltıldı" (kontrol zaten çoğaltılan satırın kendi `control_id`'sinde
duruyor). Şema: `kaynak_kontrol_id uuid REFERENCES evidences(id) ON DELETE
RESTRICT` (adı yanıltıcı olsa da kurucunun/ROADMAP'in mevcut adlandırmasını
korumak için değiştirilmedi — ADR'de netleştirildi).

- **Artı:** `previous_evidence_id`/`redaksiyon_kaynak_id` ile AYNI, KANITLI
  desen; §3.3'teki HİÇBİR okuyucuya dokunmaz (yalnız yeni, nullable bir
  kolon); `veri.ts`'in `evidencesByControl` gruplama mantığı değişmez;
  geriye dönük uyum tam (eski satırlar `NULL` kalır, backfill YOK — mevcut
  `LEGACY_FILE_HASH_ONLY` felsefesiyle tutarlı).
- **Eksi:** kullanıcının "bir kanıt birden fazla kontrolü desteklesin"
  hedefini GERÇEK ANLAMDA çözmez — çoğaltma DEVAM EDER, yalnız artık
  izlenebilir çoğaltma olur. Connector dünyasında N kontrolü aynı anda
  destekleyen tek bir kanıt (örn. tek bir MFA raporu 3 farklı kontrolü
  destekleyebilir) yine N kez depolanır (dosya deduplike olur, satır
  deduplike olmaz).

### Alternatif B — `evidence_control_links` (çoktan-çoğa junction table)

Repoda İKİ ayrı junction-table idiomu zaten üretimde:
1. **Composite-PK, surrogate'siz** — `board_declaration_evidence_links`
   (`(answer_id, evidence_id)` composite PK, yaşam döngüsü yok).
2. **Surrogate UUID PK + `unique(a,b)` + doğrulama durum makinesi** —
   `obligation_control_mappings` (`dogrulama_durumu`: DRAFT_RESEARCH→
   TODO_DOGRULA→LEGAL_REVIEW→VERIFIED/SUPERSEDED/REJECTED, `dogrulayan`+
   `dogrulama_zamani` atfı, guard trigger ile VERIFIED donuyor).

Kanıt provenance'ının TAM OLARAK bu ikinci idiomun ihtiyaç duyduğu türden
bir şey olması (kim ekledi, ne zaman, hangi güvenle, insan onayladı mı)
nedeniyle **pattern (2) daha yakın emsal.**

- **Artı:** gerçek çoktan-çoğa; manuel/connector eşlemeleri `source`
  alanıyla ayrılabilir; `obligation_control_mappings`'in kanıtlanmış
  doğrulama-durumu desenini yeniden kullanır (yeni bir uyum iddiası icat
  edilmez).
- **Eksi (repo kanıtlı, tahmin değil):** `veri.ts`'in `evidencesByControl`
  gruplama mantığı KIRILIR — `evidences.control_id`'den değil, junction
  tablosundan gruplama yapması gerekir (gerçek, ölçülebilir bir refactor).
  `store.tsx`'teki "bir kanıt, dört çerçeve" ÇOĞALTMA döngüsünün TAMAMEN
  KALDIRILIP junction insert'iyle DEĞİŞTİRİLMESİ gerekir — bu davranışsal
  bir değişiklik, yalnız ek değil. `proof_room_goruntule` etkilenmez
  (zaten `test_runs.evidence_id` üzerinden tekil erişiyor, kontrole hiç
  dokunmuyor).

### Alternatif C — kanıt yalnız test run'a bağlanır, kontrol test tanımından türetilir

Repo gerçeği bu alternatifi YANLIŞ ÇERÇEVELENMİŞ gösteriyor: `test_runs`
zaten HEM `control_id` HEM `evidence_id`'yi DOĞRUDAN taşıyor (`control_id`
denormalize, sorgu kolaylığı için — `test_runs` migration yorumu). Yani
kontrol bugün zaten "türetilmiyor," doğrudan depolanıyor; bu alternatif
mevcut şemayı YANLIŞ tarif ediyor.

- **Gerçek eksi (kullanıcının öngördüğü gibi, kanıtlı):** `test_runs.
  evidence_id` NULLABLE ama bir `test_runs` satırı YOKSA kanıt hiç
  saklanamaz — bir connector'ın test koşusu OLMADAN sürekli kanıt
  biriktirmesi (örn. günlük MFA raporu, henüz hiçbir test tetiklenmeden)
  bu modelde YER BULAMAZ. Bu, connector'lı bir dünya için GERÇEKTEN
  yetersiz — reddedilmesi gerekir.

### 4.1 Öneri — FAZLI yaklaşım, tek seferde "doğru" mimariyi kodlamaya çalışmamak

Kurucunun bu turun başındaki ilkesiyle ("eksik gördüğümüz her şeyi aynı
anda kodlamak" yanlış yaklaşım) tam uyumlu:

**Faz 0 (pilot sonrası, connector'dan ÖNCE, düşük risk):** Alternatif A'yı
(self-referencing `kaynak_kontrol_id`) uygula — ROADMAP §2710 borcunu
kapatır, HİÇBİR okuyucuyu bozmaz, kanıtlı bir desenin dördüncü tekrarıdır.
Bu, connector'sız bile bugünden değerlidir (mevcut "bir kanıt dört
çerçeve" çoğaltmasının izlenebilirliğini artırır).

**Faz 1 (Entra ID MVP kapsam netleşince, AYRI bir kurucu kararı ister):**
gerçek çoktan-çoğa ihtiyacı (bir connector kanıtının BİRDEN FAZLA kontrolü
AYNI SATIRLA desteklemesi) somutlaşınca Alternatif B'ye geçilir —
`obligation_control_mappings`'in doğrulama-durumu idiomuyla. Bu, `veri.ts`
ve `store.tsx`'e dokunan GERÇEK bir refactor'dür, kendi ADR'sini/kurucu
onayını ister, Dikey K'nın bu turunda KARARLAŞTIRILMAZ.

**Alternatif C reddedilir** — repo gerçeğiyle çelişiyor (kontrol zaten
türetilmiyor, doğrudan depolanıyor) ve connector'ın test-öncesi kanıt
biriktirmesini imkânsız kılıyor.

---

## 5. Connector provenance sözleşmesi (kodsuz taslak)

### 5.1 Zaten var olan (dormant) alanlar — YENİDEN KULLANILACAK, kopyalanmayacak

| İstenen alan | Karşılığı |
|---|---|
| `source_system` | `evidences.source_system` (VAR, boş) |
| `source_observed_at` | `evidences.captured_at` (VAR, boş) |
| `version lineage` / `superseded_at` | `evidences.version_no`+`previous_evidence_id`+`previous_file_hash`+`previous_envelope_hash` (VAR, aktif kullanımda — redaksiyon/sürümlemede) |
| kaynak-sistem sınıflandırması emsali | `assessment_question_templates.kaynak_turu` (8 değerli kapalı enum, AYNI ŞEKİL ama farklı tablo — isim emsali, kolon paylaşımı değil) |

### 5.2 Yeni gerekenler (kodsuz, önerilen kolon/alan listesi)

`connector_type, connector_instance_id, source_resource_id,
source_event_id, source_payload_hash, collector_version,
collection_status, authentication_context (yalnız bağlam etiketi — asla
token/secret değeri), control_mapping_source (MANUEL|CONNECTOR_ONERISI),
human_review_status`. Bunlar `evidences`'e mi yoksa ayrı bir
`evidence_connector_provenance` yan tablosuna mı ekleneceği AÇIK KARAR
(bu ADR'de verilmedi) — `evidences`'in append-only/immutable disiplini
(kural 2) düşünülürse, sık değişebilecek `collection_status` gibi alanların
AYRI bir tabloda tutulması (tıpkı `evidence_reviews`'in mutable durumu
`evidences`'ten AYRI tutması gibi, "append-only tablo mutable durum
taşıyamaz" ilkesi) daha tutarlı olabilir.

### 5.3 Kaynak türleri — mevcut enum standardına uyum

Önerilen kapalı küme (`kaynak_turu`'nun 8-değerli-kapalı-enum ŞEKLİNİ
izler, ama `evidences`'e özel YENİ bir enum'dur):
```
MANUEL_YUKLEME | MANUEL_BEYAN | OTOMATIK_CONNECTOR | API_IMPORT |
DOSYA_IMPORT | HARICI_DOGRULAMA
```
`UNKNOWN` değeri BURADA gerekli DEĞİL (kaynak_turu'nun aksine) — çünkü
kaynak, ekleme anında HER ZAMAN bilinir (kod bunu yazan, bilmediği bir
şeyi yazmaz); `kaynak_turu`'nun `UNKNOWN`'ı epistemik belirsizlik için var,
buradaki alan mekanik bir köken etiketidir.

---

## 6. Mevcut test/manifest/ledger uyumu

### 6.1 `Gozlem` sözleşmesi — connector dünyasına HAZIR, ama korumasız

`src/lib/control-test.ts:52-72`, tam alan listesi: `toplamaBasarisiz:
boolean, toplamaHatasi: string | null, gozlemZamani: string | null,
istisnaKabul: boolean, gozlenenDeger?: CanonicalDeger, iddiaKarsilandi?:
boolean | null`. `testDegerlendir` (satır 110-158) karar sırası:
1. `toplamaBasarisiz === true` → **UNKNOWN** (satır 112) — kural 13'ün
   birebir kod karşılığı, connector arızası İÇİN ZATEN YAZILMIŞ.
2. `istisnaKabul === true` → `EXCEPTION`.
3. tazelik aşıldıysa → `STALE`.
4. iddia değerlendirmesi `null` → **UNKNOWN** (ikinci, bağımsız UNKNOWN
   tetikleyicisi).
5. `karsilandi ? PASSED : FAILED`.

**`POST /api/kontrol-test/[id]/calistir`** (`src/app/api/kontrol-test/[id]/
calistir/route.ts`), `Gozlem`'i doğrudan `req.json()`'dan inşa ediyor —
ara bir "collector" soyutlaması YOK. **Mekanik olarak bir connector bugün
bile bu rotaya `{toplamaBasarisiz:true,...}` POST edebilir** ve motor
doğru çalışır — ama rota `db.auth.getUser()` ile GERÇEK bir insan
oturumu istiyor, service-role/API-key kimlik doğrulaması YOK, `kaynak`
alanı YOK, idempotency anahtarı YOK. **Bu üçü, connector entegrasyonunun
gerçek ön koşuludur** (kod değişikliği gerektirir, bu ADR'nin kapsamı
dışında — yalnız tespit edildi).

### 6.2 Üç AYRI manifest ailesi — birbirine karıştırılmamalı

Bu ADR'nin ikinci düzeltici bulgusu: "dört hash" (reportDataHash/
coreManifestHash/pdfFileHash/packageManifestHash) TÜM manifest'lere
uygulanan evrensel bir kural DEĞİL — yalnız `simulation-manifest.ts`
(tatbikat/simülasyon rapor ailesi). **Kontrol testi koşusu (connector'ın
gerçekte besleyeceği yer) TEK bir hash kullanıyor**:
`kontrol-test-ledger.ts`'in `controlTestRunManifestHash()` — şema
`KALKAN_CONTROL_TEST_RUN_MANIFEST_V3`, `canonicalHash()` ile tek özet.
Bir connector-kaynaklı test sonucu bu TEK-HASH sözleşmesine girer, dört-
hash'e değil.

### 6.3 Şeffaflık defterine giriş — `transparency.ts` YAZMAZ, imzalar

`transparency.ts`'in KENDİSİNDE "deftere ekle" fonksiyonu YOK — yalnız
kriptografik artefaktlar üretir (`imzaliIfadeOlustur`, `ifadeYaprakHash`,
`defterKoku`, `agacBasiImzala`, `makbuzUret`, `makbuzDogrula`,
`tutarlilikDogrula`). Gerçek `transparency_ledger_entries` INSERT'i
`ledger-outbox.ts:351-359`'da. Bir connector artefaktının bu hatta girmesi
için gereken: `kind` (statement tipi etiketi), `statementHash` (çağıran
tarafından `canonicalHash()` ile hesaplanmış 64-hex), bir `ManifestSigner`.

**Kritik operasyonel bulgu:** `ledger-outbox.ts:347`, HER drenaj
çağrısında `LocalDevSigner.olustur()`'u TAZE çağırıyor — yani bugün her
drenaj partisi kendi geçici anahtar çiftini üretiyor, `kid` partiler
arasında SABİT DEĞİL. Bu zaten dev-grade olarak işaretli (Dikey I'in I1'i)
ama connector hacmiyle drenaj sıklığı artınca bu sınır daha görünür
hâle gelir — Dikey I'in I1'iyle (KMS/HSM production signer) doğrudan
bağlantılı, Dikey K bunu TEKRARLAMIYOR, yalnız bağımlılığı not ediyor.

---

## 7. Connector error semantiği — YENİ DURUM GEREKMEZ

`kontrolGuvenceDurumu`'nun 5 durumu (kural 13) KAPALI bir kümedir — yeni
bir `COLLECTION_ERROR` üst-seviye durumu EKLEMEK kural 13'ü ihlal eder ve
`kontrolGuvenceDurumu`'nun öncelik sıralamasını (FAILED>STALE>UNKNOWN>
EXCEPTION>PASSED) bozar. **Öneri: connector arıza TÜRÜNÜ (auth hatası,
rate-limit, timeout, kaynak bulunamadı) `Gozlem` İÇİNDE, `toplamaBasarisiz`
ile birlikte taşınan bir ALT-ALAN olarak modelle** — örn. `toplamaHataKategori?: 'AUTH_FAILED' | 'RATE_LIMITED' | 'TIMEOUT' | 'NOT_FOUND' | 'DIGER'`,
`toplamaHatasi`'nın (zaten var olan serbest metin) yanında, YİNE
`UNKNOWN`'a çözülen bir metadata alanı olarak. Bu, mevcut `toplamaHatasi`
alanının doğal genişlemesidir, yeni bir durum makinesi değil.

Analiz edilen kurallar, hepsi mevcut motorla UYUMLU:
- Connector arızası = FAILED değildir → `toplamaBasarisiz` zaten bunu yapıyor.
- Veri gelmemesi = kontrol başarısızlığı değildir → aynı mekanizma.
- Yetki eksikliği → `toplamaBasarisiz=true` + `toplamaHataKategori='AUTH_FAILED'` (yeni durum DEĞİL, metadata).
- Stale connector verisi → zaten AYRI bir durum (`STALE`, `tazelikGun`+
  `gozlemZamani` ile), connector'ın `gozlemZamani`'nı DOĞRU doldurması
  yeterli, motor değişmez.
- Connector gözlemi ile kontrol sonucu ayrı tutulmalı → zaten öyle:
  `Gozlem` (ham gözlem) ile `TestSonucu` (motor çıktısı) ayrı tipler.
- Otomatik eşleme insan onayı gerektirebilir → §5.2'deki
  `control_mapping_source`/`human_review_status` bunun için var.
- İdempotent yeniden toplama aynı artefaktı çoğaltmamalı → `ledger_outbox`
  zaten `unique(artifact_table, artifact_id)` deseniyle bunu kanıtlıyor;
  connector tarafı için AYNI FİKRİN `evidences` (veya provenance yan
  tablosu) üzerinde `unique(tenant_id, connector_instance_id,
  source_event_id)` şeklinde tekrarı önerilir.

---

## 8. Entra ID Connector MVP — 3 aday, Microsoft'un resmî belgeleriyle doğrulandı

Kullanıcının önerdiği 5 adaydan **3'ü bu oturumda Microsoft Learn'den
doğrulandı**, 2'si DOĞRULANMADAN aday listesine bırakıldı (uydurulmadı —
açıkça işaretlendi).

### 8.1 Doğrulanan adaylar

| Kontrol | Endpoint | Permission (en az ayrıcalıklı) | Tip |
|---|---|---|---|
| MFA kayıt durumu | `GET /reports/authenticationMethods/userRegistrationDetails` | `AuditLog.Read.All` (v1.0, delegated+application) — daha geniş alternatif `UserAuthenticationMethod.Read.All` | Application permission destekli, admin consent gerekir |
| Conditional Access politika varlığı | `GET /identity/conditionalAccess/policies` | `Policy.Read.All` (daha dar: `Policy.Read.ConditionalAccess`) | Application permission destekli |
| Ayrıcalıklı yönetici rolleri | `GET /directoryRoles/{id}/members` veya `GET /directoryRoles(roleTemplateId='...')/members` | `RoleManagement.Read.Directory` | Application permission destekli |

Kaynaklar: [userRegistrationDetails](https://learn.microsoft.com/en-us/graph/api/authenticationmethodsroot-list-userregistrationdetails?view=graph-rest-1.0), [conditionalAccessRoot list policies](https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-list-policies?view=graph-rest-1.0), [directoryRole list members](https://learn.microsoft.com/en-us/graph/api/directoryrole-list-members?view=graph-rest-1.0), [RoleManagement.Read.Directory](https://graphpermissions.merill.net/permission/RoleManagement.Read.Directory).

**Bu üçü için ortak analiz:**
- **Delegated mi application mı:** Application permission (client-credentials, insanın oturum açık kalmasını gerektirmeyen arka-plan toplama) ÜÇÜ İÇİN DE destekleniyor — connector'ın çalışma modeliyle (periyodik, insansız) uyumlu.
- **Müşteri admin consent:** hepsi tenant-geniş application permission'lar olduğu için EVET, müşterinin Global Admin/Privileged Role Admin'i tek seferlik admin consent vermeli.
- **Veri minimizasyonu:** `userRegistrationDetails` özet zaten (kullanıcı bazlı `isMfaRegistered` boolean + yöntem listesi, ham kimlik doğrulama olayı değil); `conditionalAccess/policies` politika VARLIĞI/durumu saklanmalı, politika içindeki KOŞUL detayları (örn. hangi kullanıcı grupları) PII riski taşıdığı için özetlenmeli; `directoryRoles/members` yalnız üye SAYISI+rol adı saklanmalı, üye kimliği (UPN/e-posta) Proof Room'a asla YANSITILMAMALI (mevcut "kanıt yalnız id+hash" minimizasyon disiplini, §9).
- **Ham vs. türetilmiş:** ham API yanıtı HİÇBİR ZAMAN olduğu gibi saklanmamalı — yalnız `source_payload_hash` (bütünlük için) + türetilmiş özet (`mfaKayitliKullaniciOrani`, `caPolitikaSayisi`, `ayricalikliRolSayisi` gibi sayısal/boolean özetler) saklanmalı.
- **PII riski:** yüksek (kullanıcı listesi, e-posta, rol ataması) — özetleme ZORUNLU, ham liste asla `evidences.storage_path`'e konmamalı.
- **Rate-limit riski:** Graph API standart limitleri (uygulama başına, kiracı başına) var; MVP'nin 3 kontrolü GÜNDE BİR toplanacak ölçekte önemsiz, ama gelecekte çoklu tenant'ta paralel poll'lar throttling'e çarpabilir — K2 kararına bağlı (bkz. §10).
- **Test sonucu üretecek mi:** HAYIR, doğrudan değil — her biri bir `Gozlem` üretir (§5.2'nin `control_mapping_source='CONNECTOR_ONERISI'`), insan/onaylı bir kontrol testi TANIMINA karşı değerlendirilir. Connector çıktısı asla doğrudan `PASSED`/`FAILED` YAZMAZ (§7).
- **İnsan onayı:** kontrol eşlemesi (hangi WardProof kontrolüne karşılık geldiği) İLK SEFERDE insan onayı ister; sonraki periyodik toplamalar AYNI eşlemeyi insansız kullanabilir (eşleme değişene kadar).

### 8.2 Doğrulanmamış adaylar (bu turda Microsoft belgesiyle teyit edilmedi)

"Eski kimlik doğrulama yöntemleri" ve "inactive privileged accounts" —
muhtemelen Entra ID sign-in logs (`/auditLogs/signIns`,
`legacyAuthenticationProtocol` filtresi) ve PIM/son-giriş analiziyle
mümkün, ama bu oturumda resmî belgeyle doğrulanmadı — **uydurulmadı,
sonraki bir turda ayrı doğrulama ister.**

**Öneri: MVP kapsamı yalnız 3 doğrulanmış adayla sınırlanmalı** (kullanıcının "en fazla 3-5" aralığının alt sınırı) — doğrulanmamış 2 aday
"olası genişleme" olarak not edilir, MVP taahhüdüne dahil edilmez.

---

## 9. OAuth ve secret mimarisi — kodsuz karar taslağı

**Bulgu: bugün repoda service-to-service OAuth (client-credentials/
consent flow) HİÇ YOK.** Yalnız Supabase Auth'un kendi davet/oturum
mekanizması var (`ilk-giris/page.tsx`, URL hash'inden `access_token`/
`refresh_token` okuyor — bu insan girişi içindir, connector kimlik
doğrulaması değildir). **Secret/Vault/encryption-at-rest de HİÇ YOK** —
yalnız gelecekteki KMS/HSM imzalayıcı için YORUM var (kod değil).

**Kural 4'ün (Supabase'e taşınamaz bağımlılık eklenmez, yurt-içi
taşınabilirlik VII-128.10 md.26 gereği) doğrudan sonucu: Supabase Vault
KULLANILAMAZ** — bu proje-genelinde zaten önceden çizilmiş bir sınır,
Dikey K'nın icat ettiği bir kısıt değil.

**Kodsuz karar taslağı (uygulanmadı, yalnız öneri):**
- Tenant başına connector instance: EVET, her connector bağlantısı
  `tenant_id`'ye sabitlenir (mevcut her tablonun idiomu).
- OAuth akışı: application-permission + admin-consent (Microsoft'un
  standart tenant-wide consent akışı, §8.1) — delegated/kullanıcı-bazlı
  DEĞİL, connector insansız çalışacağı için.
- Client secret yerine certificate/federated credential: Microsoft'un
  kendi önerisi budur (client secret süre sınırlı ve daha zayıf) —
  DEĞERLENDİRİLMELİ ama bu ADR'de KARARLAŞTIRILMADI, Entra MVP'nin
  kendi ADR'sinde netleşmeli.
- Refresh token/secret saklama: **Supabase Vault DIŞLANDI** (kural 4).
  İki gerçekçi alternatif: (a) uygulama-seviyesi encryption (env'den
  gelen bir master key ile encrypt edilmiş kolon — ama master key'in
  KENDİSİ nerede duracağı aynı soruna geri döner), (b) harici, self-
  hosted-uyumlu bir secret manager (HashiCorp Vault, veya yurt-içi
  barındırılabilir bir eşdeğeri). **Bu, Dikey I'in I1'iyle (KMS/HSM)
  AYNI altyapı kararını paylaşıyor olabilir — iki ayrı KMS kararı almak
  yerine TEK bir kurumsal anahtar-yönetimi kararı (Dikey I I1 + Dikey K
  connector secret'ları) BİRLİKTE değerlendirilmeli.** Bu ADR'de
  KARARLAŞTIRILMADI, açık kurucu kararı olarak işaretlendi (§17).
- Key rotation / revoke-disconnect: connector bağlantısının kendi durum
  makinesi olmalı (AKTIF/IPTAL_EDILDI/SÜRESI_DOLDU/HATALI), mevcut
  `tenant_provisioning`'in 8-durumlu guard'lı makine idiomuna benzer bir
  desen — YENİ bir "iptal yolu yok" riski icat edilmemeli.
- Platform operatör erişim sınırı: **mevcut mekanizma YETERLİ, yeni bir
  "hariç tut" kuralı icat etmeye gerek YOK.** `platform_operator`'ın
  `tenant_id IS NULL` olması, standart `tenant_id = current_tenant_id()`
  RLS idiomunu kullanan HERHANGİ bir tablo için otomatik sıfır-satır
  sonucu üretir (G1'de kanıtlandı). Connector secret tablosu bu STANDART
  idiomu kullanırsa (platform_operator'a AÇIK bir bypass GRANT
  edilmezse — ki bugün hiçbir iş verisi tablosunda böyle bir bypass
  yok, yalnız provisioning/tenant-registry tablolarında var), "platform
  operatörü müşteri secret'ını düz metin göremez" ilkesi EK KOD
  YAZMADAN sağlanır.
- Audit: `audit_evidences()` trigger'ının (yalnız metadata loglar — kontrol
  id, tip, hash; asla dosya içeriği) AYNI disiplini connector secret'ları
  için de geçerli: bağlanma/kesme/yenileme olayları loglanır, TOKEN
  DEĞERİ ASLA loglanmaz.
- Failed consent / expired credential: connector durumu `HATALI`/
  `SURESI_DOLDU`'ya düşer → o connector'dan gelen bir sonraki toplama
  denemesi `Gozlem.toplamaBasarisiz=true` + `toplamaHataKategori=
  'AUTH_FAILED'` üretir (§7) — motor DEĞİŞMEZ, yalnız girdi böyle olur.

---

## 10. Scheduler ve K2 bağımlılığı

**pg_cron'da bugün 9 gerçek iş var** (süre-dolumu/yeniden-inceleme
sweep'leri — SoD istisna, kanıt süresi, TPR sözleşme, policy istisna,
assurance claim, RoI export, eğitim periyodu, telafi edici kontrol,
tedarikçi anket). **HİÇBİRİ `ledger_outbox`'u drenaj etmiyor** —
drenaj bugün yalnız ROUTE-tetikli (bir kullanıcı işlemi sonrası senkron
çağrı) veya manuel buton (`POST /api/seffaflik/outbox/isle`). Bu,
connector polling için doğrudan ilgili bir gerçek: **arka planda, hiçbir
HTTP isteği tetiklemeden çalışacak bir connector job, bugünkü mekanizmayla
outbox'ı hiç drenaj ETTİREMEZ** — kendi draining çağrısını da yapması
gerekir (mimari olarak mümkün, ama bu K2'nin ÇÖZMEYE ÇALIŞTIĞI TAM SORUNUN
BİR BAŞKA ÖRNEĞİ).

**K2 durumu: AÇIK KARAR, `docs/adr/ADR-dis-cron.md`'de üç seçenek** (A:
pg_cron+pg_net→servis-token'lı route; B: Supabase Edge Function [bugün
repoda hiç yok]; C: mevcut route-tetikli/manuel drenaj). **"Bu ADR karar
verilene dek C fiilen yürürlükte"** — yani BUGÜN gerçek bir dış
zamanlama garantisi YOK.

**Ayrım (istenen):**
- **Tek seferlik manuel "Şimdi Topla":** K2'DEN BAĞIMSIZ, pilot sonrası
  güvenle geliştirilebilir — bir kullanıcının panelden tetiklediği,
  senkron/route-tetikli bir işlem, mevcut drenaj deseniyle AYNI (K2'nin
  çözmeye çalıştığı "kimse paneli açmazsa" sorunu burada yok, çünkü zaten
  biri paneli açıp tetikliyor).
- **Periyodik/arka-plan toplama, retry, backoff, dead-letter, alert,
  stale hesaplama:** K2'nin TAM OLARAK çözmeye çalıştığı sorunun connector
  versiyonu — **K2 kapanmadan GÜVENLE geliştirilemez.** K2 seçilen
  yaklaşım (A/B/C) neyse, connector polling AYNI mekanizmayı kullanmalı
  (kural 4'ün "tek motor" ruhu, `ADR-dis-cron.md`'nin B seçeneği için
  zaten belirttiği "ikinci motor riski" uyarısıyla birebir aynı mantık).
- **Connector disabled / credential expired / source unavailable:** bunlar
  durum/veri modeli sorunları (§9'daki connector durum makinesi), K2'den
  BAĞIMSIZ tasarlanabilir — yalnız bu durumların GERÇEKTEN TETİKLENMESİ
  (periyodik kontrol) K2'ye bağımlı.

**Sonuç: connector'ın "Şimdi Topla" (tek seferlik) yüzeyi K2'siz
geliştirilebilir; sürekli/periyodik polling K2 kapanmadan BAŞLAMAZ** —
kullanıcının öncelik sırasındaki "K2 → ... → Entra ID Connector MVP"
sıralamasını DOĞRULUYOR, bozmuyor.

---

## 11. Proof Room ve kriptografik zincir — 6. dal deseni

Gerçek DB-seviyesi dal sayısı **5** (nullable FK sütunları:
`test_run_id, roi_export_run_id, graph_snapshot_id,
cloud_assurance_profile_id, kritik_hizmet_test_paketi_snapshot_id`) —
"applicability/sitasyon/tolerans karşılaştırması" bunların İÇİNDE
gömülü ALAN'lar, ayrı dal değil (Dikey J ADR'sindeki "beş polimorfik dal"
tarifi bu ayrımı bulanıklaştırıyor — bu ADR düzeltiyor, bkz. §12).

Bir "connector kaynaklı kanıt" 6. dalı, son dört ekin (roi_export→
graph_snapshot→cloud_assurance→kritik_hizmet_test_paketi) İZLEDİĞİ AYNI
mekanik: yeni nullable FK kolonu + `proof_room_link_target_guard()`'a
yeni guard clause + `proof_room_goruntule` RPC'sine yeni `if` dalı + TS
arayüzüne yeni varyant + sayfa bileşenine yeni dal. **Minimizasyon
disiplini** (mevcut `test_run_id` dalından, doğrudan uygulanabilir):
yalnız id+hash (asla ham içerik/yol/kimlik), 240-karakter metin snippet
tavanı, REJECTED eşlemelerin tamamen hariç tutulması, geçersiz/süresi
dolmuş/iptal token'ların AYNI (ayrım sızdırmayan) yanıtı, sistem-atıflı
audit (görüntüleyen kimliği yok). **Açık tasarım sorusu (bu ADR'de
KARARLAŞTIRILMADI):** kaynak sistem adının ("Azure Security Center" gibi)
bu minimizasyon disipliniyle nasıl gösterileceği — bir güven/kimlik
iddiası hâline gelmeden.

---

## 12. Dikey J'ye düzeltmeler (bu ADR'nin bulguları ışığında)

Dikey J ADR'si (§3.5) Proof Room'u "Beş polimorfik dal (test_run,
applicability, sitasyon, tolerans karşılaştırması, kritik hizmet test
paketi)" diye tarif ediyor — bu, dal SAYISINI doğru veriyor (5) ama
İÇERİĞİNİ karıştırıyor: gerçek 5 dal §11'deki FK kolonlarıdır;
applicability/sitasyon/tolerans, `test_run_id` dalının İÇİNDEKİ alt
alanlardır. Dikey J'nin genel mimari önerisi (7 katman, son 4'ünün
üretimde olduğu tespiti) DOĞRU ve DEĞİŞMİYOR — yalnız bu tek terminoloji
netleştirmesi yapıldı. Dikey J'nin `evidences.kaynak_kontrol_id` borç
tespiti de DOĞRU — bu ADR onu §3-4'te derinleştirdi (self-referencing
FK olması gerektiği, hangi soruna GERÇEKTEN çözüm olduğu netleşti).

---

## 13. Tenant izolasyonu ve güvenlik — özet

Kanonik RLS idiomu (`current_tenant_id()`+`current_role()`, security
definer, `20260716120003_rls_helpers_tenants_profiles.sql:4-22`) 70+
migration'da tekrarlanıyor — bir connector secret/credential tablosu AYNI
idiomu kullanmalı, yeni bir izolasyon mekanizması icat edilmemeli.
`platform_operator`'ın `tenant_id IS NULL` olması + standart RLS deseni,
EK KOD OLMADAN "platform operatörü iş verisini göremez" ilkesini
sağlıyor (G1'de negatif test edildi) — connector secret'ları için de
GEÇERLİ, yeter ki platform_operator'a bu tabloda AÇIK bir bypass policy
verilmesin (bugün hiçbir iş-verisi tablosunda böyle bir bypass yok,
yalnız provisioning/tenant-registry tablolarında var — 4 örnek, hepsi
işlevsel gerekçeli).

---

## 14. Ticari değer

- **En yüksek demo değeri:** MFA kayıt durumu — CISO/uyum yöneticisi
  için sezgisel ("kaç kullanıcı MFA'sız"), tek bir API çağrısıyla somut
  bir sayı üretir, TR kurumsal pazarda Entra ID/Microsoft 365 yaygınlığı
  (kullanıcının kendi gerekçesi) nedeniyle geniş bir izleyici kitlesine
  hitap eder.
- **En düşük entegrasyon maliyeti:** Conditional Access politika varlığı
  — API tek bir liste çağrısı, karmaşık sayfalama/agregasyon gerektirmez
  (MFA raporu kullanıcı-bazlı sayfalama ister, rol üyeliği potansiyel
  olarak büyük listeler döndürebilir).
- **Müşteri tarafından en kolay doğrulanabilir:** ayrıcalıklı yönetici
  rolleri — müşteri kendi Entra ID panelinden "Roller ve yöneticiler"e
  bakıp WardProof'un raporladığı sayıyı ANINDA gözle doğrulayabilir
  (güven inşası için değerli, "kara kutu" hissi vermez).
- **Manuel süreçten en anlamlı zaman tasarrufu:** MFA kayıt durumu —
  bugün muhtemelen elle Entra panelinden export edilip Excel'e
  yapıştırılan bir rapor; connector bunu tek tıkla güncel tutar.
- **Feature theatre riski:** eğer MVP yalnız "kontrol var/yok" gibi
  yüzeysel bir sinyal üretip GERÇEK bir test sonucuna (`PASSED`/`FAILED`)
  bağlanmazsa (yalnız kanıt biriktirip hiçbir kontrol testine
  bağlanmazsa), bu "biz de AI/otomasyon yapıyoruz" vitrini olur — §7'nin
  Gozlem→motor bağlantısının GERÇEKTEN kurulması (yalnız kanıt değil,
  test sonucu üretmesi, insan onaylı) bu riski önler.

**Entra ID'nin ilk connector olması gerekçesi (kanıtlanmış):** (1) TR
kurumsal pazarda Microsoft 365/Entra ID yaygınlığı yüksek (kullanıcının
öngörüsü, bu ADR'de bağımsız pazar verisiyle doğrulanmadı — flagged);
(2) application-permission + admin-consent modeli WardProof'un "insansız,
periyodik, delegated-olmayan" connector felsefesiyle üç adayın da TAMAMEN
uyumlu olduğu Microsoft'un KENDİ belgesiyle doğrulandı (§8.1); (3) üç
kontrolün üçü de DÜŞÜK PII-yüzey ile ÖZETLENEBİLİR (boolean/sayısal),
Proof Room'un mevcut minimizasyon disipliniyle doğrudan uyumlu.

---

## 15. Pilot sonrası kabul kapısı (öneri, karar değil)

- [ ] İlk pilot tamamlandı.
- [ ] Müşterinin manuel kanıt iş yükü ÖLÇÜLDÜ (saat/ay gibi somut bir
      sayı — tahmin değil, gerçek pilot gözlemi).
- [ ] Otomasyona aday ilk 5 kontrol (§8.1'in 3'ü + doğrulanacak 2 aday)
      belirlendi.
- [ ] Mevzuat/kontrol eşlemeleri hukuk/uzman incelemesinden geçti (kural 3).
- [ ] Özel SMTP ve K1 tamamlandı.
- [ ] K2 kritik zamanlanmış görev güvencesi kapandı (A/B/C kararı verildi
      — §10'a göre bu, periyodik connector polling'in KESİN ön koşulu).
- [ ] Secret storage kararı verildi (§9 — Dikey I'in I1'iyle BİRLİKTE).
- [ ] Evidence ilişki modeli Faz 0 kararı (Alternatif A) UYGULANDI VE
      CANLIDA DOĞRULANDI.
- [ ] Entra permission kapsamı müşteriyle (gerçek pilot müşterisi)
      doğrulandı — Microsoft'un belgesi TEKNİK olarak doğru olsa da,
      müşterinin KENDİ Entra tenant'ının IT/güvenlik ekibinin admin
      consent'i onaylaması AYRI bir operasyonel adım.

---

## 16. Önerilen uygulama sırası (kullanıcının sırasını BOZMUYOR, ayrıntılandırıyor)

1. Özel SMTP → K1 → K2 → mevzuat paketi → ilk pilot → geri bildirim
   (DEĞİŞMEDİ).
2. Evidence ilişki modeli Faz 0 (Alternatif A, self-referencing
   `kaynak_kontrol_id`) — küçük, düşük riskli, connector'sız bile değerli.
3. Entra ID MVP'nin KENDİ ADR'si — bu belgenin §8/§9 taslaklarını
   kurucu onayıyla netleştirir (certificate vs. secret, secret storage
   mekanizması, `evidence_connector_provenance` tablo kararı).
4. Entra ID Connector MVP kodu (3 doğrulanmış kontrol, "Şimdi Topla" tek
   seferlik — periyodik polling K2'ye bağımlı).
5. M365/Azure/AWS genişlemesi, billing/self-servis, kontrollü yardımcı AI
   (DEĞİŞMEDİ, sıra kullanıcının verdiği gibi).

---

## 17. Açık kurucu kararları (en fazla 5)

1. **Evidence-control ilişkisi:** Faz 0'da Alternatif A (self-referencing
   `kaynak_kontrol_id`, dar kapsam, düşük risk) mi, yoksa doğrudan
   Alternatif B'ye (junction table, geniş kapsam, `veri.ts`+`store.tsx`
   refactor'ü) mi geçilsin? **Öneri: Faz 0 = A, Faz 1 = B (Entra MVP
   kapsamı netleşince ayrı karar).**
2. **İlk Entra MVP kontrol seti:** yalnız 3 doğrulanmış aday (MFA kaydı,
   CA politika varlığı, ayrıcalıklı rol üyeliği) mi, yoksa 2 doğrulanmamış
   adayın (eski kimlik doğrulama, inaktif ayrıcalıklı hesap) da ayrı bir
   turda Microsoft belgesiyle doğrulanıp MVP'ye eklenmesi mi beklensin?
   **Öneri: MVP=3, diğer ikisi "sonraki dilim."**
3. **Secret storage yaklaşımı:** Dikey I'in I1'i (KMS/HSM production
   signer) ile Dikey K'nın connector secret'ları AYNI kurumsal anahtar-
   yönetimi kararına mı bağlansın (tek karar, tek altyapı), yoksa ayrı
   ayrı mı çözülsün? **Öneri: TEK karar — ikisi de "gizli anahtar/kimlik
   bilgisi Supabase dışında, yurt-içi taşınabilir bir mekanizmada durur"
   ilkesini paylaşıyor.**
4. **Connector çıktısının insan onayı gereksinimi:** her periyodik
   toplamada mı, yoksa yalnız İLK eşleme/ilk toplamada mı insan onayı
   zorunlu, sonrakiler insansız mı akabilir? **Öneri: ilk eşleme insan
   onaylı, sonraki periyodik toplamalar (aynı eşleme, aynı connector)
   insansız akabilir — ama her biri yine de `Gozlem`→motor zincirinden
   geçer, motor kararı asla connector'ın kendisi vermez.**
5. **Sürekli polling'in K2 sonrası mı başlaması gerektiği:** §10'un
   sonucu net (evet, periyodik polling K2'ye bağımlı) — kurucudan asıl
   istenen karar bu DEĞİL, **K2'nin KENDİSİNİN hangi seçenekle (A/B/C,
   `ADR-dis-cron.md`) kapatılacağı.** Bu, Dikey K'nın kapsamı dışında
   ama Dikey K'nın sürekli-izleme hedefinin GERÇEK blokeri.

---

## 18. Değiştirilen belgeler

- Bu belge (yeni).
- `docs/ROADMAP.md` §1.72 (Dikey K girişi, Dikey J ile ilişki, K1/K2/pilot
  önceliği bozulmadı).
- `docs/DEVAM.md` (analiz sonucu + açık kararlar + sonraki operasyonel adım).
- `CLAUDE.md` (connector doğruluk guardrail'leri: connector arızası≠FAILED,
  otomatik kanıt≠otomatik uyum, secret/tenant izolasyonu ilkeleri).

## 19. Kod yazılmadığının teyidi

Bu görevde: migration YAZILMADI, connector kodu YAZILMADI, Microsoft Graph
çağrısı YAPILMADI (yalnız resmî belge okundu), OAuth uygulanmadı, secret
oluşturulmadı, UI eklenmedi, cron eklenmedi, test sonucu otomasyonu
kurulmadı, AI eşleme kodu yazılmadı, canlı Supabase'e dokunulmadı,
production deploy yapılmadı, billing/self-servis kodu yazılmadı, yeni
mevzuat içeriği üretilmedi. Yalnız dört belge (bu ADR + ROADMAP + DEVAM +
CLAUDE) değiştirildi/oluşturuldu.

## 20. Sonraki gerçek operasyonel adım

Bu ADR'nin KENDİSİNDE hiçbir şey açılmaz — sıra DEĞİŞMEDİ: özel SMTP
(runbook hazır, kurucunun kendi Resend/DNS/Supabase-panel işi) → K1 gerçek
restore provası → K2 kararı (A/B/C, `ADR-dis-cron.md`) → hukukça
doğrulanmış ilk mevzuat paketi → ilk kontrollü pilot → pilot geri
bildirimi. Bunlardan HİÇBİRİ Dikey K/Dikey J'nin kodsuz analiziyle
AÇILMADI — hâlâ kurucunun kendi operasyonel işi.
