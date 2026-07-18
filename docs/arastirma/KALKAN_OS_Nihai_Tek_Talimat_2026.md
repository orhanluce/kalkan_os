# CLAUDE CODE — KALKAN_OS NİHAİ TEK MASTER TALİMAT

## Source-to-Proof Regulatory Control Plane — Hostinger + Supabase

**Tarih:** 18 Temmuz 2026  
**Sürüm:** 3.0 — küresel benchmark sonrası bağlayıcı uygulama talimatı  
**Durum:** Claude Code'a verilecek tek talimat dosyası

---

## 0. Talimatın otoritesi

Bu dosya KALKAN_OS geliştirmesi için Claude Code'a verilecek **tek kurucu talimatıdır**. Repository içindeki gerçek kod, migration, testler, `ROADMAP`, `ADR`, güvenlik kuralları ve daha önce alınmış açık kurucu kararları korunur. Eski Claude talimat dosyaları bağlayıcı değildir; yalnız tarihsel araştırma materyali sayılır.

Çelişki sırası:

1. güvenlik ve veri bütünlüğü invariant'ları;
2. repository'de açıkça onaylanmış ADR ve çalışan testler;
3. bu nihai master talimat;
4. diğer araştırma ve strateji belgeleri.

Mevcut milestone'lar yeniden numaralandırılmayacak, tamamlanmış özellikler yeniden yazılmayacak ve kullanıcı verisi kaybedilmeyecektir. Yeni küresel kabiliyetler M34-M41 olarak eklenecektir.

## 1. Ürün kararı

KALKAN_OS genel amaçlı chatbot, mevzuat haber sitesi, doküman deposu veya checklist uygulaması değildir.

Ürün kategorisi:

> **Türkiye ve AB odaklı Regulatory Control Plane:** hangi düzenlemenin neden uygulanacağını belirleyen, yükümlülüğü çalışan kontrole dönüştüren, teknik sistemlerden kanıt toplayan ve sonucu regülatör/denetçi için doğrulanabilir şekilde sunan sürekli uyum işletim sistemi.

Ana zincir:

```text
resmî kaynak -> tarihsel hüküm -> uygulanabilirlik -> yükümlülük
-> politika -> kontrol -> test -> kanıt -> bulgu
-> düzeltme -> yeniden test -> karar makbuzu -> Proof Room
```

Pazarlama ve UI şu iddiaları kullanmayacaktır:

- “tam uyum garantisi”;
- “ceza alınmaz”;
- “AI hukuki karar verir”;
- “bağımsız denetim veya sertifikasyonun yerine geçer”.

Doğru ürün sözü:

> KALKAN_OS, uygulanabilir yükümlülüklerin belirlenmesini, kontrollerin işletilmesini ve uyum kanıtının sürekliliğini yönetir; zorunlu dış denetim ve uzman hizmetlerini aynı platform üzerinde koordine eder.

## 2. Bilinen repository durumu — kör kabul etme, doğrula

Aşağıdakiler önceki doğrulanmış ilerleme raporudur; repository keşfinde teyit edilmelidir:

- M12 kontrol testleri UI ve gerçek Chromium E2E ile çalışıyor.
- M16 SoD ilk dikey dilimi, DB guard'ları, RLS, audit ve farklı kullanıcı onayıyla çalışıyor.
- Süresi dolan SoD istisnası `EXCEPTION_APPROVED -> REOPENED` otomasyonuna sahip.
- Süresi dolan kontrol kanıtı `kismi` durumuna düşüyor.
- Zamanlama BullMQ yerine onaylı Postgres/`pg_cron` yaklaşımı kullanıyor.
- Son raporlanan test tabanı 581 birim + 17 E2E ve sıfır skip idi; güncel sayı repository'den alınmalıdır.
- M17 ve M18 kodlanmamış, ADR/tasarım düzeyindedir.
- M11 JWS anahtarı/saklama yeri ve RFC 3161 TSA seçimi kurucu kararına bağlıdır.

Bu maddeler güncel kodla uyuşmuyorsa sessizce varsayım yapma; farkı raporla.

## 3. İlk işlem — repository keşfi

Kod yazmadan önce:

1. `git status`, aktif branch ve son commitleri incele.
2. `AGENTS.md`, `CLAUDE.md`, `ROADMAP`, ADR, package scripts ve CI'ı oku.
3. `rg --files` ile uygulama, migration, test, Supabase ve deployment yapısını çıkar.
4. Mevcut milestone numaralarını ve durumlarını repository'den doğrula.
5. Birim, integration ve Playwright E2E baseline'ını çalıştır.
6. Skip, flaky test, durgun dev server ve port çakışmasını ayır.
7. Supabase RLS/policy, storage bucket, pg_cron ve tenant izolasyonunu incele.
8. Hostinger deployment ve environment secret akışını incele.
9. Bu talimatla repository arasındaki boşlukları `docs/adr/` veya `ROADMAP` güncellemesi olarak öner.
10. İlk kod değişikliğinden önce kısa bir baseline raporu ver.

Kullanıcıya ait dirty worktree değişikliklerini silme, resetleme veya üzerine yazma.

## 4. Değişmez güvenlik ve hukuk invariant'ları

1. Her domain tablosu tenant-scope ve RLS ile korunur.
2. Service-role yalnız sunucu/worker katmanında ve en dar yetkiyle kullanılır.
3. UI veya API route kontrolü DB invariant'ının yerine geçmez.
4. Hazırlayan kendi onayını, istisnasını veya kapanışını onaylayamaz.
5. AI yükümlülüğü `VERIFIED` yapamaz, risk kabul edemez, bulgu kapatamaz, istisna onaylayamaz.
6. Hukuk uzmanı onayı olmayan SPK/BDDK/7545/AB çıkarımı `TODO_DOGRULA/DRAFT` doğar.
7. `NOT_APPLICABLE`, `UNKNOWN` ve `APPLICABLE` ayrı durumlardır; sessiz default yoktur.
8. Superseded veya yürürlük dışı hüküm zorunlu kontrolü çalıştıramaz.
9. Her execution, karar anındaki hukuk sürümünü ve mapping sürümünü snapshot eder.
10. Kanıtın ham dosya hash'i, metadata/manifest hash'i, deterministik rapor verisi hash'i ve nihai paket hash'i ayrıdır.
11. Rapor kendi hash'ini içermez; deterministik rapor verisinin hash'i kullanılır.
12. Canonicalization sıralama-bağımsız ve deterministiktir.
13. Connector başarısızlığı kontrolü `PASSED` bırakmaz; `UNKNOWN/STALE` davranışı uygulanır.
14. Kanıt tazeliği ve expiration otomatik kontrol durumu üretir.
15. Her privileged işlem immutable audit kaydı üretir.
16. Raw regulatory artifact değiştirilemez object version olarak saklanır.
17. Standartların lisanslı tam metni izinsiz seed edilmez; metadata/citation ve lisans politikası uygulanır.
18. Dış uzman erişimi tenant + matter + scope + süreyle sınırlıdır.
19. Tenant ID istemciden güvenilmez; authenticated context'ten türetilir.
20. Import ve connector girişleri boyut, MIME, formula injection, zip bomb, parser ve SSRF saldırılarına karşı korunur.
21. Migration backward-compatible, idempotent ve rollback/recovery planlıdır.
22. Hassas kanıt LLM'e varsayılan olarak gönderilmez; redaction ve data classification uygulanır.
23. AI çağrısı source passage, model, prompt/template sürümü, parametre, çıktı hash'i, confidence ve reviewer kararını kaydeder.
24. Public blockchain'e kişisel veri, sır veya ham kanıt yazılmaz.
25. Dış rating veya AI skoru otomatik vendor kabul/red kararına dönüşmez.

## 5. Mimari sınır — Hostinger + Supabase

### Supabase

Supabase aşağıdakilerin ana katmanıdır:

- PostgreSQL domain verisi;
- tenant RLS ve authorization policy;
- kullanıcı/oturum kimliği;
- object storage metadata ve bucket policy;
- transaction, trigger ve audit invariant'ları;
- idempotent SQL fonksiyonları;
- `pg_cron` ile küçük ve güvenli periyodik DB işleri;
- Realtime yalnız izinli, düşük hassasiyetli durum güncellemeleri.

Supabase Edge Function; uzun süren connector, tarama, AI batch veya PDF render işlerinin varsayılan yeri değildir.

### Hostinger

Hostinger aşağıdakileri çalıştırabilir:

- web uygulaması ve API;
- izole worker/connector runner;
- queue consumer gerekiyorsa mevcut mimariyle uyumlu süreç;
- PDF/audit package renderer;
- offline verifier build ve artifact yayınlama;
- scheduled ingestion gerekiyorsa güvenli worker.

Connector ve worker'lar:

- ayrı process/container;
- outbound allowlist;
- timeout/retry/circuit breaker;
- idempotency key ve cursor;
- tenant-scoped credential reference;
- log redaction;
- secret rotation;
- health/freshness telemetry kullanır.

Secret'lar repository'ye, browser bundle'a, audit log'a veya hata mesajına girmez. Supabase ve Hostinger secret yönetimi mevcut deployment ile uyumlu kullanılmalıdır; yeni sağlayıcı kurucu onayı olmadan eklenmez.

## 6. Ürün paketleri

Ortak çekirdek korunur; entitlement ve içerik paketiyle ayrılır:

| Paket | Hedef | Ana kapsam |
|---|---|---|
| CFO Kalkanı | Büyük kurum finans departmanı | SoD, ödeme/vendor değişikliği, BEC/deepfake, kanıt, temel KVKK/AI risk |
| Regulated TR | Aracı kurum, banka, ödeme/e-para, KVHS | SPK/BDDK/TCMB/MASAK/7545, incident, source-to-proof, examination |
| EU Resilience | AB bağlantılı finans kuruluşu | DORA, TPRM/RoI, kritik hizmet, dayanıklılık ve raporlama |
| PrivacyOps | Tüm kurumsal segmentler | KVKK/GDPR ROPA, etki, başvuru, saklama ve ihlal |
| AI Assurance | AI kullanan kurumlar | AB AI Act, ISO 42001, NIST AI RMF ve agent governance |
| Partner Assurance | Danışman/denetçi/hukuk ağı | Matter workspace, review, receipt ve Proof Room |

Entitlement yalnız UI gizleme değildir; API ve DB authorization ile zorlanır.

## 7. Build / integrate / partner kararı

### Ürün içinde geliştir

- Türkiye/AB temporal hukuk ve source provenance;
- applicability ve obligation/control graph;
- policy lifecycle;
- control test, evidence freshness, finding/retest;
- TPRM workflow ve DORA RoI export;
- PrivacyOps kayıt ve değerlendirme workflow'u;
- AI/agent governance registry ve assurance workflow'u;
- regulatory examination ve partner room;
- Proof Room, receipt ve verifier;
- RegBench-TR.

### Connector/entegrasyon yap

- SIEM, EDR/XDR, IAM/PAM, CSPM ve ITSM;
- Pentera/Picus türü attack/security validation;
- SecurityScorecard/BitSight türü vendor rating;
- DLP, data discovery ve cookie/consent;
- KMS/HSM, e-imza ve RFC 3161 TSA;
- lisanslı standart ve global regulatory feed.

### Sıfırdan yapma

- SIEM, EDR, IAM/PAM;
- vulnerability scanner veya pentest/BAS motoru;
- dış saldırı yüzeyi rating ağı;
- tam DLP/data discovery;
- sertifikasyon kuruluşu veya hukuk bürosu yerine geçen sistem.

## 8. Uygulama programı ve kapılar

### Gate G0 — Baseline ve M16 üretim kapanışı

M16 kapanmadan yeni modüllerde geniş kodlama yapılmaz.

Kalanlar repository'de doğrulanıp şu sırayla tamamlanır:

- istisna uzatma/yenileme workflow'u;
- CSV assignment import: parse/normalize, dry-run/apply, stale-preview hash, DELTA/SNAPSHOT, manifest, rollback;
- transactional outbox ile SoD evaluation;
- assignment yönetim UI;
- değerlendirme tetikleri ve domain event;
- dashboard ve expiry görünürlüğü;
- güvenlik/IDOR/concurrency/property testleri;
- farklı kullanıcı/tenant E2E senaryoları;
- M17 ADR kararı.

CSV import tek PR'da yarım bırakılmaz. Aşamalar:

1. contract + parser + normalize + dry-run;
2. apply + outbox + idempotency + rollback;
3. UI + permissions + audit + gerçek Chromium E2E.

### Gate G1 — İlk SPK/7545 source-to-proof dikeyi

Dar kapsam:

- bir Türkiye resmî kaynağından immutable artifact;
- madde/fıkra temporal version;
- manuel dört-göz `VERIFIED` obligation;
- institution profile ve açıklanabilir applicability;
- en az 20 uzman doğrulamalı SPK/7545 kontrolü;
- en az 5 connector/deterministic test;
- finding -> remediation -> retest -> closure;
- legal snapshot + evidence envelope + audit package;
- Proof Room ve offline verifier.

Geniş AB corpus, public blockchain ve ZKP bu gate'e girmez.

