# WARDROOF (KALKAN_OS): VC, Ürün İyileştirme ve Ölçekleme Raporu

**Tarih:** 20 Temmuz 2026  
**Kapsam:** VC değerlendirmesi, pazar konumu, şeytanın avukatı, mevcut ürünü iyileştirme, yatırım hazırlık planı ve aylık işletim maliyeti  
**Amaç:** Teknik üretimi yatırım yapılabilir, satılabilir ve güvenilir bir B2B uyum platformuna dönüştürmek

> Kısa hüküm: WARDROOF, sıradan bir GRC ekranı değil; hüküm-kontrol-test-kanıt-karar zincirini doğrulanabilir artefaktlarla işleten iddialı bir “uyum işletim sistemi” adayıdır. Teknik kabiliyet yatırım görüşmesini hak ediyor. Fakat bugün yatırım yapılabilir şirketten çok, güçlü ürün çekirdeği olan doğrulanmamış bir ticari tezdir.

---

## 1. Yönetici özeti

WARDROOF'un en değerli tarafı, mevzuatı yalnız listelemek yerine kurumun kontrol, test, kanıt, bulgu, retest ve bağımsız onay akışına bağlamasıdır. Kod tabanında tenant izolasyonu, append-only kayıtlar, maker-checker, kanıt bütünlüğü, Proof Room, DORA RoI export, SoD, üçüncü taraf riski, AI güvencesi ve dayanıklılık grafiği gibi kurumsal alıcıların ciddiye alacağı yapı taşları vardır.

Yatırım kararı bugün **koşullu hayır / güçlü izleme** olmalıdır. Sebep ürün yetersizliği değil; ücretli pilot, doğrulanmış fiyat, satış döngüsü, müşteri kazanım maliyeti, yenileme ve kurum içi kullanım kanıtının bulunmamasıdır. İlk üç ücretli tasarım ortağında ölçülebilir değer kanıtlanırsa karar hızla **seed yatırımı yapılabilir** seviyesine dönebilir.

Ürünün doğru konumu “her regülasyonu bilen yapay zekâ” değildir. Doğru konum şudur:

> Finans kurumları ve kritik finans operasyonları için, iddiayı kaynağa ve yürütme kanıtına bağlayan denetlenebilir uyum işletim sistemi.

## 2. Bu proje ne ifade ediyor?

### 2.1. Ürün değil, güven altyapısı

WARDROOF'un potansiyeli görev takip yazılımı olmaktan gelmiyor. Asıl değer, bir kurumun “uyumluyuz” beyanını şu zincirle sınanabilir hale getirmesidir:

**Resmî kaynak → hüküm → yükümlülük → uygulanabilirlik kararı → kontrol → test → kanıt → bulgu → retest → bağımsız onay → paylaşılabilir doğrulama paketi**

Bu zincir düzgün çalışırsa ürün, denetim öncesi dosya toplama işini azaltır; yönetim beyanlarını savunulabilir hale getirir; hangi kontrolün gerçekten çalıştığını görünür kılar; tedarikçi ve AI riskini aynı güven modeli içinde yönetir.

### 2.2. Kod tabanının gösterdiği olgunluk

20 Temmuz 2026 tarihli repo incelemesinde yaklaşık **47 ürün sayfası, 35 API rotası, 113 migration, 125 birim/RLS test dosyası ve 44 Playwright e2e spec dosyası** sayıldı. Bunlar kalite sonucu değil, kapsam göstergesidir. Repo belgeleri son doğrulanmış kapılarda 1.300'ün üzerinde birim testi ve 70'in üzerinde e2e akışı raporluyor; bu sayıların yatırım veri odasında temiz bir commit üzerinde yeniden üretilmesi gerekir.

Öne çıkan çalışan alanlar:

- çok kiracılı Supabase/Postgres mimarisi ve RLS;
- kanıt kasası, hash/manifest ve paylaşılabilir Proof Room;
- kontrol test motoru; `Failed`, `Unknown`, `Stale` ve kabul edilmiş istisnayı ayıran durum modeli;
- görevler ayrılığı (SoD), CSV önizleme/uygulama/rollback ve maker-checker;
- DORA bilgi sicili exportu ve alan bazlı kaynak/kanıt soyu;
- üçüncü ve dördüncü taraf riski, sözleşme ve çıkış planı;
- politika yaşam döngüsü, denetim çalışma alanı ve örnekleme;
- AI sistem/ajan envanteri, insan onayı ve karar makbuzu;
- kritik hizmet bağımlılık ve etki grafiği;
- Türkçe yardım merkezi ve erişilebilirlik testleri.

### 2.3. Savunulabilir üstünlük nerede oluşabilir?

Moat bugün kod miktarı değildir. Savunulabilirlik şu dört katmanda oluşabilir:

1. **Doğrulanmış yerel düzenleme corpus'u:** SPK, TCMB, KVKK ve 7545 gibi rejimlerin sürümlü, hukuk uzmanı onaylı hüküm-kontrol eşlemeleri.
2. **Kanıt soyu:** Müşterinin geçmiş karar, test, kanıt ve retest zincirinin platformda birikmesi.
3. **Connector ağı:** ERP, IAM, SIEM, bulut, ticketing ve banka/ödeme sistemlerinden güvenilir gözlem toplama.
4. **Denetçi ve düzenleyici kabulü:** Üretilen paketlerin gerçek denetimlerde tekrar kullanılması.

İlk iki katmanın altyapısı var; üçüncü ve dördüncü katman henüz ticari olarak kanıtlanmış değil.

## 3. Pazarda yeri

### 3.1. Talep tarafı

Talep yapısal ve zorunlu işlerden besleniyor:

- AB DORA, 17 Ocak 2025'ten beri uygulanıyor ve finans kuruluşlarının ICT risk, olay, dayanıklılık testi ve üçüncü taraf gözetimini sürekli işletmesini gerektiriyor.
- AB AI Act yükümlülükleri aşamalı yürürlüğe giriyor; AI okuryazarlığı ve genel amaçlı model yükümlülükleri başlamış durumda, diğer yükümlülüklerin takvimi güncel resmî metinden izlenmeli.
- SPK bilgi sistemleri yönetimi ve bağımsız denetim düzeni; politika, risk, süreklilik, kontrol ve denetim kanıtı ihtiyacını kalıcı hale getiriyor.
- Kurumlar GRC, dosya paylaşımı, ticketing, e-tablo ve danışmanlık arasında parçalanmış uyum operasyonunu birleştirmek istiyor.

Bu nedenle “ihtiyaç var mı?” sorusunun cevabı evet. Zor soru, müşterinin bu ihtiyacı yeni bir platform bütçesine dönüştürüp dönüştürmeyeceğidir.

### 3.2. Arz tarafı ve rekabet

Pazarın üst ucunda ServiceNow GRC, Archer, MetricStream ve benzeri geniş platformlar; otomatik uyum tarafında Vanta/Drata; regulatory intelligence tarafında CUBE/Corlytics; Türkiye'de QRegu, Regvion, denetim ve danışmanlık firmaları bulunuyor. WARDROOF hepsiyle aynı anda yarışmamalıdır.

En güçlü giriş kaması:

- **Regulated:** SPK/7545 veya DORA için dar bir kaynak-to-proof paketi;
- **Kurumsal finans:** SoD, kritik ödeme/IBAN değişikliği, ERP-banka erişimi ve denetim kanıt paketi;
- **Genişleme:** tedarikçi riski, AI governance, dayanıklılık, politika ve denetim çalışma alanı.

Pazar konumu “ucuz ServiceNow” değil; yerel hukuku, uygulanabilirlik kararını ve teknik kanıtı tek zincirde birleştiren hızlı kurulumlu uzman platform olmalıdır.

### 3.3. Pazar büyüklüğü konusunda dürüstlük

İç finansal projeksiyon, ilk Türkiye SAM'i için 250 regulated kurum ve 1.000 büyük kurumsal finans departmanı; toplam yaklaşık 22,75 milyon USD ARR kapasitesi varsayıyor. Bu rakamlar yönetim varsayımıdır, doğrulanmış pazar sayımı değildir. Yatırım sunumunda ancak isimlendirilmiş hesap listesi, kurum/lisans tekilleştirmesi ve bütçe sahibi görüşmeleriyle kullanılmalıdır.

