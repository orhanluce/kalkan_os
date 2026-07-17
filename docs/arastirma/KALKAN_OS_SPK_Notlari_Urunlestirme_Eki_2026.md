# KALKAN_OS - SPK/SPL Çalışma Notlarının Ürünleştirilmesi

## İncelenen dokümanlar

- SPL 1020 - Bilgi Sistemleri Yönetimi ve Denetimi, 30 Haziran 2026, 210 sayfa.
- SPL 1023 - Bilgi Sistemleri Güvenliği, 30 Haziran 2026, 127 sayfa.

Bu çalışma, dokümanların telifli metnini veya sınav sorularını kopyalamaz. İçerikteki kavramları KALKAN_OS için özgün ürün gereksinimlerine, kontrol nesnelerine, kanıt tiplerine ve test senaryolarına dönüştürür.

> Önemli sınır: Çalışma notları ürün araştırması ve kontrol keşfi için değerlidir; tek başına bağlayıcı mevzuat kaynağı olarak kullanılmamalıdır. Üretim kontrol paketi yayımlanmadan önce ilgili düzenlemenin Resmi Gazete/SPK üzerindeki yürürlükteki metni, kapsamı, geçiş hükümleri ve güncel değişiklikleri hukuk/uyum uzmanı tarafından doğrulanmalıdır.

---

## 1. Yönetim özeti

Bu iki dokümandan KALKAN_OS'a aktarılması gereken en önemli yeni yetenekler şunlardır:

1. **SPK Kurum Profili ve Kapsam Motoru:** Kuruluş tipine göre yükümlülük, muafiyet, sıklık ve son tarih üretimi.
2. **Varlık-Hizmet-Süreç-Bağımlılık Grafiği:** Envanterleri ayrı tablolar olmaktan çıkarıp kritik hizmetlere bağlama.
3. **Denetim Metodolojisi Çalışma Alanı:** Önemlilik, risk, evren, örneklem, çalışma kâğıdı, kanıt ve bulgu zinciri.
4. **Görevler Ayrılığı Motoru:** SoD matrisi, çatışma kuralları, istisna ve telafi edici kontrol takibi.
5. **Kanıt Uygunluk Puanı:** Kanıtın yeterlilik, uygunluk, güvenilirlik, dönem ve kapsam ölçüleriyle değerlendirilmesi.
6. **Kontrol Yaşam Döngüsü:** Tasarım, onay, duyuru, eğitim, uygulama, test, gözden geçirme ve değişiklik geçmişi.
7. **İz Kaydı Güvence Paketi:** Kaynak kapsama, zaman senkronizasyonu, bütünlük, saklama, erişim ve gözden geçirme testleri.
8. **Üçüncü Taraf Yaşam Döngüsü:** Başlatma, sürdürme ve sonlandırma aşamalarına bağlı kontrol ve kanıtlar.
9. **Kriptografik Anahtar Yaşam Döngüsü:** Üretimden arşivleme/imha aşamasına kadar sahiplik ve kanıt.
10. **Rol Bazlı Eğitim Güvencesi:** Yıllık farkındalığın ötesinde role, riske ve sorumluluğa bağlı eğitim kanıtı.

Bu yetenekler KALKAN_OS'u bir kontrol listesi veya doküman arşivinden çıkarıp, SPK denetimine hazırlanabilen **kanıta dayalı sürekli güvence sistemi** haline getirir.

---

## 2. Ürüne eklenecek SPK kapsam profili

### 2.1. Yeni nesne: `RegulatoryEntityProfile`

Kurumun yalnız “finans şirketi” olarak tanımlanması yeterli değildir. Aşağıdaki özellikler kapsam kararını etkileyebilir:

- Kuruluş türü ve SPK statüsü
- Faaliyet izinleri
- Halka açıklık durumu
- Aracı kurum yetki kapsamı
- Portföy yönetimi/saklama rolü
- Borsa, piyasa işleticisi veya altyapı kuruluşu niteliği
- Kripto varlık platformu veya saklama hizmeti niteliği
- Banka, sigorta, finansman gibi başka bir birincil düzenleyici rejime tabi olma
- Kritik bilgi sistemi ve kritik iş süreci varlığı
- Dış hizmet/bulut kullanımı
- Kuruluş büyüklüğü ve uygulanabilir muafiyetler