### Gate G2 — M34 Policy & Procedure Lifecycle

Veri modeli:

```text
PolicyDocument
PolicyVersion
PolicyClause
PolicyApproval
PolicyAttestation
PolicyException
PolicyImpact
```

Gerekli davranış:

- maddeyi hüküm/yükümlülük/kontrol/eğitime bağlama;
- draft-review-approved-effective-retired state machine;
- redline ve effective date;
- preparer/approver ayrımı;
- mevzuat değişikliğinden clause impact;
- çalışan attestation;
- AI taslağında kaynak ve human review.

### Gate G3 — M39 Connector Hub ve Proof Infrastructure

İlk üç üretim connector'ı pilot müşterinin gerçek stack'ine göre seçilir. Varsayılan adaylar:

1. Microsoft Entra ID/M365;
2. Microsoft Defender/Sentinel veya pilot SIEM/EDR;
3. AWS/Azure/GCP ya da pilotun kullandığı kritik cloud/ITSM.

Ortak connector sözleşmesi:

```text
ConnectorDefinition
ConnectorCredentialRef
ConnectorInstallation
ConnectorRun
ConnectorCursor
RawObservation
NormalizedObservation
EvidenceCandidate
FreshnessPolicy
```

Her connector contract, retry, cursor, idempotency, secret-redaction, RLS/tenant, timeout ve fixture testine sahiptir.

Proof katmanı:

- deterministic evidence envelope;
- JWS imza adapter interface;
- RFC 3161 TSA adapter interface;
- key/TSA seçilmeden mock/dev implementation production sayılmaz;
- offline verifier;
- portable audit package;
- tenant-scope Proof Room.

### Gate G4 — M35 Third-Party & ICT Supply-Chain Risk

Veri modeli:

```text
ThirdParty
FourthParty
ThirdPartyService
ThirdPartyDataAccess
ThirdPartyContract
ThirdPartyAssessment
ThirdPartyQuestionnaire
ThirdPartyEvidence
ThirdPartyFinding
ExitPlan
ConcentrationScenario
DoraRegisterRecord
```

Kabul:

- vendor tiering ve due diligence;
- service/data/critical-service dependency;
- contract clause ve renewal/expiry;
- fourth-party ve concentration;
- exit plan/exercise;
- DORA RoI validation/export;
- dış rating adapter, fakat human decision;
- cross-tenant ve vendor-portal authorization E2E.

### Gate G5 — M37 AI Assurance & Agent Governance

M30 AB AI Act içerik paketidir; M37 kurum içi operasyonel AI/agent yönetim sistemidir.

Veri modeli:

```text
AISystem
AIAgent
AIModelVersion
AIUseCase
AIRoleClassification
AIRiskClassification
AIDataLineage
AIEvaluation
AIHumanOversight
AIIncident
AIVendor
AIControl
AIExecutionReceipt
```

Kabul:

- AI keşif/intake ve owner;
- provider/deployer/importer/distributor rolü;
- prohibited/high/limited/minimal risk sınıfı;
- FRIA/DPIA ilişkisi;
- model/system card, data lineage ve eval;
- prompt/model sürümü ve runtime signal;
- human oversight ve kill/disable workflow;
- AI literacy M18 bağlantısı;
- EU AI Act + ISO 42001 + ISO 23894 + NIST AI RMF crosswalk;
- KALKAN_OS AI ajanlarının da aynı governance altında olması.

### Gate G6 — M36 PrivacyOps

Veri modeli:

```text
ProcessingActivity
DataCategory
DataSubjectCategory
LawfulBasis
DataRecipient
RetentionRule
PrivacyAssessment
DataSubjectRequest
TransferAssessment
PrivacyIncident
PrivacyNotice
```

Kabul:

- ROPA;
- DPIA/LIA/TIA;
- DSAR identity verification ve clock;
- retention/disposal evidence;
- cross-border transfer;
- breach assessment ve authority/data-subject clock;
- consent/data discovery connector sınırı;
- KVKK/GDPR source lineage.

### Gate G7 — M38 Regulatory Engagement & M41 Partner Network

Veri modeli:

```text
RegulatoryMatter
RegulatoryRequest
RegulatoryResponse
RegulatoryMeeting
SubmissionReceipt
ExternalOrganization
ExternalProfessional
MatterAccessGrant
IndependenceDeclaration
ExternalReview
ReviewNote
```

Kabul:

- otorite request/PBC list ve deadline;
- response version, approval, submission receipt;
- finding/remediation/retest bağlantısı;
- matter-scoped dış erişim;
- independence/conflict declaration;
- denetçi/hukukçu/pentester/vCISO teslimatı;
- bütün görüntüleme/export/yorumların audit'i;
- güvenli dış kullanıcı E2E.

### Gate G8 — Mevcut M13/M17/M18 genişlemesi ve M40

M13:

- BIA, RTO/RPO, impact tolerance;
- critical service dependency graph;
- plausible scenario, exercise, actual result ve recovery strategy.

M17:

- audit universe, risk-based plan;
- population, sample, methodology, seed;
- PBC/request, workpaper, review note;
- preparer/reviewer/sign-off ve independence;
- reproduce/export.

M18:

- role/control/risk bazlı assignment;
- sınav ve geçme eşiği;
- AI literacy;
- phishing/tabletop participation;
- competence gap ve retraining;
- attestation evidence.

M40:

- risk appetite/tolerance;
- KRI and trend;
- scenario loss distribution and assumptions;
- control cost vs risk reduction;
- board decision/attestation receipt.

## 9. AI ajan mimarisi

AI tek bir sınırsız sohbet kutusu olarak eklenmez. Ayrı görev ajanları kullanılır:

- Regulatory Research Agent;
- Change/Impact Agent;
- Applicability Draft Agent;
- Control Compiler Agent;
- Evidence Review Agent;
- Policy Draft/Gap Agent;
- Audit Workpaper Agent;
- Privacy Assessment Assistant;
- AI Assurance Assistant;
- Executive Briefing Agent.

Her ajan:

- dar tool allowlist;
- tenant ve record scope;
- structured input/output schema;
- source citation;
- confidence/uncertainty;
- human approval gate;
- prompt/model/version log;
- token/cost/latency telemetry;
- adversarial test ve RegBench-TR gate kullanır.

RAG yanıtı ürün gerçeği değildir. Resmî kaynak, doğrulanmış mapping ve deterministik test sonucu kaynak gerçeğidir.

## 10. Blockchain ve kriptografik kanıt sınırı

Öncelik sırası:

1. deterministic canonicalization;
2. SHA-256/hash agility;
3. JWS/COSE imza;
4. RFC 3161 zaman damgası;
5. offline verifier;
6. SCITT uyumlu transparency statement araştırması;
7. yalnız hash/batch root için opsiyonel public-chain anchor;
8. ZK proof yalnız Ar-Ge feasibility.

Public blockchain MVP ve compliance doğruluğunun koşulu değildir. Zincire ham belge, kişisel veri, tenant kimliği veya ticari sır yazılmaz.

## 11. UI/UX talimatı

Arayüz modern, kurumsal, sanatsal fakat operasyonel olarak hızlı olmalıdır.

Zorunlu:

- responsive desktop/tablet/mobile;
- dark/light/system tema;
- WCAG AA kontrast ve keyboard navigation;
- Türkçe birincil, i18n hazır;
- yoğun tablolar için filter, saved view, bulk action ve export;
- her AI önerisinde kaynak, confidence ve reviewer;
- her durum rozetinde açıklama ve geçmiş;
- empty/loading/error/stale/unknown durumları;
- destructive action confirmation;
- tenant ve paket context'inin görünür olması.

Ana navigasyon:

```text
Genel Bakış
Regülasyonlar
Yükümlülükler
Politikalar
Kontroller ve Testler
Kanıtlar / Proof Room
Bulgular ve Aksiyonlar
Kritik Hizmetler
Tedarikçiler
Gizlilik
AI Assurance
Denetim
Regülatör İşlemleri
Eğitim
Raporlar
Entegrasyonlar
Yönetim / Ayarlar
```

Dashboard yalnız uyum yüzdesi göstermez. Şunları ayırır:

- doğrulanmış uygulanabilir yükümlülük;
- stale/unknown/failed control;
- yaklaşan yürürlük ve bildirim saati;
- açık yüksek risk finding;
- tedarikçi yoğunlaşması;
- kritik hizmet tolerans açığı;
- AI high-risk sistem ve eksik değerlendirme;
- kanıt tazeliği;
- regulator request deadline.

## 12. Test ve `done` kapısı

Bir özellik aşağıdakiler tamamlanmadan `done` değildir:

- schema + migration + rollback/recovery notu;
- RLS/policy + authorization testleri;
- domain/service/API testleri;
- deterministic/property/idempotency testleri;
- concurrency/race testleri gereken yerde;
- audit event testleri;
- migration ve fixture uyumu;
- error/unknown/stale davranışı;
- UI accessibility temel kontrolleri;
- gerçek Chromium Playwright E2E;
- dokümantasyon/ADR/ROADMAP güncellemesi;
- tüm mevcut test tabanının yeşil olması;
- skip/todo ile sahte yeşil yaratılmaması.

Minimum güvenlik testleri:

- cross-tenant IDOR;
- privilege escalation;
- preparer/approver conflict;
- expired exception/evidence;
- forged/stale import preview;
- duplicate/out-of-order event;
- connector secret leakage;
- SSRF/redirect/DNS rebinding connector egress;
- malicious PDF/CSV/ZIP/formula;
- AI prompt injection ve citation spoofing;
- Proof Room token scope/expiry;
- offline receipt tamper;
- source artifact substitution;
- superseded law execution.

E2E senaryoları yalnız fixture/SQL ile atlanmaz; kullanıcı akışını browser'da tamamlar.

## 13. Performans ve ticari kabul metrikleri

- İlk uygulanabilir yükümlülük: `<60 dakika`
- Hazır connector ile ilk kanıt: `<1 iş günü`
- Resmî değişiklikten insan onaylı etki: `<24 saat`
- Audit package: `<1 saat`
- Uzman doğrulamalı ilk SPK/7545 kontrol seti: `>=20`
- Gerçek tasarım ortağı: `>=3`
- AI unsupported claim, reviewer kabul/red/düzeltme oranları
- Otomatik veya tekrar kullanılan kanıt yüzdesi
- Finding -> verified closure süresi
- Connector freshness ve hata oranı
- Denetçi/regülatör belge bulma süresi

## 14. Kurucu adına verilmeyecek kararlar

Aşağıdakilerde adapter/interface, ADR seçenekleri ve güvenli development fallback hazırlanır; production seçimi uydurulmaz:

- JWS anahtar tipi, sahibi ve KMS/HSM saklama yeri;
- RFC 3161 TSA sağlayıcısı ve hukuki kabul kriteri;
- ISO ve diğer lisanslı standartların içerik lisansı;
- global regulatory feed satın alma kararı;
- ilk üç pilot connector'ın müşteri stack'i;
- bağımsız hukuk/denetim partnerleri;
- public blockchain network/anchor kararı;
- veri yerleşimi veya yeni hosting sağlayıcısı;
- müşteriye karşı verilecek hukuki garanti/SLA;
- AI model sağlayıcısı ve hassas veri işleme sözleşmesi.

Bu kararlardan biri blokluyorsa diğer güvenli, geri alınabilir ve test edilebilir işleri tamamla; blokajı seçenek/maliyet/risk tablosuyla raporla.

## 15. Her PR sonunda rapor formatı

```text
PR/Gate:
Teslim edilen kullanıcı sonucu:
Değişen dosyalar:
Migration ve RLS:
Güvenlik invariant'ları:
Test sonucu (unit/integration/e2e/skip):
Canlı/yerel doğrulama:
Bilinen borç veya kapsam dışı:
Açık kurucu kararı:
Sonraki tek mantıklı PR:
```

“Çalışıyor” denebilmesi için test komutu ve gerçek sonuç bulunmalıdır. Port çakışması, durgun server, bilinçli skip ve ürün hatası ayrı raporlanır.

## 16. Claude Code'a verilecek başlangıç komutu

```text
Bu repository'de yalnız CLAUDE_CODE_KALKAN_OS_NIHAI_TEK_TALIMAT.md dosyasını bağlayıcı kurucu talimatı olarak kabul et.

Önce repository keşfi, git durumu, ROADMAP/ADR, migration/RLS ve tam test baseline'ını çıkar. Eski Claude talimatlarını uygulama; tarihsel materyal say. Mevcut milestone numaralarını değiştirme.

Baseline yeşil ve repository durumu raporlandıktan sonra Gate G0'dan başla. Tek turda birçok modülü yarım bırakma. Her PR'ı migration, RLS, audit, güvenlik testleri ve gerçek Chromium E2E ile bağımsız çalışan dikey olarak teslim et.

Kurucu kararı gerektiren JWS anahtarı, KMS/HSM, RFC 3161 TSA, lisans, connector ve dış partner seçimlerini uydurma. Interface/ADR seçeneklerini hazırla ve blokajı açıkça raporla.
```

