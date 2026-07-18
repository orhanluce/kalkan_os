# CLAUDE CODE V2 MVP STRATEJİ EK TALİMATI

## KALKAN_OS Regulated + CFO Kalkanı + Tek Uyum İşletim Sistemi

**Sürüm:** 2.0  
**Tarih:** 18 Temmuz 2026  
**Birlikte okunacak ana belge:** `CLAUDE_CODE_KALKAN_OS_MASTER_TALIMAT_UI_REGULASYON_HOSTINGER_SUPABASE.md`  
**Hedef ortam:** Mevcut KALKAN_OS repository + Hostinger + Supabase

---

## 0. Öncelik ve bağlayıcılık

Bu belge mevcut V1 ana talimatını iptal etmez. Aşağıdaki alanlarda V2 önceliklidir:

- ürün tanımı ve müşteri segmentleri;
- MVP kapsamı ve kabul kriterleri;
- paket/entitlement mimarisi;
- kurumsal finans departmanı ürün hattı;
- “tek uyum işletim sistemi” kapsamı;
- PR sırası ve üretim kapıları;
- ürün analitiği ve time-to-value ölçümleri.

V1’deki aşağıdaki kararlar aynen korunur:

- tenant izolasyonu ve PostgreSQL/Supabase RLS;
- DB invariant’ları;
- M12 test motorunun yeniden kullanılması;
- M16 SoD güvenlik kuralları;
- `pg_cron` kararı;
- resmî kaynak ve hukuk doğrulama disiplini;
- Hostinger/Supabase dağıtım ilkeleri;
- responsive, accessible, dark/light “Regulatory Observatory” arayüzü;
- test, migration, e2e ve sıfır beklenmeyen skip üretim kapısı;
- “tam uyum garantisi” ve otomatik hukuk kararı yasağı.

Çelişki varsa bu V2 belgesi ürün kapsamı ve sıralamada üstün; güvenlik ve hukuki doğrulamada daha sıkı olan kural üstündür.

---

## 1. Yeni ürün kararı

KALKAN_OS iki ürün hattını aynı kontrol, test, kanıt ve regülasyon çekirdeği üzerinde çalıştıracaktır.

### 1.1. KALKAN_OS Regulated

Hedef müşteri:

- banka;
- aracı kurum;
- portföy yönetim şirketi;
- ödeme ve elektronik para kuruluşu;
- kripto varlık hizmet sağlayıcısı;
- sigorta, emeklilik, finansman ve diğer düzenlemeye tabi kurumlar;
- AB’de DORA/NIS2/CRA/AI Act yükümlülüğü bulunan kuruluşlar.

Satın alma nedeni:

- resmî düzenlemeyi izlemek;
- kurum kapsamını açıklanabilir belirlemek;
- yükümlülüğü kontrol ve teste bağlamak;
- kanıtı güncel ve doğrulanabilir tutmak;
- bulgu, aksiyon ve retest işletmek;
- denetim ve otorite paketini üretmek.

### 1.2. CFO Kalkanı

Hedef müşteri:

- doğrudan finansal düzenlemeye tabi olmayan büyük/orta-büyük kurumların finans, hazine, muhasebe, bordro ve finansal operasyon departmanları.

Örnek sektörler:

- sanayi;
- enerji;
- perakende;
- lojistik;
- sağlık;
- teknoloji;
- telekom;
- holding ve çok şirketli gruplar;
- kritik tedarikçiler.

Ana riskler:

- BEC ve deepfake yönetici/ödeme talimatı;
- tedarikçi IBAN ve ana veri değişikliği;
- ERP ve banka portalında yetki birikimi;
- görevler ayrılığı ihlali;
- mükerrer veya yanlış ödeme;
- bordro, vergi, müşteri ve tedarikçi verisi;
- e-fatura, ödeme, mutabakat ve finansal kapanış kesintisi;
- dış kaynak muhasebe/bordro/ERP sağlayıcı riski;
- kriz anında karar ve kanıt eksikliği.

CFO Kalkanı düşük fiyatlı olabilir; fakat güvenlik, RLS, audit, veri koruma ve kanıt bütünlüğü hiçbir şekilde zayıflatılamaz.

---

## 2. Ürün vaadi ve ikame sınırı

KALKAN_OS’un ticari hedefi:

> Müşteri, resmî regülasyonun keşfi ve kapsam kararından kontrol testine, kanıta, denetim dosyasına ve otorite/yönetim raporuna kadar başka bir uyum yazılımına ihtiyaç duymamalıdır.

### 2.1. KALKAN_OS içinde ikame edilecek alanlar

- regulatory intelligence;
- regülasyon takvimi;
- applicability/scope management;
- GRC ve kontrol kataloğu;
- kontrol test yönetimi;
- kanıt toplama ve freshness;
- SoD ve erişim gözden geçirme iş akışı;
- risk, istisna, bulgu ve aksiyon;
- retest ve verified closure;
- denetim örnekleme ve çalışma kâğıdı;
- eğitim/yetkinlik kanıtı;
- üçüncü taraf ve kritik hizmet uyumu;
- yönetim kurulu ve otorite raporlaması.

### 2.2. İkame edilmeyecek, entegre edilecek alanlar

- ERP;
- banka portalı;
- IAM/PAM;
- SIEM/SOAR;
- EDR/XDR;
- e-posta güvenliği;
- yedekleme;
- ticket sistemi;
- bulut ve dizin servisleri;
- bağımsız denetim;
- avukat/hukuk görüşü;
- düzenleyici otorite kararı.

KALKAN_OS ödeme başlatan, para taşıyan, banka credential’ı saklayan veya muhasebe kaydı değiştiren bir sistem olmayacaktır. İlk connector’lar read-only veya müşteri tarafından üretilmiş gözlem/veri kabulüyle çalışacaktır.

### 2.3. Pazarlama dilinde yasaklar

- “Başka hiçbir siber güvenlik ürününe gerek kalmaz.”
- “Ceza almayı engeller.”
- “%100 uyum garantisi.”
- “Hukukçuya/denetçiye gerek kalmaz.”
- “Otomatik hukuki karar.”

Kullanılacak ifade:

> “KALKAN_OS, kurumun regülasyon ve uyum operasyonunu tek platformda işletir; teknik güvenlik sistemlerini ve profesyonel güvence taraflarını kanıt zincirine bağlar.”

---

## 3. MVP stratejisi

MVP bütün M19-M33 modüllerinin tamamlanması değildir. MVP, iki segmentte de aynı çekirdeğin değer ürettiğini kanıtlayan iki dikey dilimdir.

### 3.1. Regulated MVP dikey dilimi

Tek bir doğrulanmış Türkiye regülasyon paketiyle uçtan uca şu akış çalışmalıdır:

`Official Source → Provision → Obligation → Applicability → Control → Test → Evidence → Finding → Action → Retest → Verified Closure → Audit Package`

İlk paket için öneri:

- SPK/7545 ortak kontrol dilimi;
- en fazla 20-40 doğrulanmış kritik kontrol;
- kurum profiline göre açıklanabilir kapsam;
- en az bir otomatik veya yarı otomatik connector;
- başarısız testten bulgu;
- retest olmadan kapanış yok;
- kaynak sürümü ve hüküm referanslı denetim paketi.

MVP’de yüzlerce doğrulanmamış mevzuat kontrolü seed etme. Az, doğru ve yeniden üretilebilir içerik tercih et.

### 3.2. CFO Kalkanı MVP dikey dilimi

Self-service akış:

1. kullanıcı kurum tipinde `CORPORATE_FINANCE` seçer;
2. finans departmanı profil wizard’ını tamamlar;
3. sistem doğrudan hukuk, sözleşme, board policy ve best-practice kontrollerini ayrı gösterir;
4. hazır finansal siber risk baseline’ı oluşturur;
5. SoD/ödeme/ERP-banka erişimi kontrollerini etkinleştirir;
6. kullanıcı ilk kanıtı yükler veya read-only gözlem seçer;
7. kontrol testi çalışır;
8. bulgu ve önerilen aksiyon üretilir;
9. yönetim özeti ve kanıt paketi dışa aktarılır.

MVP kontrol temaları:

- ödeme onayında dual control;
- talep eden/onaylayan ayrılığı;
- tedarikçi IBAN değişikliği için out-of-band doğrulama kaydı;
- banka portalı kullanıcı/yetki gözden geçirme;
- ERP kritik finans rolü gözden geçirme;
- ayrıcalıklı hesap ve dormant user kontrolü;
- ödeme limiti ve istisna onayı;
- finansal kişisel veri erişimi;
- yedek/geri dönüş ve finansal mutabakat kanıtı;
- BEC/deepfake ödeme tatbikatı;
- dış kaynak finans hizmeti kanıtı;
- olay karar ve bildirim paketi.