### 2.2. Kapsam motorunun çıktıları

Her kural aşağıdaki makinece işlenebilir alanlarla tutulmalıdır:

| Alan | Açıklama |
|---|---|
| `obligation_id` | Değişmez iç kimlik |
| `legal_source` | Resmi düzenleme kaynağı ve sürümü |
| `applicability_expression` | Kurum profiline göre kapsam koşulu |
| `mandatory_or_guidance` | Zorunluluk veya iyi uygulama ayrımı |
| `control_objective` | Beklenen güvenlik/yönetim sonucu |
| `frequency` | Sürekli, yıllık, olay/değişiklik tetiklemeli vb. |
| `deadline_rule` | Sabit veya olaydan türeyen son tarih |
| `evidence_requirements` | Kabul edilen asgari kanıt türleri |
| `responsible_role` | Birincil kontrol sahibi |
| `approval_role` | Onaylayan/gözeten organ |
| `exceptions` | Muafiyet ve geçiş şartları |
| `effective_from/to` | Düzenleme sürümünün geçerlilik aralığı |

### 2.3. Ürün davranışı

- Kullanıcı kurum profilini tamamladığında uygulanabilir kontrol seti otomatik oluşturulmalı.
- Kapsam kararı, hangi girdi ve hangi kural nedeniyle üretildiğini açıklamalı.
- Manuel kapsam değişikliği gerekçe, onay ve süre sonu olmadan yapılamamalı.
- Düzenleme sürümü değişince eski değerlendirmeler geçmiş sürümle doğrulanabilmeli.
- “Not applicable” sonucu kontrol sahibi ve uyum onayı ile kanıtlanmalı.

---

## 3. Birleşik varlık, hizmet ve süreç grafiği

Çalışma notları yalnız cihaz/yazılım envanterini değil, hizmet ve süreç envanterlerini de önemli hale getiriyor. KALKAN_OS'ta bunlar tek bir bağımlılık grafiğinde birleştirilmelidir.

### 3.1. Temel nesneler

- `InformationAsset`
- `BusinessService`
- `BusinessProcess`
- `Application`
- `DataSet`
- `InfrastructureComponent`
- `Facility`
- `VendorService`
- `Owner` ve `Custodian`
- `DependencyEdge`

### 3.2. Asgari varlık alanları

- Tanım ve tür
- Edinim/aktifleşme tarihi
- Lisans, seri veya benzersiz kimlik
- Fiziksel/mantıksal konum
- Sahip ve kullanıcı/sorumlu
- Gizlilik, bütünlük, erişilebilirlik ve kritiklik sınıfı
- Yedekleme ve kurtarma bilgisi
- Yaşam döngüsü durumu
- Destek/bakım sonu
- İlgili hizmetler, süreçler, veriler ve tedarikçiler
- Kanıt kaynağı ve son doğrulama zamanı

### 3.3. KALKAN_OS'a özgü değer

Grafik aşağıdaki sorulara otomatik cevap üretmelidir:

- Bu kritik hizmet hangi uygulama, veri, ağ, tesis ve tedarikçilere bağlı?
- Bu varlık devreden çıkarsa hangi SPK kontrolleri ve etki toleransları etkilenir?
- Envanterde sahibi olmayan, sınıflandırılmamış veya son doğrulaması geçmiş varlık var mı?
- Bir tedarikçi kaç kritik hizmette tek hata noktası oluşturuyor?
- Sızma testi kapsamı kritik hizmet grafiğini gerçekten kapsıyor mu?

---

## 4. SPK odaklı kontrol kütüphanesi

Aşağıdaki kontrol aileleri ürün kütüphanesine eklenmelidir. Kontrol ifadeleri özgün olarak modellenmeli; kaynak dokümanın metni kopyalanmamalıdır.

