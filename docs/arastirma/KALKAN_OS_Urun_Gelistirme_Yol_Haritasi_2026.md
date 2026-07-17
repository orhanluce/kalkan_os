<!-- Repo kopyası. Kaynak: C:\Users\orhan\Downloads\KALKAN_OS_Urun_Gelistirme_Yol_Haritasi_2026.md
     (kurucu, 17 Temmuz 2026). Araç kesintisi nedeniyle `cp` yerine oturum içinden birebir
     yazıldı — bir sonraki oturumda `diff` ile kaynağa karşı doğrulanacak (CLAUDE.md borç listesi). -->

# KALKAN_OS Ürün Geliştirme Yol Haritası

## Finansal Siber Güvenlik Araştırmasının Ürüne Dönüşümü

**Tarih:** 17 Temmuz 2026  
**Plan ufku:** 12 aylık ürünleşme + 24 aylık platform vizyonu  
**Sprint modeli:** 2 haftalık sprintler  
**Mevcut teknik temel:** Next.js/TypeScript, NestJS, PostgreSQL/Prisma, Redis/BullMQ, Keycloak/OIDC, MinIO, OpenTelemetry ve Docker  
**Mevcut ürün çekirdeği:** Kurum/kullanıcı/rol, mevzuat-kontrol kütüphanesi, çoklu çerçeve eşleme, kanıt yükleme/sürüm/geçerlilik, değerlendirme, bulgu/aksiyon, dashboard, denetçi odası, denetim paketi/YK raporu, immutable history ve simülasyon şablonları.

---

## 1. Ürün hedefi

KALKAN_OS’un hedefi bir SIEM, EDR, antivirüs, pentest veya klasik GRC ürünü olmak değildir. Ürün şu zinciri çalıştırmalıdır:

> **Resmî yükümlülük → uygulanabilirlik → ortak kontrol → kontrol uygulaması → canlı test → doğrulanabilir kanıt → değerlendirme → bulgu/aksiyon → yeniden test → doğrulanmış kapanış → olay/denetçi/yönetim kurulu çıktısı**

Yeni yol haritası, mevcut MVP’yi üç aşamada dönüştürür:

1. **Kanıt yönetiminden sürekli güvenceye:** Kanıtın yalnız dosya değil; kaynak, kapsam, test, bütünlük ve güven seviyesi taşıması.
2. **Kontrol uyumundan finansal dayanıklılığa:** Kontrollerin kritik ödeme, emir, takas, müşteri ve hazine hizmetlerini tolerans içinde koruduğunun ölçülmesi.
3. **Tek kurum ürününden güvence platformuna:** Denetçi, teknik test sağlayıcısı, tedarikçi ve düzenleyici çıktılarının açık şemalarla paylaşılması.

### 1.1. İlk 12 ayın başarı tanımı

KALKAN_OS v1.0 aşağıdakileri uçtan uca gösterebilmelidir:

- SPK VII-128.10 ve 7545 kapsamının kurum profiline göre belirlenmesi;
- bir ortak kontrolün Entra ID/AWS/Jira/backup/BAS gibi bir kaynaktan otomatik test edilmesi;
- test sonucunun imzalı ve doğrulanabilir Evidence Envelope olarak saklanması;
- başarısız testten otomatik bulgu/aksiyon doğması;
- aksiyon tamamlandığında yeniden test olmadan kapanış verilmemesi;
- kontrolün hangi kritik finansal hizmeti koruduğunun gösterilmesi;
- bir siber olayda ilgili bildirim saatlerinin otomatik başlatılması;
- yedekten dönüşün yalnız teknik açılış değil, finansal mutabakatla doğrulanması;
- denetçinin aynı veri/model sürümüyle sonucu yeniden üretmesi;
- yönetim kurulu raporunun karar, risk ve kanıt soyunu göstermesi.

---

## 2. Mevcut MVP’ye eklenecekler

### 2.1. Mevcut modüllerin güçlendirilmesi

| Mevcut modül | Korunacak yetenek | Eklenecek yetenek |
|---|---|---|
| Kurum ve kimlik | Tenant, kullanıcı, rol, OIDC | ABAC, kritik rol/SoD, geçici denetçi erişimi, break-glass, non-human identity |
| Mevzuat ve kontrol | SPK/7545 kontrol kütüphanesi, eşleme | Resmî kaynak soyu, sürüm/yürürlük/ilga, Scope Engine, OSCAL import/export, değişiklik etkisi |
| Kanıt | Dosya yükleme, sürüm, geçerlilik | Evidence Envelope, otomatik toplama, imza/zaman, kapsam/örneklem, güven skoru, redaction/legal hold |
| Değerlendirme ve gap | Kontrol değerlendirmesi | Test tanımı/çalıştırma, `Failed–Unknown–Stale` ayrımı, çok eksenli assurance görünümü |
| Bulgu ve aksiyon | Owner, tarih, durum | Root-control bağı, risk kabul süresi, otomatik retest, verified closure |
| Auditor Room | Paylaşım ve inceleme | Sampling, request list, annotation, independence, read receipt, reproducibility |
| Dashboard/rapor | Uyum ve YK raporu | Kritik hizmet, kanıt güveni, actual RTO/RPO, bildirim SLA, risk dağılımı ve karar izi |
| Simülasyon | Ransomware, ayrıcalıklı hesap, veri sızıntısı, backup ve tedarikçi senaryoları | Inject/karar zaman çizelgesi, TLPT, teknik sonuç, recovery proof ve after-action/retest |
| Immutable history | Audit event | Paket manifesti, bağımsız verify CLI, WORM export, signer/timestamp ve hash ayrımı |

### 2.2. Yeni çekirdek modüller

