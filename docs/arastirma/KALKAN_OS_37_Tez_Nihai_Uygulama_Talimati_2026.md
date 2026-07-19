# CLAUDE CODE — KALKAN_OS 37 Tez Nihai Uygulama Talimatı

## 0. Mandat ve çalışma biçimi

Bu dosya, mevcut KALKAN_OS canlı ürün durumunu ve `KALKAN_OS_37_TEZ_NIHAI_URUN_VE_ARGE_RAPORU_2026.md` içindeki ürünleştirilebilir bütün önerileri tek uygulama talimatında birleştirir.

Yalnız **KALKAN_OS** üzerinde çalış. Finanskor bu talimatın kapsamı dışındadır; iki ürün için ortak veritabanı, ortak tenant, örtülü veri akışı veya Finanskor modülü oluşturma.

Amaç bir defada çok sayıda yarım modül çıkarmak değildir. Aşağıdaki sırayı koruyarak **küçük, uçtan uca, canlıda doğrulanmış dikeyler** teslim et. Her dikey migration → RLS/DB invariant → servis/RPC → dar UI → gerçek Chromium e2e → tam birim/e2e/build → commit → push → deploy health hattından geçmeden sonraki dikeye geçme.

Mevcut repo gerçekleri bu talimattan üstündür. Önce kodu, migration'ları, `ROADMAP`, ADR'leri ve `DEVAM`/handoff dosyasını oku; var olan bir mekanizmayı ikinci kez kurma. Modül numaralarını değiştirme. Yeni ihtiyaçları mevcut modüllere eşleştir; karşılığı yoksa ancak o zaman yeni roadmap taşı/ADR öner.

## 1. Değiştirilemez başlangıç durumu

Son doğrulanmış teslimat:

- **M35 §1.54 vendor-portal dış erişim shipped.**
- `matter_access_grants` / `matter_goruntule` deseni tedarikçi grafına yeniden kullanıldı.
- Admin/uyum, tedarikçi kaydı için 14 günlük, süreli ve iptal edilebilir token üretebiliyor.
- Tedarikçi `/tedarikci-erisim/[token]` üzerinden oturumsuz olarak kendi kritiklik/karar durumunu, son değerlendirmeyi ve `KAPANDI` olmayan bulguları görüyor.
- İç alanlar, sahip ve kapanış kanıtı dışarı sızmıyor.
- Her görüntüleme aktörsüz audit kaydı oluşturuyor; token audit'e yazılmıyor.
- Regülatör bağlamına özgü bağımsızlık beyanı tedarikçi portalına uydurulmadı.
- 8 RLS/RPC testi, canlı Supabase smoke ve gerçek Chromium misafir-context e2e geçti.
- Tam taban: **1098 birim / 110 dosya + 60 e2e, 0 skip, 0 flake; build yeşil.**
- Ürün commit'i `c894ac5`, DEVAM commit'i `7aa6dc0`; push edildi, deploy sağlıklı.

Bu dikeyi yeniden yazma veya farklı token mekanizmasına taşıma. Geriye uyumluluğu bozma. Test sayıları taban olarak kabul edilir; yeni teslimatta sayıların azalması, skip veya flake kabul edilmez.

## 2. Ürün tezi ve değişmez sınırlar

KALKAN_OS bir kontrol listesi veya doküman deposu değildir. Şu zinciri yöneten güvence işletim sistemidir:

`resmî kaynak → hüküm → uygulanabilirlik → kritik hizmet/varlık/risk → politika/kontrol → test → kanıt → bulgu/istisna → iyileştirme`

Değişmez kurallar:

1. **“Tam uyum garantisi” üretme.** Sistem doğrulanmış kapsamı, kaynağı, sürümü, uygulanabilirlik kararını, kontrol/test durumunu ve kanıt seviyesini gösterir.
2. Tez, çalışma notu, AI çıkarımı veya ikincil kaynak doğrudan `VERIFIED`/bağlayıcı doğamaz. Varsayılan `DOĞRULANMADI`/`TASLAK`; ayrı hukuk doğrulayıcı yetkisi ve audit izi gerekir.
3. Mevzuat eşiklerini, bildirim sürelerini, risk sınıflarını veya kontrol içeriklerini koda uydurarak sabitleme. Doğrulanmış, sürümlü kural verisinden oku.
4. Tenant izolasyonu, RLS, dört-göz, SoD, append-only/audit ve veri minimizasyonu uygulama kodunun iyi niyetine bırakılmaz; mümkün olan invariant DB katmanında uygulanır.
5. `service_role` kullanıcı istek yolunda kullanılmaz. Security-definer RPC dar kapsamlı, sabit `search_path`, tenant guard ve yetki kontrolüne sahip olmalıdır.
6. Ham PII, finansal veri, gizli model/prompt, kanıt içeriği veya tedarikçi iç sırrı blokzincire/SCITT'ye/loga/token'a yazılmaz. Yalnız digest, sürüm, durum ve asgari makbuz.
7. XAI grafiği adalet, nedensellik veya hukuki açıklamanın kendisi değildir.
8. Harici haber, sosyal medya, AML/fraud veya tehdit sinyali hüküm/suç isnadı/otomatik yaptırım değildir; kaynaklı gözlem ve inceleme tetikleyicisidir.
9. FHE/SMPC/TEE/VC/ZKP MVP zorunluluğu değildir. Önce tehdit modeli ve iş ihtiyacı, sonra dar pilot.
10. Hostinger yalnız desteklediği uygulama/deploy katmanı için; kalıcı ilişkisel veri, RLS, auth ve migration gerçeği mevcut Supabase/Postgres mimarisinde kalır. Mevcut deploy desenini değiştirme.

## 3. Önce dokümantasyon ve boşluk eşleştirmesi

Koddan önce tek bir repo-içi **37 Tez Gap Map** oluştur veya mevcut araştırma/roadmap dosyasına ekle. Aşağıdaki yeteneklerin her biri için:

- mevcut modül/gate ve dosyalar;
- `TAM`, `KISMİ`, `YOK`, `DIŞ KARAR`, `KAYNAK BEKLİYOR` durumu;
- eksik kullanıcı sonucu;
- gerekli şema/RLS/invariant;
- mevzuat veya tez kaynak statüsü;
- önerilen tek dikey;
- kabul testi

yazılmalıdır.

Numara uydurma veya mevcut taşları yeniden numaralandırma. KOS başlıkları ürün kabiliyeti adıdır; otomatik olarak yeni `Mxx` numarası değildir.

Kapsanacak yetenekler:

1. KOS-1 Regülasyon ve uygulanabilirlik grafiği;
2. KOS-2 Kritik hizmet ve dayanıklılık grafiği;
3. KOS-3 Kontrol/test/kanıt motoru;
4. KOS-4 Kurumsal yönetişim ve politika yaşam döngüsü;
5. KOS-5 AI Assurance ve AI Act motoru;
6. KOS-6 Açıklama, adalet ve itiraz;
7. KOS-7 Model Claim Guard ve Eval Sicili;
8. KOS-8 Üçüncü taraf, bulut ve AI tedarik zinciri;
9. KOS-9 Harici sinyal, tehdit, fraud ve AML güvencesi;
10. KOS-10 AI/ESG fayda iddiası güvencesi;
11. KOS-11 Mahremiyet-koruyucu hesaplama laboratuvarı.

Gap Map'ten sonra `ROADMAP`'i yalnız gerçek boşluklarla güncelle. Bir özellik mevcutsa yeniden planlama; gerekiyorsa yalnız kapatma dilimini yaz.

## 4. Uygulama sırası

### Dikey A — M35 tedarikçi portalında anket yanıtlama

Bu talimattaki **sıradaki tek kod dikeyi budur**. Mevcut salt-okur vendor portal erişimini bozma; aynı grant/token/audit desenini genişlet.

#### Kullanıcı sonucu

Yetkili tedarikçi, süreli oturumsuz bağlantıyla yalnız kendisine atanmış ve yayımlanmış anketi görür; taslak cevap kaydedebilir; dosya/kanıt ekleyebilir; açıkça gönderir. Kurum tarafı cevabı inceleyebilir, ek bilgi isteyebilir, kabul/reddedebilir. Tedarikçi başka tenant/tedarikçi/anket/bulgu/kanıt göremez.