| Aile | KALKAN_OS kontrol paketi | Öncelik |
|---|---|---:|
| Yönetişim | Politika, strateji, kurul/üst yönetim onayı, bağımsız güvenlik sorumlusu | P0 |
| Risk | Kriter, analiz, kabul, işleme planı, onay, takip | P0 |
| Kontrol yönetimi | Tasarım, sahiplik, performans ölçümü, sürekli izleme | P0 |
| Envanter | Varlık, hizmet, süreç ve bağımlılık yönetimi | P0 |
| Görevler ayrılığı | Çatışma matrisi ve telafi edici kontroller | P0 |
| Erişim | Yaşam döngüsü, ayrıcalıklı erişim, MFA, periyodik gözden geçirme | P0 |
| İz kayıtları | Kaynak, içerik, zaman, bütünlük, saklama, izleme | P0 |
| Üçüncü taraf | Ön değerlendirme, sözleşme, sürekli gözetim, çıkış | P0 |
| Olay/SOME | Sınıflandırma, müdahale, bildirim, ders çıkarma | P1 |
| Ağ | Topoloji, segmentasyon, uzaktan erişim, güvenlik cihazları | P1 |
| Fiziksel/çevresel | Erişim, CCTV, UPS, jeneratör, yangın/su/ısı testleri | P1 |
| Kriptografi | Algoritma ve anahtar yaşam döngüsü | P1 |
| Güvenli geliştirme | Ortam ayrımı, değişiklik, sürüm ve üretim onayı | P1 |
| Süreklilik | Kritik süreç, kurtarma planı ve test kanıtı | P1 |
| Farkındalık | Rol bazlı yıllık ve olay tetiklemeli eğitim | P1 |
| Sızma testi | Bağımsızlık, kapsam, rapor, düzeltme ve bildirim takvimi | P1 |

---

## 5. Görevler Ayrılığı (SoD) motoru

Bu, notlardan çıkan en ürünleştirilebilir niş yeteneklerden biridir.

### 5.1. Veri modeli

- `CriticalActivity`: kritik işlem veya adım
- `BusinessRole`: işi yapan rol
- `ConflictRule`: birlikte bulunmaması gereken roller/adımlar
- `RoleAssignment`: kişi-rol-sistem bağlamı
- `SoDViolation`: saptanan çatışma
- `CompensatingControl`: önleyici kontrol mümkün değilse alternatif
- `ExceptionApproval`: gerekçe, risk sahibi, onaylayan, süre sonu
- `ReviewCampaign`: periyodik SoD gözden geçirmesi

### 5.2. Başlangıç çatışma kuralları

- Talep eden kişi ile onaylayan kişi aynı olmamalı.
- Yazılım geliştiren kişi üretime tek başına çıkaramamalı.
- Erişim oluşturan kişi kendi erişimini onaylayamamalı.
- Ödeme/finansal işlem başlatma ve nihai onay farklı rollerde olmalı.
- Kanıt yükleyen kişi kendi kontrol testinin nihai sonucunu tek başına onaylamamalı.
- Bulgu sahibi, bulgunun bağımsız kapanış doğrulamasını yapamamalı.
- Kritik tedarikçi değerlendirmesini yapan ile nihai risk kabulünü yapan ayrılmalı.

### 5.3. Telafi edici kontrol yönetimi

Küçük aracı kurumlarda tam görev ayrılığı mümkün olmayabilir. Ürün yalnız “uygunsuz” demek yerine:

- çatışmanın riskini kaydetmeli,
- alternatif kontrol seçtirmeli,
- log inceleme veya ikinci seviye yönetici kontrolü gibi testi tanımlamalı,
- daha sık gözden geçirme periyodu atamalı,
- istisnaya süre sonu koymalı,
- telafi edici kontrol çalışmazsa bulguyu otomatik yeniden açmalıdır.

---

## 6. Denetim metodolojisi ve kanıt motoru

1020 notları KALKAN_OS'un Auditor Room modülünü önemli ölçüde genişletebilir.

### 6.1. Yeni denetim nesneleri

- `AuditUniverse`
- `AuditEngagement`
- `AuditObjective`
- `MaterialityRule`
- `RiskAssessment`
- `ControlRelianceDecision`
- `Population`
- `SamplingPlan`
- `SampleItem`
- `TestProcedure`
- `Workpaper`
- `EvidenceEvaluation`
- `Finding`
- `ManagementResponse`
- `IndependentClosureReview`