| Kod | Modül | Öncelik | İlk sürüm |
|---|---|---|---|
| M01 | Evidence Envelope & Integrity Service | P0 | v0.2 |
| M02 | Control Test DSL & Continuous Control Monitoring | P0 | v0.3 |
| M03 | Regulation Scope Engine & Knowledge Graph | P0 | v0.3 |
| M04 | Critical Financial Service & Impact Tolerance | P0 | v0.4 |
| M05 | Incident Clock & Multi-Authority Reporting | P0 | v0.4 |
| M06 | Recovery Proof & Financial Reconciliation | P0 | v0.5 |
| M07 | CFO Kalkanı | P0/P1 | v0.5 |
| M08 | Connector Platform & Isolated Runner | P0/P1 | v0.3 |
| M09 | Third/Nth-Party Concentration Graph | P1 | v0.7 |
| M10 | TLPT/TIBER/CBEST/iCAST Workspace | P1 | v0.7 |
| M11 | DORA & FSB FIRE Pack | P1 | v0.6 |
| M12 | Cyber Stress Lab | P2 | v0.8 |
| M13 | Cyber Risk Quantification Lite | P2 | v0.9 |
| M14 | AI/Model/Agent Assurance | P2 | v0.9 |
| M15 | Crypto Agility & PQC Registry | P2 | v0.9 |
| M16 | SBOM/Software Supply-Chain Assurance | P2 | v0.8 |
| M17 | KALKAN Passport & Assurance Exchange | P3 | v1.1+ |
| M18 | Anonymous Sector Benchmark & Exercise Network | P3 | v1.2+ |

---

## 3. Modül tanımları ve kabul kriterleri

## M01 — Evidence Envelope & Integrity Service

### Amaç

Kanıtı “yüklenen dosya” olmaktan çıkarıp hangi kontrol/test için, kim tarafından, hangi kaynaktan, hangi kapsam ve dönemde toplandığı doğrulanabilen bir nesneye dönüştürmek.

### Eklenecekler

- `EvidenceEnvelope` veri modeli;
- kaynak sistem, connector, sorgu/prosedür ve source object referansı;
- population, sample size ve dönem bilgisi;
- content hash, envelope hash, signer identity ve trusted timestamp;
- saklama sınıfı, legal hold ve redaction policy;
- kaynak otoritesi, bağımsızlık, güncellik, tamlık ve yeniden üretilebilirlik bileşenleri;
- manuel kanıt ile otomatik kanıtın açık ayrımı;
- ham, redacted ve paylaşılan sürümler için ayrı hash/manifest.

### Teknik kararlar

- SHA-256 başlangıç algoritması; algoritma alanı zorunlu;
- JSON Canonicalization Scheme/RFC 8785 uyumlu canonical veri;
- JWS veya COSE imza; tenant/customer-managed key desteğine açık tasarım;
- RFC 3161 entegrasyonu opsiyonel ilk sürüm, zorunlu production hedefi;
- MinIO Object Lock/WORM politika desteği;
- ham kanıt veritabanında değil object storage’da; metadata PostgreSQL’de.

### Kabul kriterleri

- Kanıtta tek byte değişikliği doğrulamada yakalanır.
- Aynı canonical veri üç ortamda aynı hash’i üretir.
- Kanıtın source, subject, period, collector ve test bağlantısı olmadan `Operating` sonucu verilemez.
- Redacted sürüm orijinal kanıtla soy ilişkisini korur ancak farklı hash taşır.
- Legal hold altındaki kanıt silinemez; deneme audit event üretir.

## M02 — Control Test DSL & Continuous Control Monitoring

### Amaç

Kontrolün tasarlandığını değil, canlı ortamda gerçekten çalıştığını deterministik testlerle göstermek.

### Test türleri

- `manual-procedure`;
- `api-query`;
- `configuration-assertion`;
- `sample-review`;
- `attack-simulation`;
- `restore-test`;
- `interview/observation`;
- `composite-test`.

### Test tanımı alanları

- kontrol ve kritik hizmet bağlantısı;
- giriş şeması ve connector;
- güvenlik sınırı/rules of engagement;
- beklenen sonuç ve assertion;
- sıklık, grace period ve freshness;
- population/sample yöntemi;
- başarısızlık önem derecesi;
- evidence output specification;
- otomatik aksiyon ve retest kuralı;
- test/tool/schema sürümü.

### Kontrol durumları

`Not scoped → Scoped → Designed → Implemented → Evidence pending → Operating → Degraded/Failed/Unknown/Stale → Remediation → Retest pending → Verified closed`

### Kabul kriterleri

- Connector arızası `Failed` değil `Unknown` üretir.
- Kanıt süresi dolunca `Stale/Assurance degraded` görünür.
- Başarısız test otomatik bulgu oluşturabilir.
- Ticket kapatılması bulguyu kapatmaz; başarılı retest ve yetkili onay gerekir.
- Aynı test aynı fixture ve sürümle deterministik sonuç verir.

## M03 — Regulation Scope Engine & Knowledge Graph

### Amaç

SPK, BDDK, 7545 ve uluslararası çerçeveleri statik listeler yerine sürümlü, uygulanabilirlik koşullu ve ortak kontrollere bağlı bilgi grafiği hâline getirmek.

### Eklenecekler

- `RegulationSource`, `Requirement`, `ApplicabilityRule`, `CommonControl`, `Mapping`;
- resmî URL, madde/fıkra/bent, yayımlanma/yürürlük/ilga tarihleri;
- kurum tipi, büyüklük, faaliyet, müşteri, teknoloji ve muafiyet koşulları;
- CEL/JSON Logic tabanlı uygulanabilirlik ifadesi;
- mevzuat değiştiğinde etkilenen kontrol, kanıt ve raporların bulunması;
- OSCAL catalog/profile import ve export;
- insan onaylı AI eşleme adayı; AI sonucu doğrudan kesin eşleme yapamaz.

### İlk içerik paketleri

1. SPK VII-128.10;
2. 7545 ortak kontrol eşlemesi;
3. BDDK ortak kontrol taslağı;
4. NIST CSF 2.0;
5. ISO 27001/27002 ve COBIT crosswalk;
6. DORA starter profile;
7. önceki VII-128.9 için `superseded` geçmiş kaydı.

### Kabul kriterleri

- En az 20 kurum profili senaryosunda uzmanla %100 kapsam mutabakatı.
- Her kontrol sonucu resmî requirement paragrafına kadar izlenebilir.
- Muafiyet bir kontrolü `Passed` yapmaz; uygulanabilirlik/gerekçe olarak gösterir.
- “As of date” sorgusu geçmiş tarih için doğru düzenleme sürümünü döndürür.

## M04 — Critical Financial Service & Impact Tolerance

### Amaç