#### Önce sözleşme ve durum makinesi

Repo adlandırmasına uyarlayarak şu durumları değerlendir:

`DRAFT → SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED → RESUBMITTED → ACCEPTED | REJECTED | EXPIRED`

Mevcut state machine varsa onu kullan. Geçişleri serbest `UPDATE` ile değil RPC/DB guard ile koru.

Asgari invariant'lar:

- Yalnız grant kapsamındaki tedarikçi ve yayımlanmış şablon/sürüm görünür.
- Token hash'i saklanır; düz token DB/audit/log/analytics'e yazılmaz.
- Geçersiz, iptal edilmiş, süresi dolmuş ve yanlış kapsamlı token aynı dış yanıt davranışına sahip olur; ayrım bilgisi sızdırmaz.
- `SUBMITTED` cevap tedarikçi tarafından sessizce değiştirilemez. Değişiklik talebi yeni revizyon oluşturur; geçmiş append-only korunur.
- Kurum inceleyicisi tedarikçi adına cevap üretemez; override ayrı yetki, gerekçe ve audit ister.
- Kabul edilen cevap otomatik olarak kontrolü `PASSED`, tedarikçiyi “uyumlu” veya bulguyu kapalı yapmaz. Cevap/kanıt bir gözlemdir; M12 test/kontrol mekanizması ayrıca değerlendirir.
- Dosya kanıtlarında MIME/uzantı/boyut kontrolü, formula/malware riski için mevcut upload karantina/deseni, hash ve tenant path'i kullanılır. Mevcut dosya mekanizması yoksa bu dilimde geniş platform icat etme; yalnız güvenli desteklenen türleri veya metin/URL kanıtını seç ve borcu açık yaz.
- PII ve sır alanları için açık uyarı/veri minimizasyonu; iç alanlar dış payload'da yok.
- Her görüntüleme, taslak kaydı, gönderim, revizyon ve inceleme kararı audit olur; token ve cevap sırrı audit'e girmez.
- Şablon kopyası sürüm pinlidir; yayımlanmış anket sonradan değişse bile gönderilmiş cevabın anlamı değişmez.
- Idempotency ve eşzamanlı gönderim korunur; çift submit çift kayıt/olay oluşturmaz.
- Bildirim gerekiyorsa transactional outbox kullan; gönderim başarısız diye iş işlemi geri alınmaz ve sahte “bildirildi” gösterilmez.

#### UI

- Mevcut `/tedarikci-erisim/[token]` sayfasını aynı görsel dilde genişlet.
- Mobil/masaüstü, klavye ve ekran okuyucu erişilebilirliği.
- Otomatik kaydetme varsa son kaydedilme ve hata durumu görünür; sessiz veri kaybı yok.
- Zorunlu/opsiyonel soru, açıklama, izin verilen kanıt ve karakter sınırı açık.
- Gönderim öncesi özet + açık onay; gönderim sonrası değiştirilemez revizyon ve makbuz.
- Kurum ekranında cevap, kanıt hash'i, sürüm, zaman, inceleyici ve karar gerekçesi; kabul cevabı kontrol sonucu gibi renklendirilmez.

#### Test kapısı

- RLS/RPC: cross-tenant, cross-vendor, cross-questionnaire, expired/revoked/invalid token, taslak/yayımlanmış şablon, geçiş guard, revision immutability, audit minimization.
- Birim: normalize/validation, state transition, idempotency, version pinning.
- Canlı Supabase smoke: geçerli tokenla kaydet/gönder; iptal ve süre dolumu; audit; ikinci submit.
- Gerçek Chromium e2e, en az iki context: kurum davet açar → misafir tedarikçi cevaplar/gönderir → kurum inceler/değişiklik ister → tedarikçi revizyon gönderir → farklı kurum/tedarikçi göremez.
- Mevcut 1098+60 tabanı gerilemez; 0 skip, 0 flake, build exit 0.

Bu dikey tamamlanmadan DORA RoI RTS veya başka büyük alana geçme.

### Dikey B — M35 resmî DORA Register of Information (RoI) uyumu