### 3.3. MVP başarı tanımı

Regulated segment:

- kurum profilinden kapsam sonucu <60 dakika;
- hazır connector’da ilk kanıt <1 iş günü;
- hüküm-test-kanıt zinciri eksiksiz;
- failed test → finding → action → retest → closure e2e;
- aynı tarih/sürümle denetim paketi yeniden üretilebilir.

CFO Kalkanı:

- hesap oluşturma ve ilk baseline <30 dakika;
- ilk kanıt <1 iş günü;
- kullanıcı hiçbir satış/implementasyon müdahalesi olmadan en az bir kontrolü tamamlar;
- plan yetkisi doğru uygulanır;
- LEGAL/CONTRACTUAL/BOARD/BEST_PRACTICE ayrımı görünür;
- mobil ve masaüstü e2e geçer.

MVP üretim kapısı:

- tenant/RLS saldırı testleri;
- billing/entitlement bypass testleri;
- plan downgrade/upgrade davranışı;
- read-only connector güvenliği;
- export ve audit kanıtı;
- light/dark ve responsive e2e;
- production build;
- Hostinger/Supabase staging deploy;
- sıfır beklenmeyen skip.

---

## 4. Yeni veri modeli gereksinimleri

Repository’yi incelemeden tablo adı uydurup migration yazma. Mevcut modellere göre aşağıdaki kavramları ekle veya genişlet.

### 4.1. Kurum segmenti

```text
OrganizationProfile
  organizationType
  operatingSectors[]
  regulatedStatus
  regulatorTypes[]
  jurisdictions[]
  employeeBand
  legalEntityCount
  financeDepartmentEnabled
  financeFunctionTypes[]
  erpSystems[]
  bankPortalCountBand
  paymentVolumeBand
  payrollInScope
  supplierMasterInScope
  criticalSupplierStatus
```

`organizationType` en az:

```text
REGULATED_FINANCIAL_INSTITUTION
CORPORATE_FINANCE
MIXED_GROUP
```

MIXED_GROUP, holdingin regulated iştiraki ile finans dışı şirketlerini aynı tenant altında sınırsız görmesi anlamına gelmez. Tüzel kişi ve membership sınırı ayrı korunmalıdır.

### 4.2. Yükümlülük dayanak türü

Her kontrol/yükümlülük bağlantısında:

```text
LEGAL_MANDATORY
CONTRACTUAL
BOARD_POLICY
BEST_PRACTICE
```

bulunmalıdır.

Kurallar:

- `BEST_PRACTICE`, arayüzde mevzuat yükümlülüğü gibi gösterilemez.
- `CONTRACTUAL`, sözleşme veya talep kaynağı olmadan VERIFIED olamaz.
- `BOARD_POLICY`, karar/politika sürümüne bağlanır.
- `LEGAL_MANDATORY`, doğrulanmış hüküm ve applicability kararı ister.
- Dayanak türü değiştirilirse audit event oluşur.

### 4.3. Paket ve entitlement

Kavramlar:

```text
ProductPlan
PlanVersion
FeatureEntitlement
TenantSubscription
SubscriptionEvent
UsageMeter
EntitlementDecision
```

İlk ürün planları:

```text
CFO_STARTER
CFO_PRO
CFO_GOVERNANCE
REGULATED_GROWTH
REGULATED_ENTERPRISE
```

Kurallar:

- Fiyatı authorization kuralı yapma.
- Yetki UI gizleme ile sınırlı olamaz; server/DB tarafında doğrulanır.
- Plan sürümlüdür; geçmiş sözleşme davranışı korunur.
- Upgrade/downgrade tenant verisini silmez.
- Downgrade sonrası veri read-only olabilir; sessiz veri kaybı olmaz.
- Trial süresi DB zamanı ile çalışır.
- Billing provider seçilmeden Stripe/Paddle/iyzico entegrasyonu uydurma.
- MVP’de mock/manual subscription provisioning kabul edilebilir; ADR’de açıkça yazılır.

### 4.4. Kontrol paketi

```text
ControlPack
ControlPackVersion
PackAudience
PackControl
PackEntitlement
OnboardingTemplate
```

`PackAudience`:

```text
REGULATED
CORPORATE_FINANCE
BOTH
```