Teknik varlık listesini; müşteriye veya piyasaya sunulan kritik hizmet, etki toleransı ve insan/süreç/teknoloji/tedarikçi bağımlılıklarıyla birleştirmek.

### Örnek hizmetler

- müşteri para transferi;
- emir alma/iletme/gerçekleştirme;
- piyasa verisi yayını;
- takas/teminat/mutabakat;
- müşteri hesap erişimi;
- hazine ve kurumsal ödeme;
- bordro/toplu ödeme;
- kripto saklama/transfer.

### Etki toleransı alanları

- maksimum kesinti süresi;
- maksimum veri kaybı;
- işlenemeyen müşteri/işlem hacmi;
- kabul edilebilir mutabakat farkı;
- müşteri zararı ve korunmasız müşteri eşiği;
- piyasa/üye etkisi;
- manuel kapasite;
- onaylayan yönetim organı;
- son test ve actual result.

### Teknik karar

İlk sürümde Neo4j eklenmemeli. PostgreSQL node/edge tabloları, recursive CTE ve materialized view ile başlanmalı; performans/analitik ihtiyacı kanıtlanırsa graph database değerlendirilmelidir.

### Kabul kriterleri

- Bir kritik hizmetten destekleyen sistem, kimlik, ekip, tesis ve tedarikçilere gidilebilir.
- Tek sağlayıcı/region/IAM failure-domain sorgusu yapılabilir.
- Senaryo sonucu toleransla otomatik karşılaştırılır.
- Tolerans değişikliği yönetim kararı ve audit event olmadan yürürlüğe giremez.

## M05 — Incident Clock & Multi-Authority Reporting

### Amaç

Bir olayın kurum içi ve dış bildirim yükümlülüklerini, saatlerini, onaylarını ve teslim kanıtlarını tek zaman çizelgesinde yönetmek.

### Eklenecekler

- olay algılama, ilk değerlendirme, sınıflandırma ve önem değişikliği zamanları;
- jurisdiction/authority/trigger bazlı saat kuralları;
- iş günü/tatil/timezone desteği;
- alan bazlı rapor şablonu ve veri soyu;
- ilk/ara/nihai rapor;
- submission receipt, response ve düzeltme;
- SPK/7545/KVKK/CERT konfigürasyonu;
- DORA 4 saat/24 saat/72 saat/1 ay örnek paketi;
- FSB FIRE export.

### Kabul kriterleri

- Olay sınıfı değiştiğinde yeni saat ve yükümlülükler deterministik oluşur.
- Her rapor alanının olay, kanıt veya onay kaynağı gösterilir.
- Gecikme ve eksik alanlar gerçek zamanlı alarm üretir.
- Rapor düzenlemesi önceki gönderimi değiştirmez; yeni sürüm ve gerekçe oluşturur.

## M06 — Recovery Proof & Financial Reconciliation

### Amaç

“Yedeğimiz var” veya “sistem açıldı” beyanı yerine, kritik finansal hizmetin doğru veriyle ve tolerans içinde geri döndüğünü kanıtlamak.

### Eklenecekler

- recovery attempt ve restore point;
- actual start/end, RTO ve RPO;
- yedek bütünlüğü ve malware/clean-room doğrulaması;
- servis sağlık kontrolleri;
- defter, bakiye, emir, pozisyon, ödeme ve kayıt sayısı mutabakatı;
- source/target toplam, kayıt sayısı ve hash;
- exception ve dual sign-off;
- müşteri/karşı taraf etkisi;
- after-action ve kontrol güncellemesi.

### Kabul kriterleri

- Başarılı teknik restore, reconciliation başarısızsa `Recovered` sayılmaz.
- Actual RTO/RPO otomatik hesaplanır ve toleransla karşılaştırılır.
- Her exception owner, karar, kapanış ve retest taşır.
- Aynı kurtarma testi denetim paketine bağımsız olarak aktarılabilir.

## M07 — CFO Kalkanı

### Amaç

Finans dışı şirketlerin finans/hazine departmanlarında BEC, deepfake yönetici talimatı, sahte IBAN değişikliği ve yetki birikimini önleyen ayrı ürün paketi oluşturmak.

### İlk kontrol paketi

1. Tedarikçi banka hesabı değişikliğinde bağımsız geri arama;
2. yeni alıcı için cooling-off ve ek onay;
3. ödeme bağlamı/fatura/sözleşme/tutar/alıcı hash’i;
4. deepfake/CEO talimatında ikinci kanal ve safe-word protokolü;
5. DMARC/SPF/DKIM ve look-alike domain kontrolü;
6. ERP–banka portalı görev ayrılığı;
7. banka imza yetkisi ve limit attestation;
8. bordro/toplu ödeme bütünlüğü ve mutabakatı;
9. M&A/finansal kapanış yüksek risk modu;
10. BEC/deepfake tabletop.

### Kabul kriterleri

- Vendor master değişikliği talep–teyit–onay–ödeme zincirine bağlanır.
- Çakışan ERP/banka rollerinde otomatik bulgu üretilir.
- Deepfake senaryosunda video/ses tek başına onay kabul edilmez.
- Paket, genel KALKAN çekirdeğini kullanır; ayrı ürün kod tabanı oluşturulmaz.

## M08 — Connector Platform & Isolated Runner

### Amaç

Güvenlik/IT sistemlerinden minimum ayrıcalıkla kanıt toplamak ve test çalıştırmak.

### İlk connector listesi

1. Microsoft Entra ID;
2. Active Directory/Keycloak;
3. AWS;
4. Azure;
5. GCP;
6. Jira;
7. ServiceNow;
8. GitHub/GitLab;
9. MinIO/S3 Object Lock;
10. backup platform generic;
11. OCSF/SIEM generic webhook;
12. BAS/pentest result generic.

### Güvenlik gereksinimleri

- short-lived credentials ve secret vault;
- tenant-specific runner;
- egress allowlist;
- read-only varsayılan;
- query allowlist ve rate limit;
- connector version/signature;
- ham logu merkezi sisteme almadan aggregation;
- ayrı kill switch ve health state;
- test fixture/sandbox.

### Kabul kriterleri