## 4. Şeytanın avukatı

### 4.1. En sert karşı tez

WARDROOF bugün muhtemelen müşteriden daha hızlı özellik üretiyor. Çok sayıda modül, gerçek satın alma davranışı doğrulanmadan geliştirilmiş olabilir. Kurumsal alıcı “47 ekran” satın almaz; üç sonucu satın alır: daha kısa denetim, daha düşük kontrol riski ve daha savunulabilir yönetim beyanı.

### 4.2. Temel yatırım riskleri

| Risk | Şeytanın avukatı yorumu | Yatırım öncesi kanıt |
|---|---|---|
| Traction yokluğu | Teknik başarı, ödeme isteğini kanıtlamaz. | 3 ücretli pilot, 1 yıllık dönüşüm |
| Aşırı kapsam | Ürün bir kategori değil, özellik kataloğu gibi görünebilir. | Tek ICP, tek use-case, tek KPI |
| Hukuki içerik darboğazı | Yazılım ölçeklenir; hukuk uzmanı onayı ölçeklenmeyebilir. | Kaynak SLA'sı ve çift onay kapasitesi |
| Connector eksikliği | Manuel kanıt yükleme ürünü danışmanlık aracına dönüştürür. | 2-3 gerçek üretim connector'ı |
| Güven paradoksu | Uyum satan ürünün güvenlik açığı şirketi bitirebilir. | Pentest, restore provası, olay planı |
| Procurement | Hostinger/Supabase kombinasyonu bazı kurumların veri yerleşimi ve tedarikçi kapısını geçmeyebilir. | Deployment matrisi ve müşteri onayı |
| Kurucu bağımlılığı | Ürün, hukuk, satış ve teknik karar tek kişide yoğunlaşabilir. | Teknik ve regülasyon liderliği |
| Marka karmaşası | Repo KALKAN_OS; dış marka WARDROOF. Anlatı ve haklar net değil. | Marka araştırması ve tek isim mimarisi |
| Hizmet şirketi riski | Her müşteri için özel kontrol/eşleme yapılırsa brüt marj düşer. | Standart paket ve implementasyon sınırı |
| Yanlış güven | Platform “uyum garantisi” gibi algılanırsa hukuki risk büyür. | İddia dili, insan onayı ve sözleşme sınırı |

### 4.3. Neden şimdi yatırım yapmayabilirim?

- Canlı ücretli müşteri ve yenileme kanıtı yoksa değerleme ürün derinliğine dayanır, pazara değil.
- Billing provider hâlâ açık karar ve provisioning MVP seviyesinde.
- Staging, dış zamanlayıcı, restore provası, KMS/HSM ve bazı kurumsal güvenlik kararları açık.
- Çalışma dizininde inceleme sırasında önemli sayıda commitlenmemiş değişiklik vardı; clean-room release disiplini yatırım veri odasında gösterilmelidir.
- “Tek uyum işletim sistemi” vizyonu erken aşamada satış mesajını bulanıklaştırabilir.

## 5. Mevcut ürünü iyileştirme listesi

Bu bölüm yeni modül geliştirmeyi değil, var olan ürünün daha anlaşılır, güvenilir ve satın alınabilir hale getirilmesini hedefler.

### P0 - Pilot ve yatırım öncesi