Dikey A kapandıktan sonra başla. Önce güncel ve resmî AB kaynaklarını repo araştırma alanına al; bağlayıcı şema/sürüm/doğrulama durumunu kaydet. Tez veya blogdan RoI alanı uydurma.

Teslim sonucu:

- mevcut tedarikçi/hizmet/sözleşme/alt yüklenici/veri lokasyonu kayıtlarını resmî RoI kavramlarına mapping;
- kaynak sürümlü şema ve doğrulama kuralları;
- eksik/çelişkili alan raporu;
- snapshot ve delta üretimi;
- makinece doğrulanabilir export;
- export manifesti, hash, imza ve kanıt zinciri;
- import değilse bile kaynak kayda geri izlenebilirlik;
- tenant RLS ve dört-göz yayın/onay;
- resmî şema değişince impact queue.

Bir alan mevcut modelde yoksa önce mapping/ADR; migration'ı gerekçesiz büyütme. “DORA uyumlu” ancak doğrulanmış şema sürümü ve zorunlu validasyonlar geçtiğinde gösterilir.

### Dikey C — KOS-7 Model Claim Guard v1

Mevcut M37 eval ve veri-soyağacını yeniden kullan. Yeni paralel AI test motoru kurma.

Asgari manifest:

- amaç, hedef değişken ve izin verilen iddia;
- veri kaynağı/lisans/zaman;
- train/validation/test ayrımı;
- preprocessing'in fold kapsamı;
- eksik ve sentetik veri işlemleri/oranı;
- baz model ve ablation;
- sınıf/segment/alt grup metrikleri;
- kalibrasyon ve belirsizlik;
- dış dönem/dış kurum doğrulaması;
- model/açıklama sürümü;
- üretim kapısı ve rollback kriteri.

V1 otomatik guard'ları:

1. Zaman/look-ahead sızıntısı;
2. SMOTE/oversampling'in split öncesi uygulanması;
3. Sentetik verinin gerçek dış test gibi sunulması;
4. Tek dönem/tek varlıktan kapsam aşımı;
5. İddia ile hedef/metrik uyumsuzluğu;
6. Tablo–metin sonuç çelişkisi;
7. Hipotez reddedildiği halde olumlu ürün iddiası;
8. İkincil kaynak rakamının benchmark yapılması;
9. Imputation/merge sonrası açıklanamayan satır sayısı;
10. Benzer toplam doğruluk altında örnek-bazlı karar farkı;
11. XAI çıktısının adalet/hukuki yeterlilik diye sunulması.

Guard sonucu `PASSED | FAILED | UNKNOWN | NOT_APPLICABLE` olmalı. `UNKNOWN`, `FAILED` değildir; ikisi de sahte güven üretmez. Üretim doğrulaması için zorunlu guard listesi sürümlü politika olmalı. Override ayrı yetki, gerekçe, süre ve audit ister.

### Dikey D — KOS-6 açıklama, adalet ve itiraz paketi

Mevcut AI olay/eval ve policy mekanizmalarıyla bağla.

Üç ayrı artefakt:

- teknik denetçi açıklaması: veri/model/prompt/sürüm, katkı, sadakat ve sınırlılık;
- iş sahibi özeti: amaç, risk, güven, anomali ve insan kararı;
- etkilenen kişi gerekçesi: somut ana etkenler, veri düzeltme, itiraz ve insan inceleme.

`ExplanationBundle` en az katkı, güven, zaman davranışı, veri kalitesi, anomali, risk ve açıklayıcı sürümü taşımalı. Karşı-olgusal açıklama “sonucu garanti eder” dili kullanmamalı ve model gaming'ine yol açacak hassas eşik sızdırmamalı.

Adalet kontrolleri: hassas grup ve proxy taraması, segment/alt grup performansı, eşik etkisi, yanlış pozitif/negatif, intersectional örneklem yeterliliği. Yetersiz örneklemde sonuç `UNKNOWN` olur. İtiraz; başvuru, SLA, veri düzeltme, bağımsız insan incelemesi, karar ve yeniden değerlendirme kanıtını kapsar.