Bir ortak kontrol iki pakette kullanılabilir; duplicate kontrol oluşturma. Paket bağları ve metinleri sürümlü olsun.

### 4.5. Ürün değer ölçümü

```text
ActivationEvent
TimeToValueMetric
CustomerOutcome
RetiredToolOrProcess
AcquisitionChannel
```

Ölçülecek zamanlar:

- `time_to_profile_complete`;
- `time_to_first_scope_decision`;
- `time_to_first_control`;
- `time_to_first_evidence`;
- `time_to_first_test_run`;
- `time_to_first_audit_package`.

Konsolidasyon sonucu:

- emekli edilen yazılım/abonelik;
- emekli edilen manuel dosya/çalışma tablosu;
- önceki ve sonraki kanıt hazırlama süresi;
- müşteri onaylı sonuç tarihi.

Analitik olaylar tenant’ın hassas kanıt içeriğini taşımamalıdır. Ürün analitiği için ayrı privacy/retention ADR yaz.

---

## 5. CFO Kalkanı güvenlik sınırları

### 5.1. Para hareketi yasağı

MVP:

- ödeme başlatmaz;
- ödeme onaylamaz;
- banka hesabına giriş yapmaz;
- banka credential’ı saklamaz;
- ERP finans kaydını değiştirmez;
- tedarikçi IBAN’ını otomatik değiştirmez.

KALKAN_OS yalnız:

- kontrol tanımlar;
- read-only gözlem alır;
- kullanıcı tarafından sağlanan kanıtı işler;
- onay/SoD iş akışını kaydeder;
- bulgu/aksiyon üretir;
- doğrulama ve rapor kanıtı saklar.

### 5.2. Tedarikçi IBAN değişikliği

`SupplierBankChangeVerification` veya repository’ye uygun eşdeğer model:

- değişiklik talep eden;
- değişiklik konusu tedarikçi;
- eski/yeni değerlerin maskeli referansı;
- out-of-band kullanılan kanal;
- bağımsız doğrulayan;
- doğrulama zamanı;
- kanıt referansı;
- onay durumu;
- kendi talebini onaylama yasağı.

Tam IBAN ve hassas finans verisi gerekmiyorsa saklama. Maskeli değer + hash/reference tercih et. Veri minimizasyonu ADR’si yaz.

### 5.3. BEC/deepfake tatbikatı

M12 test motorunu kullan:

- scenario/inject;
- finans çalışanı kararı;
- geri arama/out-of-band doğrulama;
- karar süresi;
- escalation;
- başarısızlık bulgusu;
- eğitim/aksiyon;
- retest.

Yeni bir simülasyon motoru kurma.

---

## 6. Arayüz ve bilgi mimarisi değişikliği

### 6.1. İlk onboarding kararı

Kurum oluştururken sor:

> “KALKAN_OS’u hangi amaçla kuruyorsunuz?”

Seçenekler:

1. Düzenlemeye tabi finans kuruluşu
2. Kurum finans/hazine departmanı
3. Karma şirketler grubu

Seçim kalıcı olarak kilitlenmez; yetkili kullanıcı kontrollü değiştirebilir. Değişiklik scope recalculation ve audit event üretir.

### 6.2. CFO Kalkanı sade navigasyon

Varsayılan ana hedefler:

1. Finans Güvence Özeti
2. Ödeme Kontrolleri
3. Görevler Ayrılığı
4. ERP ve Banka Erişimleri
5. Kanıtlar
6. Bulgular ve Aksiyonlar
7. Olay/Tatbikat
8. Yönetim Raporu
9. Uygulanabilir Yükümlülükler

Regülasyon corpus’unun teknik detayları Starter kullanıcının ana navigasyonunu boğmamalıdır. Kaynak ve hukuk soyu detay/drawer içinde erişilebilir kalır.

### 6.3. Dashboard ayrımı

Regulated dashboard:

- uygulanabilir yükümlülük;
- doğrulanmış kontrol;
- kanıt freshness;
- açık bulgu;
- denetim ve bildirim takvimi;
- regülasyon değişiklik etkisi.

CFO dashboard:

- kritik ödeme kontrolleri;
- SoD çatışmaları;
- banka/ERP erişim gözden geçirmeleri;
- süresi dolan kanıt;
- ödeme/IBAN doğrulama istisnaları;
- BEC/deepfake tatbikat sonucu;
- açık finans aksiyonları.