1. **Tek isim ve tek cümle:** WARDROOF/KALKAN_OS ilişkisinin ne olduğunu açıklayın; ürün adı, şirket adı ve teknik kod adı ayrışsın.
2. **Ana ekranı sadeleştirin:** Her role 3-5 kritik iş; gecikmiş kanıt, açık kritik bulgu, yaklaşan yükümlülük, onay bekleyen karar.
3. **Durum dilini standardize edin:** Taslak, bilinmiyor, başarısız, eski, istisna ve doğrulanmış durumları bütün ekranlarda aynı renk ve açıklamayla gösterin.
4. **Boş durumları satış demosuna çevirin:** “Veri yok” yerine ilk kanıtı yükleme, kontrol atama veya örnek akış yönlendirmesi.
5. **İddia sınırını görünür yapın:** Her rapor ve paylaşımda “platform doğrulaması”, “uzman onayı” ve “kurum beyanı” ayrışsın.
6. **Onboarding'i ölçün:** İlk değer anına kadar geçen süre, bırakılan adım ve destek ihtiyacı kaydedilsin.
7. **Pilot veri setini temizleyin:** Demo kurum, kullanıcı, kontrol ve kanıtları tekrarlanabilir tek seed ile oluşturun.
8. **Güven sayfası hazırlayın:** Veri yerleşimi, şifreleme, RLS, yedekleme, alt işleyenler, olay bildirimi ve silme politikası.
9. **Fiyatı görünür ve sınırlı yapın:** Pilot, Regulated ve CFO Kalkanı için kapsam dışı işleri açıkça yazın.
10. **Tek başarı çıktısı seçin:** İlk pilotta “denetim paketi hazırlama süresinde azalma” ana KPI olsun.

### P1 - İlk üç müşteri

- navigasyonu persona bazlı sadeleştirin: Uyum, Denetim, BT Güvenlik, CFO;
- aynı verinin farklı ekranlardaki tekrarlarını azaltın;
- tablo filtreleri, toplu seçim, tarih ve sahiplik davranışlarını tutarlılaştırın;
- Proof Room paketine okunabilir kapak, kapsam, eksik kanıt ve doğrulama özeti ekleyin;
- her kritik iş akışında “kim, ne zaman, hangi dayanakla değiştirdi?” cevabını tek tıkta gösterin;
- bildirim gürültüsünü azaltıp yalnız eylem gerektiren olayları öne çıkarın;
- müşteri destek talebini ürün içi bağlamla kaydedin;
- dışa aktarımlarda sürüm, kapsam, hash ve doğrulama talimatını aynı yerde tutun.

### P2 - Tekrarlanabilir satış

- paketler arasında ekran değil sonuç farkı anlatın;
- örnek vaka ve ROI hesaplayıcısını gerçek pilot verisiyle oluşturun;
- rol ve izin yönetimini kurum yöneticisinin anlayacağı dile çevirin;
- denetçi/dış taraf deneyimini kurum içi deneyimden ayırın;
- erişilebilirlik ve mobil kullanım için mevcut baseline'ı her release'te koruyun;
- yardım merkezini gerçek arama ve destek sorularıyla sürekli iyileştirin.

## 6. Yatırım aşamasına geçiş planı

### 0-4 hafta: Tezi daralt

| Çıktı | Başarı ölçütü |
|---|---|
| Tek ICP ve tek giriş paketi | 20 görüşmede aynı ilk üç acı tekrar ediyor |
| İsim/konumlandırma | Karar verici ürünü 30 saniyede doğru anlatabiliyor |
| Pilot sözleşmesi | Kapsam, süre, veri, başarı metriği ve ücret net |
| Güven paketi | Security questionnaire'ın temel bölümü hazır |
| Temiz release | Clean commit'te test, build, migration ve deploy kanıtı |

### 5-8 hafta: Ücretli pilot

- üç tasarım ortağı hedefleyin; en az biri düzenlemeye tabi finans kurumu olsun;
- pilotu 8-12 hafta ve ücretli yapın;
- yalnız 20-30 kritik kontrol veya tek DORA/SPK paketiyle başlayın;
- başlangıçta mevcut hazırlama süresini ölçün;
- haftalık aktif kullanıcı değil, tamamlanan kanıt zinciri ve kapatılan bulgu ölçün;
- özelleştirme taleplerini ürün, konfigürasyon veya kapsam dışı olarak etiketleyin.

### 9-12 hafta: Kurumsal güven kapıları