SFIX/S-SFIX akademik çerçevesini doğrudan kopyalama. Önce bağımsız replikasyon, veri sızıntısı, açıklama sadakati/istikrarı ve lisans/IP ADR'si. Bu aşamada sağlayıcıdan bağımsız `ExplanationAdapter` sözleşmesi yeterlidir.

### Dikey E — KOS-5 AI Assurance kapsam tamamlama

Gap Map'e göre eksik kalanları kapat:

- AI kullanım envanteri;
- provider/deployer/importer/distributor rolü;
- amaç ve yasak kullanım;
- risk sınıfı ve doğrulanmış kural sürümü;
- etkilenen kişiler ve FRIA/DPIA bağı;
- veri/model/prompt soyağacı;
- insan gözetimi, override ve kill-switch;
- drift/performance/fairness eval;
- ciddi olay ve bildirim saati;
- geri alma/kapatma ve veri saklama planı;
- AI Governance Board/model forumu gündem, karar, muhalefet ve aksiyon kanıtı.

AI yönetişim kurulu kaydı yalnız toplantı notu değildir: ilgili model/risk/eval/hüküm/aksiyon grafına bağlanmalıdır. Tedarik AI sözleşmelerinde veri kullanımı, model değişikliği, alt sağlayıcı, açıklama, olay bildirimi, denetim ve çıkış şartlarını KOS-8'e bağla.

### Dikey F — KOS-1 regülasyon/source-to-proof kapatma

Mevcut regülasyon grafiği ve Proof Room'u kullan. Her doğrulanmış iddia için şu tam zinciri enforce et:

`official source/version → provision → applicability decision → control/policy → latest valid test → evidence digest → proof receipt`

Kaynak sürümü veya yürürlük değişince:

- ilgili uygulanabilirlik kararları;
- politikalar;
- kontroller/testler;
- proof paketleri

`IMPACT_REVIEW_REQUIRED` benzeri mevcut duruma düşmeli; eski kanıt silinmemeli, tarihsel olarak kalmalı. Proof Room güncel/geçmiş durumu ayırmalı ve “kanıt var” ile “kontrol geçti”yi karıştırmamalıdır.

### Dikey G — KOS-2 dayanıklılık ve bağımlılık grafiği

Mevcut M13 kritik hizmet ve M14 kapsam motorunu genişlet; paralel envanter kurma. Kritik hizmet → süreç → varlık → uygulama/al altyapı → veri → kişi/tesis → tedarikçi → kontrol/test ilişkisini oluştur.

Kullanıcı sonucu:

- tek hata noktaları;
- tedarikçi/teknoloji yoğunlaşması;
- zincirleme etki;
- RTO/RPO ve gerçek test farkı;
- kapasite/kurtarma senaryosu;
- hangi yasal hüküm ve kontrolün etkilendiği.

#### Dikey 5'in 29 alt kategorisi hakkında kesin kural

Kaynak tez/çerçeve repo'da yoksa 29 kategori içeriğini **uydurma ve seed etme**. Yalnız kategori/taksonomi veri modelinin sürümlü, kaynaklı ve doğrulama statülü olmasını tasarla; backlog'u `KAYNAK_BEKLİYOR` bırak. Kaynak sağlanınca hukuk/uzman doğrulamasıyla import edilir.

### Dikey H — KOS-8 bulut, üçüncü taraf ve çıkış güvencesi

M35'i genişlet:

- bulut hizmet envanteri ve ortak sorumluluk matrisi;
- sözleşme/SLA/güvenlik maddeleri;
- alt yüklenici zinciri ve veri lokasyonu;
- IAM, merkezi log, olay bildirim süresi;
- yedekleme/kurtarma ve güvenli imha;
- hizmetten çıkış/portabilite planı;
- DDoS/kapasite/periyodik dayanıklılık testi;
- sözleşme bitiş ve veri imha kanıtı;
- açık kritik bulgu altında sign-off guard'ı.

Vendor portal dış payload'ı veri minimizasyonuyla koru. Tedarikçi cevabı veya self-attestation doğrulanmış kontrol sonucu değildir.

### Dikey I — KOS-9 harici sinyal ve model güvencesi