### 6.2. Örnekleme motoru

Her testte şu bilgiler zorunlu olmalıdır:

- Evrenin tanımı ve kaynağı
- Evrenin tamlığına ilişkin kanıt
- İncelenen dönem
- Örnekleme yöntemi
- Örnek büyüklüğü ve gerekçesi
- Seçim seed'i veya tekrar üretilebilir seçim bilgisi
- Seçilen kayıtlar
- Sapma ve istisnalar
- Sonucun evrene genellenme sınırı
- Denetçi yargısı ve gözden geçiren onayı

KALKAN_OS örnek seçimini otomatik yapabilir; ancak örnek büyüklüğünün yeterliliği ve denetim görüşü yapay zekâya bırakılmamalıdır.

### 6.3. Kanıt kalite puanı

Kanıt için tek bir “yüklendi” durumu yerine aşağıdaki eksenler tutulmalıdır:

| Eksen | Soru |
|---|---|
| İlgililik | Kanıt test edilen kontrol iddiasını karşılıyor mu? |
| Güvenilirlik | Kaynak bağımsız mı, sistemden doğrudan mı, değiştirilebilir mi? |
| Tamlık | Tüm dönem, sistem ve evren kapsanıyor mu? |
| Güncellik | Kanıt ilgili değerlendirme dönemine ait mi? |
| Bütünlük | Hash, imza, zaman damgası ve zincir doğrulanabiliyor mu? |
| Tekrar üretilebilirlik | Sorgu/test yeniden çalıştırılabilir mi? |
| Yetkilendirme | Kanıtı üreten ve onaylayan roller uygun mu? |

Puan, karar destek amacıyla kullanılmalıdır; mevzuata uyum kararını otomatik vermemelidir.

---

## 7. Test edilebilir ilk 20 SPK kontrolü

| ID | Kontrol testi | Beklenen kanıt | Otomasyon |
|---|---|---|---:|
| SPK-GOV-01 | Bilgi güvenliği politikasının geçerli onayı | Onay kaydı, sürüm, kurul kararı | Orta |
| SPK-GOV-02 | Politikanın dönemsel gözden geçirilmesi | Review kaydı, değişiklik özeti | Yüksek |
| SPK-GOV-03 | Güvenlik sorumlusunun bağımsız raporlama hattı | Organizasyon şeması, görev tanımı | Düşük |
| SPK-RSK-01 | Tüm kritik varlıkların risk analizinde bulunması | Risk-varlık eşleşmesi | Yüksek |
| SPK-RSK-02 | Risk kabul ve işleme planlarının onayı | Workflow/audit kayıtları | Yüksek |
| SPK-AST-01 | Envanter zorunlu alanlarının tamlığı | CMDB/asset export | Yüksek |
| SPK-AST-02 | Hizmet-süreç-varlık bağımlılıklarının tamlığı | Bağımlılık grafiği | Orta |
| SPK-SOD-01 | Kritik rol çatışmalarının bulunmaması | IAM/HR rol verileri | Yüksek |
| SPK-SOD-02 | Açık çatışmaların geçerli telafi edici kontrolü | İstisna ve test kaydı | Yüksek |
| SPK-IAM-01 | Uzaktan erişimde MFA | VPN/IAM yapılandırması | Yüksek |
| SPK-IAM-02 | Ayrıcalıklı erişimlerin periyodik onayı | PAM/IAM review kaydı | Yüksek |
| SPK-NET-01 | Ağ topolojisinin güncelliği | Onaylı diyagram ve discovery farkı | Orta |
| SPK-NET-02 | Kritik ağların segmentasyonu | Firewall/VLAN yapılandırması | Yüksek |
| SPK-LOG-01 | Kritik sistemlerde log kaynağı kapsamı | SIEM source inventory | Yüksek |
| SPK-LOG-02 | Log zaman senkronizasyonu ve bütünlüğü | NTP ve storage ayarları | Yüksek |
| SPK-LOG-03 | Saklama süresinin politika ile uyumu | SIEM/storage lifecycle | Yüksek |
| SPK-TPR-01 | Kritik tedarikçi sözleşme maddelerinin tamlığı | Sözleşme kontrol matrisi | Orta |
| SPK-TPR-02 | Sonlanan tedarikçi erişimlerinin kaldırılması | IAM, VPN, sertifika/SSH kayıtları | Yüksek |
| SPK-CRY-01 | Kripto anahtar envanterinin tamlığı | KMS/HSM export ve sertifikalar | Yüksek |
| SPK-TRN-01 | Rol bazlı yıllık eğitim kapsamı | HR/LMS kayıtları | Yüksek |