- bağımsız pentest ve tenant kaçış testi;
- staging ortamı ve gerçek veri restore provası;
- yedek, RTO/RPO ve olay müdahale tatbikatı;
- KMS/HSM ve imza/zaman damgası kararı;
- DPA, alt işleyen listesi, veri yerleşimi ve silme prosedürü;
- billing ve entitlement'ın gerçek ödeme akışıyla doğrulanması.

### 13-16 hafta: Yatırım veri odası

| Yatırım kapısı | Asgari eşik |
|---|---:|
| Ücretli tasarım ortağı | 3 |
| Yıllık sözleşmeye dönüşen pilot | En az 1 |
| Pilot başarı etkisi | Kanıt/denetim hazırlığında yaklaşık %40 azalma hedefi |
| Pilot → ücretli dönüşüm | Hedef ≥%60; henüz varsayım |
| Kritik kontrol soy zinciri | Hedef ≥%80 |
| Güvenlik | Kritik pentest bulgusu açık değil |
| Onboarding | CFO paketi <1 iş günü; regulated <30 gün |
| Destek yükü | CFO müşterisi <2 saat/ay |
| Pipeline | İsimlendirilmiş, tarihli ve bütçe sahibi bilinen hesaplar |

## 7. Aylık maliyet modeli

### 7.1. Doğru kapasite birimi

1.500-2.000 günlük kullanıcı WARDROOF için çok yüksek bir erken dönem B2B senaryosudur; yaklaşık 45-60 bin aylık aktif oturum kullanıcısına dönüşebilir ve yüzlerce kurumsal müşteriyi ima eder. İlk yatırım aşaması için daha anlamlı senaryolar:

- **Pilot:** 3-10 kurum, 50-150 koltuk;
- **Erken üretim:** 25-75 kurum, 250-1.000 koltuk;
- **Yüksek trafik:** 1.500-2.000 DAU, yoğun dosya/rapor/export kullanımı.

### 7.2. Varsayımlar

- Planlama kuru: **1 USD = 48 TL**; bu güncel kur iddiası değil, bütçe tamponudur.
- Maliyetler KDV/vergi ve kur farkı öncesi yaklaşık planlama aralığıdır.
- Supabase'in 20 Temmuz 2026 resmî fiyatında Pro 25 USD/ay, Team 599 USD/ay; PITR 7 gün 100 USD/ay; log drain tabanı 60 USD/aydır. Kullanım ve kurumsal sözleşme fiyatları değişebilir.
- AI ürünün karar motoru değildir; özet/taslak ve sınıflandırma için sınırlı kullanılır.
- İnsan, hukuk içeriği, pentest, ISO/SOC denetimi ve satış maliyeti altyapı toplamından ayrıdır.

### 7.3. Aylık altyapı bütçesi

| Kalem | Pilot USD | Erken üretim USD | 1.500-2.000 DAU USD |
|---|---:|---:|---:|
| Supabase plan + compute | 75-135 | 659-809 | 709-1.019 |
| PITR, log drain, dış yedek | 120-220 | 180-350 | 250-600 |
| Next.js hosting/CDN | 30-100 | 100-300 | 250-800 |
| Dosya/kanıt storage ve egress | 20-80 | 75-300 | 250-1.000 |
| Gözlemleme, hata ve uptime | 30-150 | 150-500 | 300-1.000 |
| E-posta/bildirim | 15-60 | 50-200 | 150-500 |
| KMS/HSM/TSA/sertifika | 50-300 | 150-600 | 300-1.200 |
| AI kullanım bütçesi | 25-200 | 100-800 | 300-2.000 |
| Güvenlik araçları/WAF/tarama | 50-250 | 200-1.000 | 500-2.000 |
| **Aylık toplam** | **415-1.495** | **1.664-4.859** | **3.009-10.119** |
| **48 TL planlama kuruyla** | **19.920-71.760 TL** | **79.872-233.232 TL** | **144.432-485.712 TL** |

### 7.4. Önerilen bütçe

İlk 3-10 ücretli pilot için **aylık 1.250 USD / yaklaşık 60.000 TL** altyapı tavanı yeterlidir. Erken üretimde kurumsal güven gereksinimleriyle **3.500 USD / yaklaşık 168.000 TL** planlanmalıdır. 1.500-2.000 DAU senaryosunda güvenli merkez bütçe **6.500 USD / yaklaşık 312.000 TL**; stres tavanı yaklaşık **10.000 USD / 480.000 TL** olabilir.