Harici haber, sosyal medya, tehdit ve fraud/AML sinyali için ortak `ExternalObservation` sözleşmesi oluştur veya mevcut modeli genişlet:

- kaynak/URL/lisans ve güven derecesi;
- olay, yayın ve alım zamanı;
- içerik hash'i ve dönüşüm soyağacı;
- kurum/kişi eşleştirme güveni;
- model/sürüm ve insan doğrulaması;
- çelişkili kaynak ve düzeltme/itiraz;
- saklama ve PII minimizasyonu.

Bu sinyaller bulgu veya inceleme üretebilir; otomatik suç isnadı, yaptırım veya uyumsuzluk kararı veremez.

### Dikey J — KOS-10 AI/ESG fayda iddiası güvencesi

“AI ile emisyon/enerji/maliyet azaldı” veya benzeri iddialar için:

- baz çizgi ve karşılaştırma dönemi;
- organizasyonel/operasyonel kapsam;
- ölçüm yöntemi ve veri kaynağı;
- belirsizlik ve önemli varsayımlar;
- AI dışı etkenler;
- bağımsız onay ve kanıt;
- iddia metni–bulgu eşleşmesi

zorunlu olsun. Salt AI edinimi veya kullanım yoğunluğu başarı kanıtı değildir. Desteklenmeyen aracılık iddiası Claim Guard tarafından engellenmelidir.

### Dikey K — KOS-11 mahremiyet-koruyucu hesaplama laboratuvarı

Bu aşama yalnız önceki P0/P1 kapıları kapandıktan ve gerçek iş ihtiyacı seçildikten sonra başlar. Önce ADR ve benchmark harness; genel platform veya kripto pazarlama özelliği yapma.

Tek dar pilot için karşılaştır:

- imzalı/minimize kanıt özeti;
- TEE;
- gerekiyorsa SMPC/FHE.

Her koşu için:

- tehdit modeli ve amaç;
- şema/algoritma/parametre sürümü;
- anahtar sahibi, saklama ve rotasyon;
- model/input/output digest'i;
- açık–korumalı çıkarım karar eşdeğerliği;
- doğruluk/alt grup farkı;
- gecikme, maliyet ve hata bütçesi;
- başarısızlık/rollback;
- imzalı koşu makbuzu.

FHE tezlerindeki saniyeler düzeyindeki gecikmeyi ve küçük veri seti sınırlılığını açık göster. “Şifreli olduğu için güvenli/uyumlu” sonucu üretme. VC/ZKP yalnız seçici ifşa ihtiyacı kanıtlanırsa ayrı ADR'dir.

## 5. Kalan mevcut backlog ile ilişki

Claude'un bildirdiği mevcut borçlar kaybolmamalıdır:

- M36, M37, M38 ve M13 “sonraki dilim” notlarını Gap Map'te ilgili KOS kabiliyetine bağla.
- Mevcut iş bitmişse yeniden açma; yalnız eksik kullanıcı sonucunu tanımla.
- M35 vendor questionnaire Dikey A'dır.
- M35 DORA RoI Dikey B'dir ve yalnız resmî şema doğrulamasıyla yapılır.
- Dikey 5'in 29 alt kategorisi kaynak yoksa `KAYNAK_BEKLİYOR` kalır.
- KMS, TSA, AI sağlayıcısı, dış connector veya hukuk doğrulayıcı gibi kurucu kararlarını uydurma; adapter/`OPEN_DECISION` ve güvenli yerel/non-qualified davranışla sınırla.

## 6. Ortak veri, güvenlik ve operasyon standardı

Her yeni tablo/nesne:

- `tenant_id`, uygun sahiplik ve RLS;
- oluşturma/güncelleme aktörü ve zaman;
- gerekirse sürüm, kaynak ve doğrulama statüsü;
- soft-retire/history yaklaşımı;
- audit ve veri minimizasyonu;
- idempotency/eşzamanlılık davranışı

taşımalıdır.

Her dış token:

- en az 256 bit entropy;
- yalnız hash saklama;
- süre, iptal, kapsam ve kullanım audit'i;
- aynı hata/null davranışı;
- referer/cache/indexing/log sızıntısı önlemi;
- asgari payload