### 6.4. Dayanak etiketi

Her kontrol kartında görünür:

- Yasal zorunluluk
- Sözleşmesel zorunluluk
- Yönetim kurulu politikası
- İyi uygulama

Renk tek başına kullanılmaz; ikon + metin + açıklama zorunludur.

---

## 7. Paket/feature matrisi

İlk taslak entitlement matrisi; repository ve ticari kararla ADR’de kesinleştir:

| Yetenek | CFO Starter | CFO Pro | CFO Governance | Regulated Growth | Regulated Enterprise |
|---|---:|---:|---:|---:|---:|
| Finans baseline | Evet | Evet | Evet | Opsiyonel | Evet |
| Kanıt kasası | Limitli | Evet | Evet | Evet | Evet |
| Kontrol testi | Hazır test | Evet | Evet | Evet | Evet |
| SoD | Görünüm | Evet | Evet | Evet | Evet |
| ERP/banka erişim gözden geçirme | Hayır | Evet | Evet | Evet | Evet |
| Denetçi alanı | Hayır | Hayır | Evet | Evet | Evet |
| Yönetim raporu | Basit | Evet | Evet | Evet | Evet |
| Regülasyon paketi | Baseline | Baseline | Seçili | 1 paket | Çoklu |
| Connector | Manuel | 1 hazır | Çoklu | 1-3 | Çoklu/özel |
| SSO | Hayır | Opsiyonel | Evet | Opsiyonel | Evet |
| Dedicated deployment | Hayır | Hayır | Hayır | Opsiyonel | Evet |

Limit değerlerini kod içine dağıtma. Versioned entitlement/config kullan.

---

## 8. Coverage Ledger — “başka uyum yazılımına gerek yok” kanıtı

Yeni bir ürün/roadmap görünümü oluştur:

```text
ComplianceCapability
CapabilityCoverage
CoverageEvidence
CoverageGap
ReplacementCandidate
```

Capability örnekleri:

- regulation monitoring;
- applicability;
- policy/control management;
- evidence automation;
- SoD;
- audit workpapers;
- training;
- third-party;
- incident/reporting;
- board reporting.

Her capability durumu:

```text
NOT_PLANNED
PLANNED
DESIGN_ONLY
MVP_PARTIAL
PRODUCTION_READY
PARTNER_DEPENDENT
```

Kurallar:

- `MVP_PARTIAL`, UI’da “tam karşılanıyor” gibi gösterilemez.
- `PARTNER_DEPENDENT`, partner ve entegrasyon sınırını gösterir.
- Production-ready kabulü test, güvenlik, operasyon ve dokümantasyon kanıtı ister.
- Bu ledger internal product/admin görünümü olabilir; son kullanıcı roadmap’iyle karıştırma.

Amaç: “rakipsiziz” anlatısını özellik listesiyle değil, hangi ayrı uyum harcamasının gerçekten ikame edildiğiyle yönetmek.

---

## 9. Güncellenmiş PR sırası

M16 üretim kapısı değişmez. CFO Kalkanı uğruna M16’yı yarım bırakma.

### PR-0 — Yeniden keşif ve V2 ADR

- V1/V2 fark analizi;
- mevcut M16 durumunun doğrulanması;
- ürün segmenti ADR;
- plan/entitlement ADR;
- read-only finance connector ADR;
- billing provider `OPEN-DECISION`;
- Coverage Ledger başlangıcı;
- ROADMAP güncellemesi.

Kod yazmadan önce tamamla.

### PR-1 — M16 üretim kapanışı

V1’de tanımlanan sırayı koru:

- istisna uzatma;
- CSV atama importu;
- dry-run/apply/hash/idempotency;
- outbox değerlendirme;
- rollback/sona erdirme;
- UI ve gerçek Chromium e2e;
- güvenlik/tenant testleri;
- domain event ve dashboard eksikleri.

### PR-2 — Organization Segment + Entitlement Foundation

- kurum segmenti;
- finance department profile;
- obligation basis type;
- versioned plan/entitlement;
- server-side authorization;
- onboarding seçim ekranı;
- plan bypass ve downgrade testleri.

Gerçek ödeme entegrasyonu yapma; provider kararı beklesin.

### PR-3 — CFO Kalkanı MVP