Bu rakamlar personel hariçtir. WARDROOF'ta gerçek maliyet merkezi sunucu değil; regülasyon uzmanı, müşteri implementasyonu, güvenlik/sertifikasyon ve kurumsal satış ekibidir.

### 7.5. Yıllık ve tek seferlik giderler

| Kalem | Yaklaşık planlama aralığı | Not |
|---|---:|---|
| Bağımsız pentest | 10-40 bin USD/yıl | Kapsam ve kurum niteliğine göre teklif gerekir |
| ISO 27001 hazırlık/denetim | 15-60 bin USD | Danışmanlık ve belgelendirme dahil olabilir |
| SOC 2 hazırlık/denetim | 25-100 bin USD+ | Hedef pazara göre ertelenebilir |
| Hukuk/regülasyon uzmanlığı | 3-15 bin USD/ay | Corpus ve güncelleme SLA'sı belirleyici |
| Mesleki/siber sigorta | Teklif gerekli | Ülke, limit ve ciroya bağlı |
| Connector geliştirme/işletim | Kapsama göre | Müşteriye özel iş COGS olarak izlenmeli |

Bu aralıklar piyasa teklifi değildir; bütçe rezervidir. Bağlayıcı karar öncesi en az üç yazılı teklif alınmalıdır.

## 8. Birim ekonomi ve fiyatlama

İç projeksiyondaki fiyat varsayımları:

| Teklif | Yönetim varsayımı |
|---|---:|
| Ücretli regulated pilot | 15-25 bin USD / 10-12 hafta |
| Regulated Growth | 35-60 bin USD/yıl |
| Regulated Enterprise | 80-180 bin USD+/yıl |
| CFO Starter | 299 USD/ay, yıllık faturalama |
| CFO Pro | 749 USD/ay, yıllık faturalama |
| CFO Governance | 1.499 USD/ay, yıllık faturalama |

Bu fiyatlar doğrulanmış müşteri ödeme verisi değildir. İlk yatırım tezi fiyat seviyesine değil şu ekonomiye bağlanmalıdır:

- regulated brüt marj hedefi en az %70;
- CFO paketi brüt marj hedefi en az %80;
- regulated onboarding 30 günden kısa;
- CFO onboarding bir iş gününden kısa;
- CFO aylık destek iki saatten az;
- özel implementasyon ilk yıl ACV'sinin %25'ini aşmamalı;
- connector ve hukuk emeği müşteri bazında COGS olarak ölçülmeli.

Altyapı maliyeti 3.500 USD/ay olduğunda tek bir 55 bin USD ACV regulated müşteri teknik altyapıyı karşılayabilir. Ancak bu, satış, hukuk, destek ve güvenlik kadrosunu karşılamaz. Asıl başa baş hesabı logo sayısından çok katkı marjı ve satış döngüsü belirler.

## 9. Ne eklenirse yatırım yapmak isterim?

Yeni özellik değil, aşağıdaki kanıtlar:

1. **Üç ücretli tasarım ortağı** ve bir yıllık sözleşme.
2. **Tek bir çarpıcı vaka:** denetim/kanıt hazırlama süresinde ölçülmüş düşüş.
3. **İki üretim connector'ı:** örneğin Microsoft Entra + Jira/ServiceNow veya yaygın ERP.
4. **Doğrulanmış hukuk paketi:** kaynak, sürüm, uzman onayı ve değişiklik SLA'sı.
5. **Bağımsız güvenlik kanıtı:** pentest, restore provası, tenant izolasyonu ve olay tatbikatı.
6. **Tekrarlanabilir onboarding:** kurucu olmadan kurulabilen standart paket.
7. **Satın alma kanıtı:** bütçe sahibi, satış döngüsü, win/loss ve ödeme isteği.
8. **Marka ve kategori netliği:** WARDROOF adı altında tek ürün mimarisi.