şartlarını sağlamalıdır.

Her domain olayı transactional outbox üzerinden atomik yazılmalı. Worker claim race-safe, retry idempotent, poison event izole olmalı. Dış servis başarısı kanıtlanmadan `SENT/ANCHORED/NOTIFIED` gösterme.

Her migration PGlite/yerel test uyumluluğu ve canlı Supabase davranışıyla sınanmalıdır. `pg_cron` yalnız mevcut mimari ve canlı eklentiyle uyumlu, idempotent SQL fonksiyonlarında kullanılabilir. Hostinger deploy sağlık kontrolü ve Supabase migration/smoke her dikeyin kapanışındadır.

## 7. UI standardı

Mevcut tasarım sistemini kullan; ikinci UI sistemi kurma. Tüm yeni ekranlar:

- responsive;
- dark/light uyumlu;
- klavye erişilebilir;
- doğru label/focus/error state;
- yükleniyor/boş/hata/yetkisiz/dolmuş/ip­tal durumları;
- durum ile kanıt seviyesini ayıran rozetler;
- kullanıcıya sahte kesinlik vermeyen açıklama

taşımalıdır.

AI sonucu her yerde “öneri/gözlem” olarak işaretlenmeli; kaynak, sürüm, güven/sınırlılık ve insan onayı görünmelidir. `UNKNOWN`, başarısız veya başarılı gibi renklendirilmez.

## 8. Test ve teslim kapısı

Her dikeyde:

1. Saf/deterministik iş kuralları için birim testleri;
2. PGlite migration + RLS/RPC/adversarial testleri;
3. Cross-tenant, rol, token, süre, iptal ve minimizasyon testleri;
4. Canlı Supabase smoke;
5. Gerçek Chromium e2e; dış kullanıcı varsa ayrı browser context;
6. Tam test tabanı ve build;
7. 0 skip, 0 flake;
8. Commit + push + deploy health;
9. `ROADMAP` ve `DEVAM` güncellemesi.

Test yalnız happy path olamaz. Özellikle negatif invariant, yarış durumu, double-submit, eski sürüm, stale token, cross-tenant ve audit sızıntısı doğrulanmalıdır.

Mevcut taban **1098 birim + 60 e2e** altına düşemez. Test sayısı artabilir; mevcut test silme/gevşetme veya skip ile yeşil yapılmaz. Altyapı hatası ile ürün assert hatasını ayrı raporla.

## 9. Her dikey sonrası zorunlu §15 raporu

Her dikey sonunda yalnız şu formatta rapor ver:

1. **PR/Gate ve dikey adı**
2. **Teslim edilen kullanıcı sonucu**
3. **Değişen ana dosyalar**
4. **Migration/RLS/RPC**
5. **Güvenlik ve iş invariant'ları**
6. **Veri minimizasyonu ve audit**
7. **Birim/RLS/e2e/build sayıları; skip/flake**
8. **Canlı Supabase smoke sonucu**
9. **Commit/push/deploy health**
10. **ROADMAP/DEVAM güncellemesi**
11. **Bilinçli kapsam dışı ve borç**
12. **Açık kurucu/hukuk/KMS/TSA/sağlayıcı kararı**
13. **Bir sonraki tek dikey**
14. **Geriye uyumluluk ve mevcut taban etkisi**
15. **Dürüst kapanış:** tamamlandı / kısmi / blokeli

“Bitti” deme şartı: migration canlıda, smoke ve gerçek Chromium e2e geçmiş, tam test/build yeşil, commit push edilmiş ve deploy sağlıklı olmalıdır.

## 10. Şimdi yapılacak

Önce repo durumunu ve Gap Map'i hazırla. Ardından yalnız **Dikey A — M35 tedarikçi portalında anket yanıtlama** dikeyini uçtan uca tamamla. Dikey A'nın §15 raporunu vermeden Dikey B'ye başlama.

Kaynak, resmî şema veya kurucu kararı eksikse veri/kural uydurma. Güvenli adapter, `OPEN_DECISION` veya `KAYNAK_BEKLİYOR` kaydıyla dur; diğer bağımsız işleri tamamla ve blokajı §15 raporunda açıkça belirt.