- finans profil wizard’ı;
- hazır baseline pack;
- dual approval ve SoD kontrolleri;
- tedarikçi IBAN değişikliği doğrulama kaydı;
- ERP/banka erişim review importu;
- ilk kanıt/test/bulgu akışı;
- CFO dashboard;
- yönetim özeti;
- self-service e2e.

İlk ERP/banka importu CSV veya güvenli read-only adapter olabilir. Credential toplayan scraping yapma.

### PR-4 — Regulated Regulation-to-Evidence MVP

M19-M24’ün yalnız gereken dikey dilimi:

- source registry;
- bir Türkiye resmî kaynak connector’ı;
- source artifact/hash;
- provision/obligation;
- applicability;
- control mapping;
- legal-basis guard;
- evidence citation/snapshot;
- SPK/7545 starter pack;
- uçtan uca audit package.

M19-M24’ü altı ayrı yarım subsystem olarak paralel açma; tek vertical slice yeşil kalmalı.

### PR-5 — M17 Audit Workspace MVP

- denetim evreni;
- örneklem yöntemi ve manifest;
- çalışma kâğıdı;
- reviewer independence;
- request list;
- yeniden üretilebilir paket.

M16 production ve ADR onayı olmadan başlama.

### PR-6 — M18 Training/Competency MVP

- rol-yetkinlik matrisi;
- required training;
- katılım/tamamlama kanıtı;
- BEC/deepfake tatbikat sonucu;
- gecikme/escalation;
- yönetim görünümü.

M12 test ve mevcut kullanıcı/rol altyapısını yeniden kullan.

### PR-7 — Connector + Consolidation

- en az beş üretim connector/import yolu;
- read-only security review;
- müşteri başına connector health;
- retired tool/process outcome;
- Coverage Ledger güncellemesi;
- audit ve board çıktı standardizasyonu.

### PR-8 — Product Analytics + Growth Readiness

- activation/time-to-value metrics;
- acquisition channel metadata;
- privacy-safe product events;
- plan conversion ve entitlement kullanım görünümü;
- churn/retention export;
- 30/60/90/125 logo hedefi internal dashboard entegrasyonu yalnız gerçekten gerekli ise.

Satış CRM’i KALKAN_OS ürün DB’sinde yeniden yazma. Mevcut CRM veya basit dış sistem kullan; ürün yalnız müşteri aktivasyon ve değer olaylarını ölçsün.

---

## 10. 2027 hedefinin ürüne etkisi

2027 hedefi:

- 25 regulated müşteri;
- 100 CFO Kalkanı müşterisi;
- toplam 125 ücretli logo;
- 2,275 milyon USD çıkış ARR.

Bu finansal hedefleri test fixture veya ürün davranışına hard-code etme. Ürünün desteklemesi gereken operasyonel hedefler:

- CFO Kalkanı onboarding <1 iş günü;
- müşteri başına destek <2 saat/ay;
- hazır connector’da ilk kanıt <1 iş günü;
- kurum kapsamı <60 dakika;
- resmî değişiklikten doğrulanmış etki <24 saat;
- audit package <1 saat;
- plan provision işlemi <5 dakika;
- yeni tenant oluşturma otomasyonu;
- self-service yardım ve örnek veri;
- partner tarafından güvenli tenant daveti/provision akışı.

Partner, başka tenant’ın verisini göremez. Partner rolü tenant-membership ve açık delegation ile sınırlandırılır; global service-role erişimi verilmez.

---

## 11. E2E senaryoları

Mevcut e2e’lere ekle:

### CFO Kalkanı

1. corporate finance tenant oluştur;
2. profil wizard’ını tamamla;
3. baseline pack oluşsun;
4. `BEST_PRACTICE` ve `LEGAL_MANDATORY` ayrımını doğrula;
5. Starter kullanıcının Pro özelliğine erişemediğini server ve UI’da doğrula;
6. planı Pro’ya yükselt;
7. SoD ataması import et;
8. çatışma üret;
9. bağımsız kullanıcı istisna/telafi iş akışını tamamlasın;
10. kontrol testi çalıştır;
11. bulgu ve aksiyon üret;
12. retest ile kapanış;
13. CFO yönetim raporu üret.

### Regulated

1. resmî artifact fixture ingest;
2. provision/obligation doğrula;
3. kurum profiliyle applicability üret;
4. hukuk onayı olmayan mapping’in zorunlu kontrol çalıştırmadığını doğrula;
5. verified mapping’i aktive et;
6. kontrol testi çalıştır;
7. evidence/legal snapshot oluşsun;
8. başarısız test bulgu üretsin;
9. retest ve verified closure;
10. audit package manifest/hash doğrula.