## 10. Yatırım komitesi kararı

### Bugün

**Karar: yatırım öncesi izleme veya kilometre taşına bağlı küçük pre-seed.** Büyük seed turu için erken. Teknik risk düşündüğümden düşük; pazar ve GTM riski düşündüğümden yüksek.

### Yatırım yapılabilir eşik

- 3 ücretli pilot;
- en az 1 yıllık dönüşüm;
- pilotlarda ölçülmüş zaman/risk tasarrufu;
- kritik güvenlik kapılarının geçilmesi;
- standart fiyat ve kapsam;
- müşteri başına implementasyon saatinin kontrol altında olması;
- en az 10 nitelikli fırsattan oluşan gerçek pipeline.

### Nihai tez

WARDROOF başarılı olursa Türkiye'den çıkan bir “compliance operations system of record” olabilir; yerel regülasyon ve kanıt zinciriyle girip DORA, AI governance ve üçüncü taraf güvencesiyle genişleyebilir. Başarısız olursa sebep büyük olasılıkla teknoloji olmayacaktır: fazla geniş ürün, yavaş kurumsal satış, doğrulanmamış hukuk içeriği ve danışmanlık ağırlıklı teslimat ekonomisi olacaktır.

## 11. Kaynaklar ve belirsizlikler

### Kod ve iç belgeler

- `C:\Users\orhan\KALKAN_OS\AGENTS.md` - mimari, güvenlik ilkeleri ve son doğrulama notları.
- `C:\Users\orhan\KALKAN_OS\docs\DEVAM.md` - canlı durum, açık kararlar ve test kapıları.
- `C:\Users\orhan\KALKAN_OS\docs\ROADMAP.md` - modül kapsamı, kabul kriterleri ve teknik borç.
- `C:\Users\orhan\KALKAN_OS\package.json` - teknoloji yığını ve test komutları.
- `KALKAN_OS_Finansal_Projeksiyon_2027_2031.md` - fiyat ve büyüme varsayımları; gerçekleşmiş metrik değildir.
- `KALKAN_OS_Yatirim_Proje_Dosyasi_2026.md` - yatırım tezi ve risk kaydı; yönetim belgesidir.

### Resmî ve güncel web kaynakları

- [EUR-Lex - DORA Regulation (EU) 2022/2554](https://eur-lex.europa.eu/legal-content/EN/LSU/?uri=CELEX%3A32022R2554)
- [European Commission - AI Act uygulama çerçevesi](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [SPK - Bilgi Sistemleri Bağımsız Denetimi Tanıtım Rehberi](https://spk.gov.tr/kurumlar/bagimsiz-denetim-kuruluslari/bilgi-sistemleri-bagimsiz-denetimi-tanitim-rehberi)
- [Supabase - güncel fiyatlandırma](https://supabase.com/pricing)

### Güven seviyesi ve boşluklar

**Yüksek güven:** Kod kapsamı, mimari ilkeler, test dosyası sayıları, açık teknik kararlar ve resmî regülasyon tarihleri.  
**Orta güven:** Pazar konumu, rakip kümeleri, altyapı bütçe aralıkları ve fiyatlama mantığı.  
**Düşük güven / doğrulanmamış:** Gerçek ödeme isteği, satış süresi, churn, CAC, destek yükü, Türkiye SAM büyüklüğü ve 2027 gelir projeksiyonu.

Çalışma dizini inceleme sırasında kirliydi ve paralel geliştirme sürüyordu. Bu nedenle rapor mevcut repo anlık görüntüsünü değerlendirir; son test sayılarını bağımsız clean commit koşusu olarak yeniden doğrulamaz. Finansal aralıklar yatırım planlama tahminidir; bağlayıcı teklif veya güncel döviz kuru değildir.

---

**Sorumluluk notu:** Bu rapor ürün ve girişim değerlendirmesidir; hukuk, bağımsız denetim veya yatırım tavsiyesi değildir. Regülasyon takvimleri ve sağlayıcı fiyatları değişebilir; sözleşme öncesi resmî güncel kaynaklar ve yazılı teklifler doğrulanmalıdır.