- Connector arızası kontrol sonucunu yanlış `Failed` yapmaz.
- Kullanılan sorgu/prosedür ve connector sürümü kanıtta görünür.
- Credential hiçbir log/evidence içine düşmez.
- Tenant A runner’ı Tenant B kaynağına erişemez.

## M09 — Third/Nth-Party Concentration Graph

### Amaç

Tedarikçi anketinden öte; kritik hizmetlerin CSP, SaaS, IAM, DNS, piyasa verisi, ödeme işlemcisi ve alt sağlayıcılardaki ortak bağımlılıklarını bulmak.

### Eklenecekler

- contract/arrangement ve hizmet;
- veri/erişim türü;
- subprocessor/nth-party;
- provider/region/failure domain;
- substitutability ve exit plan;
- audit/access rights;
- actual outage ve exercise history;
- external rating/attack surface sinyali;
- DORA Register of Information export.

### Kabul kriterleri

- Aynı sağlayıcıya bağlı tüm kritik hizmetler sorgulanabilir.
- Alt sağlayıcı bilinmiyorsa `Unknown dependency` görünür; düşük risk varsayılmaz.
- Tedarikçi skoru kritik hizmet etkisinden ayrı gösterilir.
- Çıkış planı tatbikatı ve kanıtı olmadan `Tested exit` işaretlenemez.

## M10 — TLPT Workspace

### Amaç

TIBER-EU, CBEST, STAR-FS ve iCAST benzeri istihbarat güdümlü testlerin güvenli kapsam, yürütme, bulgu ve retest zincirini yönetmek.

### Eklenecekler

- kritik hizmet/fonksiyon kapsamı;
- threat intelligence ve hedefleme gerekçesi;
- white-team vault ve need-to-know erişim;
- rules of engagement ve safety abort;
- scenario/objective/TTP;
- red-team activity ve blue-team observation;
- detection/response timeline;
- purple-team/replay;
- remediation plan ve retest;
- regulator/auditor export.

### Kabul kriterleri

- White-team gizli bilgisi normal kontrol sahibi veya denetçiye yanlışlıkla görünmez.
- Test sonucu normal olay istatistiklerini kirletmeden ayrı işaretlenir.
- Bulgu kapanışı retest kanıtı gerektirir.
- ATT&CK technique coverage raporu üretilir.

## M11 — DORA & FSB FIRE Pack

### Amaç

KALKAN_OS’u Avrupa finans kurumları ve AB ile çalışan teknoloji sağlayıcıları için hazır hâle getirmek.

### İçerik

- DORA ICT RM control profile;
- major incident classification/reporting;
- testing/TLPT profile;
- ICT third-party Register of Information;
- information-sharing record;
- FSB FIRE incident export;
- NIS2/GDPR ortak kontrol crosswalk.

### Kabul kriterleri

- Aynı kontrol birden çok DORA/NIS2/ISO yükümlülüğüne map edilebilir.
- RoI alanları tedarikçi/dependency grafiğinden üretilir.
- Olay raporu alanlarının source lineage’ı korunur.

## M12 — Cyber Stress Lab

### Amaç

Teknik siber olayı müşteri, işlem, ödeme kuyruğu, likidite, personel ve tedarikçi etkisine dönüştüren tekrarlanabilir senaryo motoru kurmak.

### İlk senaryolar

- ransomware + yedek bozulması;
- ayrıcalıklı hesap ele geçirme;
- kritik CSP/region kesintisi;
- ödeme işlemcisi outage + likidite sıkışması;
- aracı kurum emir kanalında DDoS;
- piyasa verisi gecikmesi/zehirlenmesi;
- BEC/deepfake ödeme;
- AI agent’ın finansal tool’u kötüye kullanması.

### Teknik yaklaşım

İlk sürüm tam dijital ikiz değil, parametreli discrete-event timeline olmalıdır. Ödeme ağı/dijital ikiz, yeterli tarihsel/sentetik veri ve model doğrulaması sağlandıktan sonra eklenmelidir.

### Kabul kriterleri

- Senaryo sürümlü ve aynı seed/parametrelerle yeniden çalıştırılabilir.
- Concurrent stress tanımlanabilir.
- Sonuç impact tolerance ile karşılaştırılır.
- İnsan kararları ve teknik olaylar aynı zaman çizelgesinde tutulur.

## M13 — Cyber Risk Quantification Lite

### Amaç

Teknik skoru sahte kesinlik üretmeden parasal risk ve bütçe kararına çevirmek.

### Eklenecekler

- scenario frequency ve loss magnitude dağılımları;
- primary/secondary loss;
- control effectiveness input;
- Monte Carlo;
- AAL, P50/P90/P99 ve loss exceedance;
- sensitivity analysis;
- input Evidence Envelope bağlantısı;
- model/version/assumption/calibration;
- yatırım öncesi/sonrası karşılaştırma.

### Kabul kriterleri

- Tek sayı yerine dağılım ve varsayımlar gösterilir.
- Veri olmayan parametre güven aralığıyla işaretlenir.
- Kullanıcı bir kontrol değişikliğinin model sonucuna etkisini izleyebilir.
- Model sonucu “uyum” veya “güvenli” kararı vermez.

## M14 — AI/Model/Agent Assurance

### Amaç

Finansal süreçlerde kullanılan model ve agent’ların varlık, tedarikçi, yazılım ve kullanıcı risklerini yönetmek.

### Eklenecekler

- model/provider/version/use/owner;
- training/fine-tuning/RAG data lineage;
- AI-BOM ve dependency;
- prompt/system instruction/tool permission;
- human approval ve override;
- adversarial/prompt-injection/data-leak testleri;
- drift, bias ve güvenlik olayı;
- model/vendor concentration;
- output citation/evidence trace.

### Kabul kriterleri

- AI çıktısı `Suggested–Reviewed–Approved–Executed` olarak ayrılır.
- Agent risk kabulü, bulgu kapatma veya ödeme işlemini tek başına yapamaz.
- Model/prompt/tool/version ve kullanılan kanıtlar audit trace taşır.

## M15 — Crypto Agility & PQC Registry

### Amaç

Algoritma, anahtar, sertifika ve protokol envanterinden post-kuantum geçiş planı üretmek.

### Eklenecekler