### Güvenlik

- CFO Starter entitlement bypass;
- downgrade sonrası veri kaybı olmaması;
- tenant A’nın tenant B finance profile/IBAN verification/evidence verisine erişememesi;
- partner cross-tenant erişim reddi;
- forged plan/role claim reddi;
- CSV formula injection;
- malicious evidence/file;
- read-only connector’ın write denemesi;
- audit export yetkisiz erişim;
- service-role key browser bundle kontrolü.

---

## 12. Açık kurucu kararları

Claude Code aşağıdaki kararları uydurmayacaktır:

1. Billing provider: Stripe/Paddle/iyzico/manuel fatura.
2. Gerçek plan fiyatları ve KDV/para birimi politikası.
3. Ücretsiz trial süresi.
4. Partner komisyonu ve delegation kapsamı.
5. İlk ERP/banka read-only connector hedefleri.
6. KMS/HSM imza sağlayıcısı.
7. RFC 3161 TSA.
8. Hukuk doğrulama rolünü hangi kişi/kurumun üstleneceği.
9. Üçüncü taraf mevzuat/standart lisansları.
10. Gerçek düzenleyici dış gönderim connector’ı.

Bu kararlar kodlamayı engellemiyorsa adapter/interface ve `OPEN-DECISION` ile ilerle. Gerçek para tahsilatı, dış otorite gönderimi veya credential bağlantısı için açık onay bekle.

---

## 13. Claude Code’a verilecek ilk komut

Bu V2 belgesini ve V1 ana talimatını oku. Henüz ürün kodu yazma.

İlk turda yalnız:

1. repository ve git durumunu incele;
2. V1’de bildirilen test tabanını doğrula;
3. M16’nın kalan işlerini gerçek koda göre çıkar;
4. V2’nin mevcut şema/route/rol sistemiyle fark analizini yap;
5. `ROADMAP` için M16 sonrası CFO Kalkanı ve Regulated MVP vertical slice planını hazırla;
6. aşağıdaki ADR taslaklarını üret:
   - organization segmentation;
   - obligation basis types;
   - versioned plan/entitlement;
   - read-only finance integration boundary;
   - product analytics privacy;
   - compliance capability Coverage Ledger;
7. ilk uygulanacak PR için dosya ve migration bazlı plan sun;
8. açık kurucu kararlarını ayrı listele.

İlk turda:

- gerçek billing entegrasyonu yapma;
- M17/M18 kodlama;
- toplu mevzuat seed etme;
- ERP/banka credential entegrasyonu;
- dış otoriteye gönderim;
- framework değişimi;
- tasarım sistemi rewrite’ı

yapma.

Önerilen ilk uygulama kararı değişmez: **önce M16 üretim kapanışı**, sonra **Organization Segment + Entitlement Foundation**, sonra **CFO Kalkanı MVP**, ardından **Regulated Regulation-to-Evidence MVP**.

---

## 14. Nihai “done” tanımı

Bu V2 stratejisi tamamlandı sayılmaz; ancak aşağıdakiler aynı staging ortamında gerçek kullanıcı akışıyla çalışırsa MVP kabul edilir:

### CFO Kalkanı

- self-service tenant/profile;
- plan/entitlement;
- baseline pack;
- SoD/ödeme/ERP-banka erişim kontrolü;
- kanıt/test/bulgu/retest;
- yönetim raporu;
- <1 iş günü time-to-first-evidence ölçümü.

### Regulated

- resmî kaynak artifact;
- hüküm/yükümlülük;
- applicability;
- kontrol/test/kanıt;
- legal snapshot;
- bulgu/retest/closure;
- yeniden üretilebilir audit package.

### Platform

- tenant ve partner izolasyonu;
- RLS ve entitlement güvenliği;
- responsive dark/light UI;
- Hostinger/Supabase staging;
- gözlemlenebilir cron/connector;
- yedek/restore doğrulaması;
- production build;
- güncel ADR/ROADMAP;
- sıfır beklenmeyen skip;
- test adetleri ve başarısız/flaky raporu.

“UI var”, “tablo var”, “seed var” veya “happy path çalıştı” tek başına MVP değildir.