Her kontrol testine `source_version`, `applicability`, `frequency`, `owner`, `reviewer`, `evidence_schema`, `failure_severity` ve `retest_rule` alanları eklenmelidir.

---

## 8. İz kaydı güvence paketi

1023'teki iz kaydı bölümü, KALKAN_OS için yalnız “log tutuluyor mu?” sorusundan daha güçlü bir paket gerektiriyor.

### Kontrol boyutları

1. Kritik sistem ve olay kaynaklarının envanteri
2. Kullanıcı, zaman, kaynak, hedef, eylem ve sonuç alanlarının yeterliliği
3. Saatlerin güvenilir zaman kaynağıyla senkronizasyonu
4. Logların yetkisiz değişiklik ve silmeye karşı korunması
5. Log yöneticisi ile izlenen sistem yöneticisinin rol ayrımı
6. Saklama ve imha politikasının sisteme uygulanması
7. Merkezi toplama başarısızlığının alarm üretmesi
8. Kritik olayların izleme/use-case kapsamına alınması
9. Alarm yorgunluğunu ölçen tuning süreci
10. İnceleme, eskalasyon ve kapanış kanıtı

### Connector fırsatları

- SIEM kaynak listesi ve ingestion durumu
- NTP yapılandırması
- Object-lock/WORM durumu
- Log retention/lifecycle politikaları
- Kritik use-case etkinliği
- Son başarılı log zamanı ve veri boşlukları

KALKAN_OS ham logları merkezi olarak kopyalamamalı; kontrol sonucunu, sorgu tanımını, örneklenmiş kanıtı ve bütünlük bilgisini saklamalıdır.

---

## 9. Üçüncü taraf yaşam döngüsü

Mevcut M09 yoğunlaşma grafiği aşağıdaki operasyonel yaşam döngüsüyle genişletilmelidir.

### Başlatma

- Hizmet ve veri kapsamı
- Kritiklik ve bağımlılık
- Veri işleme, saklama, aktarım ve imha yerleri
- Alt yükleniciler ve n'inci taraflar
- Erişim türleri ve güvenli bağlantı yöntemi
- SLA, olay bildirimi, denetim hakkı, çıkış ve veri iade/imha maddeleri
- Bağımsız güvence raporu/sızma testi değerlendirmesi

### Sürdürme

- SLA ve güvenlik KPI takibi
- Sertifika/rapor süre sonları
- Personel, sahiplik ve alt yüklenici değişiklikleri
- Erişimlerin periyodik gözden geçirilmesi
- Zafiyet/yama ve olay performansı
- Veri konumu ve bağımlılık değişiklikleri
- Sözleşme kontrollerinin tekrar testi

### Sonlandırma

- Kullanıcı, VPN, PAM, sertifika, API ve SSH anahtarlarının iptali
- Fiziksel kart, token ve anahtarların iadesi
- Veri iadesi, güvenli silme veya imha kanıtı
- Paydaş bildirimleri
- Geçiş/iş sürekliliği planı
- Sonlandırma sonrası belirli süre log gözetimi
- Bağımsız kapanış doğrulaması

Bu akış tamamlanmadan tedarikçi kaydı `closed_verified` durumuna geçmemelidir.

---

## 10. Kriptografi modülüne eklenecekler

M15 yalnız algoritma/PQC envanteri olarak kalmamalı; anahtar yaşam döngüsünü kapsamalıdır:

- Anahtar amacı, sahibi ve bağlı sistem/veri
- Üretim yöntemi ve güvenli rastgelelik kaynağı
- HSM/KMS konumu ve export edilebilirlik
- Dağıtım/erişim yetkileri
- Aktivasyon ve kullanım dönemi
- Rotasyon ve kriptoperiyot
- Yedekleme/kurtarma politikası
- İptal/sonlandırma
- Arşivleme veya güvenli imha
- Her aşama için iz kaydı ve SoD
- Algoritma/anahtar uzunluğu politika uyumu
- Sertifika ve güven zinciri süresi

Bu gereksinimler M01'deki JWS imzalama anahtarları ve RFC 3161 doğrulama zinciri için de doğrudan uygulanmalıdır.

---

## 11. Eğitim ve yetkinlik modülü

Genel yıllık farkındalık kaydı yeterli görülmemelidir. KALKAN_OS aşağıdakileri yönetmelidir:

- Rol-risk-eğitim matrisi
- Zorunlu yıllık eğitim
- Yeni işe giriş ve rol değişikliği eğitimi
- Güncel tehdit veya önemli olay sonrası hedefli eğitim
- Ayrıcalıklı kullanıcı, geliştirici, denetçi, yönetici ve tedarikçi için farklı içerik
- Katılım, sınav/ölçüm ve başarısızlık sonrası tekrar
- Eğitim materyali sürümü
- Kapsam dışı kalan kullanıcıların otomatik tespiti

SPL sınav sorularının kendisi ürüne aktarılmamalıdır. KALKAN_OS kendi özgün soru bankasını ve senaryo tabanlı ölçümlerini üretmelidir.

---

## 12. Mevcut yol haritasına değişiklikler

| Mevcut modül | SPK notlarından eklenecek kapsam |
|---|---|
| M01 Evidence Envelope | Kanıt kalite boyutları, kaynak/provenance, denetçi değerlendirmesi |
| M02 Control Test DSL | Evren, örnekleme, sapma, telafi edici kontrol ve tekrar test alanları |
| M03 Scope Engine | `RegulatoryEntityProfile`, muafiyet, süre ve sürüm kuralları |
| M04 Critical Service | Varlık-hizmet-süreç-veri-tedarikçi bağımlılık grafiği |
| M05 Incident Clock | Kurumsal/Sektörel SOME ve düzenleyici bildirim rota şablonları |
| M06 Recovery Proof | Kritik süreç kapsamı ve tatbikat kanıtı |
| M08 Connector Platform | IAM, VPN, SIEM, CMDB, LMS, KMS/HSM ve NTP connector'ları |
| M09 Third Party | Başlatma-sürdürme-sonlandırma kontrol kapıları |
| M15 Crypto/PQC | Tam anahtar yaşam döngüsü ve kanıtları |
| M16 SBOM | Geliştirme-operasyon görev ayrılığı ve üretim onay zinciri |
| Auditor Room | Önemlilik, örnekleme, çalışma kâğıdı ve bağımsız kapanış incelemesi |

### Yeni modül önerisi: M19 - SPK Assurance Pack

M19 bağımsız bir “mevzuat metni ekranı” değil, aşağıdaki bileşenlerin paketlenmiş sürümü olmalıdır:

- SPK kuruluş profili ve uygulanabilirlik sihirbazı
- Sürümlü SPK kontrol kütüphanesi
- SPK denetim takvimi ve yükümlülük saatleri
- Hazır kontrol testleri ve kanıt şemaları
- SoD matrisi
- Denetim örnekleme ve çalışma kâğıdı alanı
- SPK uyum/boşluk ve yönetim raporları
- Sızma testi bulgu ve bildirim takibi
- Kurumsal/Sektörel SOME çalışma akışları

---

## 13. Uygulama backlog'u

### P0 - İlk 6 hafta

1. `RegulatoryEntityProfile` şeması ve kapsam karar günlüğü
2. SPK kontrol/obligation metadata şeması
3. Varlık, hizmet ve süreç envanteri zorunlu alanları
4. `DependencyEdge` grafiği
5. SoD çatışma kuralı ve istisna modeli
6. Kanıt kalite değerlendirmesi
7. Denetim evreni, test ve çalışma kâğıdı temel modeli

### P0 - Hafta 7-12

