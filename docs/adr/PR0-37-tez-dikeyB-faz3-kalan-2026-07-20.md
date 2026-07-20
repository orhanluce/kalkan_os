# PR-0 — 37 Tez Dikey B, Faz 3 kalan dilimi: HTTP doğrulaması + UI + CSV/XLSX + Proof Room kablolaması (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz altıncı talimatı. Faz 3'ün ilk diliminde
(§1.62) şema+motor+iki rota şiplendi ama rotalar yalnız typecheck ile
doğrulanmıştı, UI yoktu, serileştirme yoktu, Proof Room rotası
kablolanmamıştı. Bu dilim hepsini kapatır.

## 0. Önce mevcut yapı (kural 7 — INSERT-anı bypass tekrarlanmaz)

Okunanlar: `supabase/migrations/20260720130000_roi_export_runs.sql` (bu
dikeyin kendi guard'ı — zaten `before insert or update`, doğru), `dd8596d`
(paralel oturumun `sod_import_rollbacklari` düzeltmesi — CANLI SUPABASE'E
UYGULANDI Mİ kontrol edildi, aşağıda), `src/app/api/proof-room/route.ts` +
`proof_room_goruntule` RPC'si (test_run_id'ye özgü — bu dilimde roi_export_
run_id dalı EKLENECEK, RPC'nin geri kalanı DOKUNULMADI), `src/lib/
canonical.ts` (`bytesHash` — dosya hash'i İÇİN, `canonicalHash`'ten AYRI,
zaten var, ikinci hash fonksiyonu icat edilmedi).

**Tek oturum disiplini (talimat madde 8):** bu dilimde `spawn_task`/`Agent`/
`Workflow` KULLANILMADI — tek migration sırası, tek push akışı.

## 0b. Bulgu: oturumsuz erişim koruması `proxy.ts`'te, rota'nın kendi 401'i değil

E2E yazılırken keşfedildi: `src/proxy.ts` (Next.js 16'nın middleware'i)
`/api/dora-roi/*` dahil AÇIK_YOLLAR listesinde OLMAYAN her yola oturumsuz
istek geldiğinde `/giris`'e 307 REDIRECT ediyor — rota koduna hiç
ULAŞMIYOR. Yani `POST /api/dora-roi/export`'un kendi `if (!user) return 401`
dalı, tarayıcı-çerezli (ya da çerezsiz) hiçbir gerçek istek için asla
tetiklenmiyor; asıl koruma proxy seviyesinde. Bu YANLIŞ bir güvenlik açığı
DEĞİL (proxy zaten dosyanın kendi yorumunda "gerçek koruma RLS'te" diyor,
proxy yalnız kolaylık) — ama e2e testinin "oturumsuz istek" senaryosu 401
yerine 307+Location:/giris'i doğrulayacak şekilde yazıldı (§1).

## 1. HTTP API doğrulaması — Playwright `page.request` (Chromium e2e ile AYNI dosya)

Bu repoda "gerçek HTTP çağrısı" ile "gerçek Chromium e2e" AYNI mekanizma:
`legal-basis.spec.ts`/`kontrol-test.spec.ts` deseninin aynısı — giriş yapmış
bir Playwright sayfasının `page.request.post(...)` çağrısı gerçek ağ isteği
gönderir, oturum çerezini taşır. İkinci bir HTTP test katmanı (ör. supertest)
İCAT EDİLMEDİ. `e2e/dora-roi-export.spec.ts` tek dosyada: oturumsuz 401,
cross-tenant izolasyon, engelleyici-sorun-varken-onay-reddi, maker-checker
tek-kişi reddi + farklı-kişi kabulü, `denetci_misafir` rolünün reddi
(service_role KULLANILMADIĞININ kanıtı — eğer rota service_role kullansaydı
RLS'i bypass eder, misafir de yazabilirdi), CSV/XLSX indirme + hash
doğrulama, Proof Room linki.

## 2. UI — dar kapsam (talimat kural 10 ruhu)

`/dora-roi` sayfası: "Export Oluştur" butonu → taslak listesi (durum rozeti,
paket_hash kısaltması, engelleyici/uyarı sayısı) → detay: on-kontrol
raporu (blok/uyarı ayrı listelenir, blok varken "Onay Talep Et" DEVRE DIŞI)
→ maker-checker karar UI'ı (talep eden görürse "kendi export'unuzu
onaylayamazsınız" notu, farklı kullanıcı Onayla/Reddet görür) → YAYINLANDI
export'ta CSV/XLSX indirme butonları + Proof Room linki oluştur.

## 3. CSV/XLSX serileştirme — SAF FONKSİYONLAR, kendi minimal XLSX yazıcımız

**Kütüphane kararı:** `xlsx`/`exceljs` gibi yeni bir çalışma-zamanı
bağımlılığı EKLENMEDİ. XLSX (OOXML) formatı bir ZIP arşividir; repo
ZATEN `jszip`'e sahip (M11 ZIP paketleri). `src/lib/xlsx-writer.ts` minimal,
stilsiz, inline-string hücreli bir OOXML yazıcı — `canonical.ts`'in "neden
kütüphane değil" gerekçesinin AYNISI: bağımsız bir denetçinin dosyayı
Excel/LibreOffice'te açabilmesi ECMA-376'nın minimal geçerli alt kümesine
uymakla sağlanıyor, üçüncü bir paketin lisans/bakım riskine gerek yok.

**Deterministik kolon sırası:** her şablon için SABİT, elle yazılmış kolon
listesi (nesne anahtarı sırasına GÜVENİLMEDİ, ileride bir alan eklenip
sırası değişirse sessizce bozulmasın diye). **Aynı `paket` girdisi HER ZAMAN
aynı CSV/XLSX baytını üretir** (birim testle kanıtlı, iki ayrı çağrı byte-
byte karşılaştırılıyor).

**Dosya hash'i `paket_hash`'ten AYRI:** `paket_hash` JSON snapshot'ın RFC
8785 hash'i; `dosyaHash` (`bytesHash`, `canonical.ts`) SERİLEŞTİRİLMİŞ
BAYTLARIN hash'i — biri "veri doğru mu", diğeri "bu dosya bozulmadı mı"
sorusuna cevap verir (kural 15: bir hash'in NEYİ doğruladığı adında yazar).

## 4. İndirme kapısı — BLOKE, uyarılı-indirme YOK (kesin karar)

Kurucu iki seçenek sunmuştu: "engelleyici sorun varsa indirme engellenebilir
VEYA kurucu kararıyla uyarılı indirme yapılabilir." **Karar: SADECE
BLOKE, uyarılı-indirme-ile-devam YOK.** Gerekçe: bu dosya bir denetçiye/
regülatöre gidebilir; "uyarıyı geç" tıklaması insan hatasına açık bir kapı
bırakır, ürünün "uydurulmamış, doğrulanmış veri" iddiasını zayıflatır.
**Bu kısıt zaten YAPISAL OLARAK sağlanıyor, ayrı bir kontrol GEREKMİYOR:**
indirme yalnız `durum='YAYINLANDI'` olan export'lar için açılıyor;
`YAYINLANDI`'ya ulaşmak `ONAY_TALEP_EDILDI` üzerinden geçer, o geçiş de
guard tarafından `engelleyici_sorun_sayisi = 0` şartına BAĞLANMIŞ zaten
(20260720130000). Yani "blok varken YAYINLANDI export'u olamaz" — indirme
rotası yalnız durum kontrolü yapar, sorun sayısını AYRICA kontrol etmesi
gerekmez (guard bunu INSERT/UPDATE anında zaten garanti ediyor).

**VERIFIED olmayan ICT kodu kesin ifade olarak GÖSTERİLEMEZ — bu da
İNŞA GEREĞİ sağlanıyor:** `HIZMET_TURU_DOGRULANMAMIS` bir BLOK sorunu
(§1, Faz 3 ilk dilim); bloke varken export YAYINLANDI olamaz; dolayısıyla
YAYINLANDI bir export'taki HER dolu `ict_hizmet_turu_kod` alanı zaten
VERIFIED bir kayda işaret eder (ya da alan boştur — eksik veri, YANLIŞ veri
değil). Ayrıca CSV/XLSX çıktısının başına/altına açık bir uyarı satırı
eklenir: *"Bu dosyadaki tüm alanlar YAYINLANDI anındaki doğrulama durumunu
yansıtır; KALKAN_OS bu içeriğin resmi RoI şemasına TAM UYGUNLUĞUNU İDDİA
ETMEZ — nihai sorumluluk kurumun hukuk/uyum fonksiyonundadır."*

## 5. Proof Room kablolaması

`proof_room_goruntule(p_token)` RPC'si `roi_export_run_id` dalı EKLENEREK
genişletildi (test_run_id dalı DOKUNULMADI): token → link → (eğer roi_
export_run_id doluysa) `roi_export_runs` satırını `durum='YAYINLANDI'`
şartıyla okur, `paket`+`paket_hash`+`on_kontrol_raporu` döner (kanıt/
kaynak/iddia bağlantısı: `on_kontrol_raporu` zaten hangi alanların hangi
kaynağa dayandığını taşıyor — Dikey C'nin `assurance_claims`'iyle DOĞRUDAN
bağ bu dilimde KURULMADI, sonraki faz). Süre/iptal/tenant sınırı `proof_
room_links`'in KENDİ mevcut alanlarıyla (son_gecerlilik/iptal_edildi/
tenant_id) zaten sağlanıyor — yeni alan gerekmedi.

## 6. Kapsam dışı (bu dilimde YOK)

Kanıt zincirinin `assurance_claims`/`obligations`'a tam bağlanması (Faz 4),
B_01.02/03 ve diğer kapsanmayan şablonlar, çoklu-dil/yerelleştirme,
XLSX stilleme (renk/format — yalnız ham veri).