- algorithm/protocol/library/key/certificate;
- kullanım yeri ve kritik hizmet;
- data lifetime ve confidentiality horizon;
- owner/vendor/rotation/expiry;
- quantum vulnerability;
- migration target, dependency ve test;
- FIPS 203/204/205 readiness;
- crypto policy exception.

### Kabul kriterleri

- Kuantuma hassas algoritma kullanan kritik hizmetler sorgulanır.
- Data lifetime yüksek olan sistemler önceliklendirilir.
- Algoritma değişikliği performans, uyumluluk ve rollback testi taşır.

## M16 — SBOM & Software Supply-Chain Assurance

### Amaç

Kritik finansal hizmette çalışan yazılım bileşenlerini build kaynağı ve deployment’a kadar izlemek.

### Eklenecekler

- CycloneDX/SPDX import;
- VEX;
- build provenance/attestation;
- artefact/container signature;
- Sigstore/Rekor proof;
- release/deployment/service bağlantısı;
- vulnerability/exploitability ve remediation;
- model/AI artefact desteği.

### Kabul kriterleri

- CVE → component → artefact → deployment → critical service sorgusu 60 saniye altında.
- İmzasız veya provenance’sız release assurance düşürür.
- SBOM varlığı “güvenli” kabul edilmez; güncellik ve deployment kapsamı ölçülür.

## M17–M18 — Assurance Exchange, Passport ve Sektör Ağı

Bu modüller v1.0 sonrası geliştirilmelidir. Ham kanıt paylaşmadan süreli, imzalı assurance claim; minimum cohort ile anonim benchmark; ortak sektör tatbikatı ve düzenleyici/SupTech export sağlar.

Başlamadan önce gereken kapılar:

- en az 10 aktif kurum;
- standardize Evidence Envelope kullanımının oturması;
- hukuki paylaşım modeli;
- privacy/inference testleri;
- bağımsız doğrulayıcı ve claim revocation modeli.

---

## 4. Sürüm ve faz yol haritası

| Faz | Süre | Sürüm | Ana sonuç |
|---|---:|---|---|
| Faz 0 | Hafta 1–2 | Architecture baseline | ADR, şema ve migration planı |
| Faz 1 | Hafta 3–6 | v0.2 Evidence Core | Evidence Envelope, hash/package, verify CLI |
| Faz 2 | Hafta 7–12 | v0.3 Continuous Assurance | Test DSL, status machine, Scope Engine, connector runner |
| Faz 3 | Hafta 13–18 | v0.4 Financial Service & Incident | Kritik hizmet, impact tolerance, incident clock |
| Faz 4 | Hafta 19–24 | v0.5 Recovery & CFO | Recovery Proof, reconciliation ve CFO Kalkanı |
| Faz 5 | Hafta 25–30 | v0.6 DORA | DORA starter, FIRE, enhanced auditor room |
| Faz 6 | Hafta 31–36 | v0.7 TLPT & Third Party | TLPT workspace, concentration graph, RoI |
| Faz 7 | Hafta 37–42 | v0.8 Stress & Supply Chain | Stress Lab v1, SBOM/provenance |
| Faz 8 | Hafta 43–48 | v0.9 Emerging Risk | CRQ-lite, AI assurance, PQC registry |
| Faz 9 | Hafta 49–52 | v1.0 Production | Güvenlik, performans, DR, docs ve müşteri kabulü |

### Faz 0 — Hafta 1–2: mimari sabitleme

#### Teslimler

- ADR-001 Product Boundary;
- ADR-002 Evidence Envelope;
- ADR-003 Hash & Manifest;
- ADR-004 Control State Machine;
- ADR-005 Scope Rule Engine;
- ADR-006 Critical Service Graph;
- ADR-007 Connector Isolation;
- mevcut Prisma şeması ve API’ler için backward-compatible migration planı;
- feature flag ve versioning stratejisi;
- 50 kritik kontrol için priorite listesi.

#### Çıkış kapısı

- Mimari, ürün, güvenlik ve denetim sahipleri ADR’leri onaylar.
- Mevcut kullanıcı/kanıt/rapor verisinin kayıpsız migration testi geçer.

### Faz 1 — Hafta 3–6: v0.2 Evidence Core

#### Sprint 2

- Evidence Envelope tabloları/API;
- canonicalization/hash library;
- object storage metadata ve retention;
- signer identity.

#### Sprint 3

- dört hash’li report/package pipeline;
- bağımsız verify CLI;
- redacted evidence version;
- tamper ve fixture testleri.

#### Çıkış kapısı

- Audit package üç ortamda doğrulanır.
- 10 örnek kanıtın source/test/control lineage’ı eksiksizdir.

### Faz 2 — Hafta 7–12: v0.3 Continuous Assurance

#### Sprint 4

- Control Test DSL;
- TestDefinition/TestRun;
- deterministic assertion runner;
- state machine migration.

#### Sprint 5

- connector runner;
- Entra ID, AWS ve Jira connector;
- freshness scheduler/BullMQ;
- failure/unknown/stale ayrımı.

#### Sprint 6

- Scope Engine;
- RegulationSource/Requirement versioning;
- SPK VII-128.10 ve 7545 içerik doğrulaması;
- OSCAL-lite export.

#### Çıkış kapısı

- 20 kontrol, en az 5’i otomatik testlidir.
- Kaynak değişikliği p95 15 dakika içinde assurance durumuna yansır.
- Başarısız test → bulgu → aksiyon → retest → verified closure demosu çalışır.

### Faz 3 — Hafta 13–18: v0.4 Financial Service & Incident

#### Sprint 7

- CriticalBusinessService, ImpactTolerance;
- dependency node/edge;
- service owner ve board approval.

#### Sprint 8

- incident timeline/classification;
- notification rules/clock;
- timezone/tatil takvimi;
- submission receipt.

#### Sprint 9

- service dashboard;
- tolerans test sonucu;
- incident-to-control/evidence/finding bağlantısı;
- SPK/7545 olay şablonları.

#### Çıkış kapısı

- En az 5 kritik finansal hizmet ve bağımlılıkları modellenir.
- Bir ransomware senaryosunda olay saatleri ve tolerans sonucu otomatik oluşur.

### Faz 4 — Hafta 19–24: v0.5 Recovery & CFO

#### Sprint 10