1. IAM/Keycloak SoD ve erişim review entegrasyonu
2. SIEM log kaynak kapsama testi
3. CMDB/asset import ve mutabakat
4. Tedarikçi yaşam döngüsü kapıları
5. Politika/kurul onayı ve yıllık review workflow'u
6. SPK yönetim dashboard'u

### P1 - Ay 4-6

1. Örnekleme motoru
2. VPN/MFA ve uzaktan erişim testleri
3. KMS/HSM anahtar yaşam döngüsü
4. LMS/HR eğitim kapsamı
5. Fiziksel/çevresel bakım ve test kanıtları
6. SOME ve sızma testi takvimi

### P2 - Ay 7-9

1. SPK denetim rapor paketi
2. Bağımsız kapanış doğrulaması
3. Ağ topolojisi ile discovery fark analizi
4. Tedarikçi yoğunlaşma ve exit-readiness skoru
5. Anonim SPK sektör benchmark'ı için veri hazırlığı

---

## 14. Kabul kriterleri

M19/SPK Assurance Pack ilk üretim sürümü aşağıdakiler sağlanmadan tamamlanmış sayılmamalıdır:

- En az üç farklı SPK kuruluş tipi için açıklanabilir kapsam sonucu üretilmesi
- Her yükümlülüğün resmi kaynak sürümüne izlenebilir olması
- En az 50 test edilebilir kontrolün kanıt şemasıyla bulunması
- Varlık-hizmet-süreç bağımlılıklarında sahipsiz ve sınıflandırılmamış kayıtların bulunabilmesi
- En az 10 SoD çatışma kuralının IAM verisi üzerinde çalışması
- Telafi edici kontrolün süre sonu ve tekrar testinin otomatik izlenmesi
- Denetim evreninden tekrar üretilebilir örnek seçilebilmesi
- Kanıtın kaynak, dönem, bütünlük ve reviewer bilgisi olmadan doğrulanmış sayılamaması
- Tedarikçi sonlandırmasının erişim ve veri imha kanıtı olmadan kapanmaması
- Raporların veri hash'i ve kanıt manifestiyle yeniden doğrulanabilmesi
- Hiçbir AI çıktısının otomatik mevzuat uyum kararı oluşturmaması

---

## 15. Ürüne alınmaması gereken içerikler

Dokümanlardaki her konu ürün özelliğine dönüştürülmemelidir. Şunlar doğrudan backlog'a alınmamalıdır:

- Ağ protokolleri ve topolojilere ilişkin genel ders anlatıları
- Temel zararlı yazılım veya saldırı tanımları
- SPL'nin telifli sınav soruları ve cevapları
- Kaynak metinden kopyalanmış uzun kontrol açıklamaları
- Yürürlükteki resmi düzenleme doğrulanmadan sabitlenmiş süre ve kapsam hükümleri
- KALKAN_OS'u SIEM, firewall, EDR, NAC veya PAM ürününe dönüştürecek özellikler

Bu alanlarda KALKAN_OS'un rolü güvenlik aracını yeniden yapmak değil; aracın doğru kurulup çalıştığını kanıtlayan test ve kanıtı yönetmektir.

---

## 16. Nihai ürün kararı

SPK çalışma notları KALKAN_OS'un yönünü değiştirmiyor; ürün tezini güçlendiriyor:

> KALKAN_OS, kontrol dokümanı depolayan bir GRC ekranı değil; kurum tipine göre kapsam belirleyen, varlık-hizmet bağımlılığını kuran, kontrolü test eden, örneklemi ve kanıtı doğrulayan, bulguyu bağımsız retest ile kapatan finansal güvence işletim sistemi olmalıdır.

En yüksek öncelikli dört geliştirme şunlardır:

1. **SPK kapsam ve kontrol paketi**
2. **SoD ve telafi edici kontrol motoru**
3. **Denetim örnekleme/çalışma kâğıdı motoru**
4. **Varlık-hizmet-süreç-tedarikçi bağımlılık grafiği**

Bu dört unsur tamamlandığında KALKAN_OS, aracı kurumlara yalnız “hazır mısınız?” raporu değil, denetim sırasında kullanılabilecek açıklanabilir ve yeniden doğrulanabilir bir güvence paketi sunabilir.