- RecoveryAttempt;
- actual RTO/RPO;
- restore evidence;
- reconciliation rule/template.

#### Sprint 11

- dual sign-off ve exception;
- recovery report;
- backup connector;
- clean-room checklist.

#### Sprint 12

- CFO Kalkanı control pack;
- vendor bank change workflow;
- payment approval bundle;
- BEC/deepfake tabletop.

#### Çıkış kapısı

- Gerçek veya yüksek gerçeklikli restore testi finansal mutabakatla tamamlanır.
- CFO pilotunda sahte IBAN/deepfake talimatı süreç kontrolüyle durdurulur.

### Faz 5 — Hafta 25–30: v0.6 DORA

- DORA control profile;
- EBA major incident report fields;
- FSB FIRE export;
- DORA RoI temel modeli;
- auditor sampling/request/annotation;
- NIS2/ISO crosswalk.

#### Çıkış kapısı

- Tek olaydan DORA ilk/ara/nihai ve FIRE çıktıları üretilebilir.
- Alanların %100’ünde source lineage veya açık `unknown` bulunur.

### Faz 6 — Hafta 31–36: v0.7 TLPT & Third Party

- TLPT engagement, white-team vault, RoE ve safety abort;
- ATT&CK/TTP coverage;
- provider/subprovider/failure-domain graph;
- exit plan/exercise;
- BAS generic connector’ın production sürümü.

#### Çıkış kapısı

- TIBER benzeri testte gizli kapsam ve normal denetçi erişimi ayrılır.
- Ortak CSP/IAM sağlayıcısından etkilenen kritik hizmetler bir dakikadan kısa sürede bulunur.

### Faz 7 — Hafta 37–42: v0.8 Stress & Supply Chain

- parametreli scenario/inject/timeline;
- concurrent stress;
- critical service tolerance sonucu;
- SBOM/VEX/provenance/signature;
- CVE blast-radius sorgusu.

#### Çıkış kapısı

- Aynı senaryo aynı seed ile yeniden üretilebilir.
- CVE’den etkilenen kritik hizmet 60 saniyeden kısa sürede bulunur.

### Faz 8 — Hafta 43–48: v0.9 Emerging Risk

- Monte Carlo CRQ-lite;
- evidence-linked model input;
- AI asset/agent/tool registry;
- adversarial AI test evidence;
- crypto asset/PQC migration registry.

#### Çıkış kapısı

- CRQ varsayım ve dağılımı şeffaftır; tek “risk puanı”na indirgenmez.
- AI agent tek başına bulgu kapatamaz veya risk kabul edemez.
- kuantuma hassas algoritma kullanan kritik hizmetler raporlanır.

### Faz 9 — Hafta 49–52: v1.0 Production Readiness

- multi-tenant isolation/pentest;
- object storage/KMS/backup/restore;
- load/performance/chaos;
- audit log/WORM export;
- upgrade/rollback;
- API/connector developer docs;
- admin/auditor/control-owner playbook;
- three design-partner UAT;
- support, incident ve customer notification planı.

#### v1.0 çıkış kapısı

- Kritik P0/P1 güvenlik açığı yoktur.
- Tenant isolation testlerinin tamamı geçer.
- RPO/RTO hedefleri canlı tatbikatta karşılanır.
- Üç design partner kritik kullanım akışını kabul eder.
- Verify CLI ile audit package bağımsız doğrulanır.

---

## 5. Epic ve sprint backlog’u

### P0 backlog — ilk 24 hafta

| Epic | Örnek işler | Bağımlılık | Done tanımı |
|---|---|---|---|
| E01 Evidence Schema | Prisma model, API, migration, validation | ADR-002 | Backward-compatible ve fixture testli |
| E02 Integrity | JCS, SHA-256, JWS/COSE, manifest, verify CLI | E01 | Tamper testleri geçer |
| E03 Evidence Lifecycle | retention, legal hold, redaction, expiry | E01–E02 | Yetki/audit testleri geçer |
| E04 Test DSL | schema, runner, assertion, safety | ADR-004 | 10 test fixture’ı deterministik |
| E05 State Machine | status, transition guard, stale/unknown | E04 | Geçersiz geçişler engellenir |
| E06 Connector Runner | isolate, credential, egress, health | ADR-007 | Cross-tenant/secret testleri geçer |
| E07 Initial Connectors | Entra, AWS, Jira, backup, webhook | E06 | Her connector signed evidence üretir |
| E08 Scope Engine | rule parser, as-of-date, exemptions | ADR-005 | 20 uzman senaryosu geçer |
| E09 Regulation Content | SPK/7545/BDDK/NIST | E08 | İki kişilik hukuk/uyum review |
| E10 Service Graph | node/edge, tolerance, owner | ADR-006 | 5 gerçek hizmet modellenir |
| E11 Incident Clock | rule, calendar, classification, receipt | E08 | Test takvimi ve DST/timezone geçer |
| E12 Recovery Proof | restore, RTO/RPO, reconciliation | E10 | Gerçek tatbikat kanıtı |
| E13 CFO Pack | workflow, SoD, tabletop | E04/E10/E11 | Pilot sonuç ve AAR |
| E14 Auditor v2 | sample, request, annotate, reproduce | E01/E02/E04 | Denetçi UAT geçer |
| E15 Reporting v2 | board, service, incident, recovery | E02/E10–E12 | Hash lineage ve export geçer |

### P1 backlog — hafta 25–36

- DORA profile ve incident report;
- FSB FIRE export;
- DORA RoI;
- TLPT engagement/white-team vault;
- ATT&CK/STIX import;
- BAS connector;
- third/nth-party graph;
- concentration ve exit exercise;
- regional pack framework.

### P2 backlog — hafta 37–48

- stress scenario engine;
- SBOM/VEX/provenance;
- CRQ-lite;
- AI assurance;
- crypto/PQC;
- anonymous benchmark research prototype.

---

## 6. Ekip ve kapasite planı

### Önerilen minimum çekirdek ekip

| Rol | FTE | Ana sorumluluk |
|---|---:|---|
| Product lead / finance cyber domain | 1 | Öncelik, design partner ve ürün sınırı |
| Tech lead / architect | 1 | ADR, veri modeli, güvenlik ve kalite kapıları |
| Backend engineer | 3 | NestJS, Prisma, rules, evidence, incident, graph |
| Frontend engineer | 2 | Next.js, control/evidence/auditor/service UX |
| Connector/platform engineer | 2 | Isolated runner, cloud/IAM/ITSM/BAS entegrasyonu |
| DevSecOps/SRE | 1 | CI/CD, signing, observability, KMS, DR, release |
| QA/automation | 1.5 | Contract, property, migration, security ve E2E test |
| Security engineer/red-team | 1 | Test DSL safety, threat model, pentest/TLPT |
| Regulation/control analyst | 2 | SPK/BDDK/7545/DORA içerik ve mapping |
| UX/product designer | 0.5–1 | Karmaşık denetim/kanıt iş akışları |
| Data/risk scientist | 0.5, hafta 37+ | Stress/CRQ model ve kalibrasyon |

**Minimum:** yaklaşık 14 FTE. Daha küçük ekipte P2 modülleri v1.0 sonrasına kaydırılmalı; P0 kalite ve güvenlik kapsamı azaltılmamalıdır.

### Dış uzmanlık

- sermaye piyasası/bankacılık mevzuatı hukukçusu;
- bağımsız bilgi sistemleri denetçisi;
- banka/aracı kurum operasyon ve mutabakat uzmanı;
- TIBER/CBEST benzeri red-team/TI sağlayıcısı;
- PQC ve AI security danışmanı;
- design partner kurumların CISO, iç denetim, uyum ve finans/hazine ekipleri.

---

## 7. Mimari değişiklikler

### 7.1. PostgreSQL/Prisma

Yeni ana tablolar:

- `regulation_sources`, `requirements`, `applicability_rules`, `control_mappings`;
- `control_implementations`, `control_test_definitions`, `test_runs`;
- `evidence_envelopes`, `evidence_artifacts`, `evidence_signatures`, `evidence_relations`;
- `critical_business_services`, `impact_tolerances`, `dependency_nodes`, `dependency_edges`;
- `incidents`, `incident_timeline_events`, `notification_obligations`, `notification_submissions`;
- `recovery_attempts`, `reconciliation_runs`, `reconciliation_exceptions`;
- `third_party_arrangements`, `providers`, `subproviders`, `exit_plans`;
- `tlpt_engagements`, `exercise_runs`, `exercise_injects`, `exercise_actions`;
- `risk_scenario_models`, `risk_model_runs`;
- `ai_assets`, `ai_tool_permissions`, `crypto_assets`, `software_artifacts`;
- `board_decisions`, `assurance_claims`, `package_manifests`.

Her tenant tablosunda `tenant_id`; RLS politikası ve composite index zorunludur. Audit event’ler update/delete edilmemeli, append-only olmalıdır.

### 7.2. BullMQ işleri

- evidence freshness scan;
- connector collection/test;
- notification clock alarm;
- regulation change impact;
- package/report generation;
- hash/signature verification;
- retest schedule;
- SBOM/CVE impact analysis;
- risk simulation;
- retention/legal-hold enforcement.

İşler idempotent olmalı; her job `tenantId`, `correlationId`, `schemaVersion`, `attempt` ve güvenli retry policy taşımalıdır.

### 7.3. MinIO/Object Storage

- tenant-scoped bucket/prefix;
- immutable retention sınıfları;
- original/redacted/derived ayrımı;
- server-side encryption ve KMS key reference;
- content hash doğrulaması;
- malware scan ve safe preview;
- presigned URL süre/role limitleri.

### 7.4. Keycloak/Authorization

Yeni roller:

- Control Owner;
- Evidence Custodian;
- Test Operator;
- Risk/Compliance Reviewer;
- Independent Auditor;
- Incident Commander;
- Regulator/External Reviewer;
- Board Viewer;
- Connector Workload Identity.

RBAC yeterli değildir. Tenant, object classification, assignment, engagement ve time-window bağlamı için ABAC katmanı gerekir.

### 7.5. OpenTelemetry

- connector/test/report/recovery trace’leri;
- correlation ID ile audit event ilişkisi;
- tenant verisini telemetride sızdırmayan semantic conventions;
- SLO: evidence latency, test success, report generation, clock alert;
- telemetry, compliance evidence yerine geçmez; gerekirse test çıktısına snapshot/proof üretir.

---

## 8. Güvenlik ve kalite kapıları

Her release aşağıdaki kapılardan geçmelidir:

1. Threat model güncel.
2. Tenant isolation unit/integration/E2E testleri geçiyor.
3. Migration rollback testi var.
4. API authorization matrix testi var.
5. SBOM ve signed provenance üretiliyor.
6. Kritik bağımlılık/CVE policy geçiyor.
7. Secret scan temiz.
8. SAST/DAST/IaC/container scan kritik açık içermiyor.
9. Evidence integrity test vectors geçiyor.
10. Backup restore ve package verify testi başarılı.
11. Audit event coverage kritik işlemlerde %100.
12. Regülasyon içeriği en az iki kişi tarafından gözden geçirilmiş.
13. AI kullanılan özelliklerde insan onayı ve source citation var.
14. Performans ve SLO regression yok.

---

## 9. Ürün KPI ve OKR’ları

### Objective 1 — Denetlenebilir sürekli güvence çekirdeği

- KR1: İlk 50 kritik kontrolden 20’si otomatik/yarı otomatik test edilir.
- KR2: Otomatik kanıt toplama gecikmesi p95 < 15 dakika.
- KR3: Audit package bağımsız doğrulama başarısı %100.
- KR4: Kanıt source/test/control lineage completeness > %95.
- KR5: `Unknown/Stale` ile gerçek `Failed` ayrımında false failure < %2.

### Objective 2 — Finansal dayanıklılığın ispatı

- KR1: Her pilotta en az 5 kritik hizmet ve impact tolerance tanımlı.
- KR2: En az bir gerçek restore + reconciliation tatbikatı tamamlanmış.
- KR3: Actual RTO/RPO ve tolerans sonucu otomatik üretilmiş.
- KR4: Tekrarlayan bulgu oranı ilk altı ayda %25 azalmış.

### Objective 3 — Denetim ve olay iş yükünü azaltma

- KR1: Denetim kanıtı toplama insan-saatinde %40 azalma.
- KR2: Bulgu → aksiyon oluşturma süresi < 1 iş günü.
- KR3: Başarılı retest olmadan kapanan kritik bulgu sayısı sıfır.
- KR4: Olay bildirim taslağı hazırlama süresinde %50 azalma.

### Objective 4 — Ürün/pazar doğrulaması

- KR1: Bir aracı kurum, bir banka/fintech ve bir kurumsal finans design partner.
- KR2: En az iki teknik partner connector’ı: BAS ve IR/backup.
- KR3: CFO Kalkanı için en az iki kurumsal pilot.
- KR4: DORA pack için AB’de bir pilot/uzman doğrulaması.

---

## 10. Design partner planı

### Partner A — Aracı kurum

Odak:

- SPK VII-128.10;
- emir kanalı/OMS/FIX ve müşteri erişimi;
- kritik hizmet ve sızma/BAS test kanıtı;
- denetçi odası ve SPK denetim paketi.

### Partner B — Banka veya ödeme/fintech

Odak:

- IAM/PAM/cloud/backup connector;
- incident clock;
- recovery proof ve finansal reconciliation;
- DORA/BDDK ortak kontrol.

### Partner C — Finans dışı büyük kurumun finans/hazine departmanı

Odak:

- CFO Kalkanı;
- vendor master/IBAN değişikliği;
- ERP–banka portalı SoD;
- BEC/deepfake tabletop ve payment evidence bundle.

Her partner için başlangıçta baseline, 90 gün sonunda karşılaştırmalı metrik ve yazılı acceptance alınmalıdır.

---

## 11. İnşa edilmeyecek veya ertelenecek alanlar

### KALKAN_OS içinde yeniden inşa edilmeyecek

- SIEM/EDR/XDR/NDR;
- vulnerability scanner;
- full BAS/autonomous pentest;
- PAM/IGA/CIEM;
- fraud transaction engine;
- external attack surface scanner;
- tam cyber range;
- genel ITSM;
- genel-purpose enterprise GRC;
- tam finansal ödeme dijital ikizi.

Bu sistemler connector/test provider olarak kullanılmalıdır.

### v1.0 sonrasına ertelenecek

- KALKAN Passport;
- regulator live portal;
- cross-institution raw-data exchange;
- sector-wide payment network digital twin;
- cyber insurance underwriting marketplace;
- blockchain/public anchoring;
- tam otonom AI agent remediation.

---

## 12. Başlıca riskler ve azaltma planı

| Risk | Etki | Azaltma |
|---|---|---|
| Kapsamın aşırı büyümesi | v1.0 gecikmesi | P0 çekirdeği sabitle; P2 feature flag/beta |
| Mevzuat içeriği hatası | Hukuki/itibar riski | Resmî kaynak, çift review, sürüm ve disclaimer |
| AI hallüsinasyonu | Yanlış eşleme/karar | AI yalnız aday/özet; deterministik sonuç ve insan onayı |
| Kanıt deposunun hedef olması | Kritik veri sızıntısı | Data minimization, tenant KMS, ABAC, WORM, on-prem |
| Connector credential riski | Kaynak sistem ihlali | Short-lived/read-only, isolated runner, egress allowlist |
| “Tek uyum skoru” baskısı | Yanlış güven | Altı ayrı lens: kapsam, olgunluk, performans, kanıt, dayanıklılık, risk |
| Denetçi bağımsızlığının zayıflaması | Güvence geçersizliği | Ayrı rol, assignment, sign-off ve immutable review |
| CRQ sahte kesinlik | Yanlış bütçe kararı | Dağılım, varsayım, sensitivity, confidence ve backtest |
| Graph karmaşıklığı | Performans/geliştirme yükü | PostgreSQL ile başla; ölçmeden yeni graph DB ekleme |
| Fazla connector bakımı | Teknik borç | SDK, contract test, certification ve partner ownership |

---

## 13. İlk 10 uygulama kararı

1. Evidence Envelope ve hash/package ADR’lerini ilk sprintte sabitle.
2. Kontrol sonucu ile kanıt durumunu ayrı sakla.
3. `Failed`, `Unknown`, `Stale` ve `Exception accepted` durumlarını birleştirme.
4. Ticket kapanışını kontrol kapanışı sayma; retest zorunlu olsun.
5. Kritik hizmet modelini varlık envanterinin üst katmanı olarak ekle.
6. Incident Clock’u genel workflow değil, kural/saat/veri-soyu motoru olarak tasarla.
7. Restore sonrası finansal reconciliation’ı P0 kabul et.
8. Connector runner’ı ana API prosesinden izole et.
9. OSCAL uyumluluğunu veri modelinde koru; tüm iç modeli OSCAL’e zorla dönüştürme.
10. CRQ, digital twin, AI ve PQC’yi kanıt çekirdeği çalışmadan öne alma.

---

## 14. Yönetim özeti: ne eklenecek, ne zaman?

### İlk 3 ay

KALKAN_OS’a doğrulanabilir kanıt zarfı, dört hash’li paket bütünlüğü, kontrol test motoru, sürekli kontrol izleme, kapsam motoru ve güvenli connector altyapısı eklenecek.

### 3–6 ay

Kritik finansal hizmet/etki toleransı, olay bildirim saati, recovery proof, finansal mutabakat ve CFO Kalkanı eklenecek.

### 6–9 ay

DORA/FSB FIRE paketi, TLPT çalışma alanı, üçüncü/n’inci taraf yoğunlaşma grafiği ve gelişmiş denetçi odası eklenecek.

### 9–12 ay

Cyber Stress Lab, SBOM/provenance, kanıta bağlı siber risk nicelendirme, AI/agent assurance ve PQC envanteri eklenecek; ürün v1.0 güvenlik ve müşteri kabul kapılarından geçirilecek.

### 12–24 ay

KALKAN Passport, anonim sektör benchmark’ı, ortak tatbikat ağı, regulator/SupTech export ve ödeme sistemi dijital ikizi geliştirilecek.

En kritik bağımlılık sırası:

> **Evidence Envelope → Control Test/CCM → Scope Engine/Connectors → Critical Service → Incident/Recovery → DORA/TLPT/Third Party → Stress/CRQ/AI/PQC → Sector Network**
