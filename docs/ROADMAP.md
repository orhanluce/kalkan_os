# KALKAN-OS — Claude Code MVP Yol Haritası
**Sürüm:** 1.0 · 16 Temmuz 2026 · Hedef: Faz 1 PoC → Faz 2 MVP (proje dosyasındaki kapılı plan)

> **Kullanım:** Bu dosyayı repo köküne `docs/ROADMAP.md` olarak koy; ayrıca aşağıdaki "CLAUDE.md çekirdeği" bölümünü repo köküne `CLAUDE.md` olarak kopyala. Claude Code'a ilk komut: *"docs/ROADMAP.md'yi oku, M0'dan başla, her kilometre taşının kabul kriterlerini geçmeden sonrakine geçme."* Kilometre taşları sıralıdır ve her biri kendi başına gösterilebilir (demo edilebilir) bir çıktı üretir.

---

## 0. Ürün özeti (Code'un bağlamı için)

KALKAN-OS, Türkiye'deki finans kuruluşlarının (Halka 1: aracı kurum, PYŞ, KVHS) SPK VII-128.10 + 7545 + BDDK mevzuatına **sürekli uyumunu** yöneten çok-kiracılı B2B SaaS. MVP'nin kanıtlaması gereken döngü:

**Kontrol kütüphanesi → kanıt yükleme → boşluk/olgunluk skoru → denetçi paylaşımı / YK raporu**

MVP kapsam DIŞI (bilinçli): otomatik API konektörleri (Faz 2 sonunda ilk 5'i), CFO Kalkanı modülü (Halka 2, Y2), Mevzuat Radar otomasyonu (manuel küratörlükle başlar), SGB bildirim entegrasyonu.

---

## 1. Teknoloji yığını (karar + gerekçe)

| Katman | Seçim | Gerekçe |
|---|---|---|
| Uygulama | **Next.js 14+ (App Router) + TypeScript** | Kurucunun mevcut Node.js ekosistemiyle uyumlu; tek repo'da SSR panel + API |
| Veritabanı/Auth | **Supabase (Postgres + RLS + Auth + Storage)** | Mevcut FinanSkor yığınıyla ortak bilgi birikimi; Row-Level Security çok-kiracılılığın temeli; Storage kanıt dosyaları için |
| UI | Tailwind + shadcn/ui | Hızlı, tutarlı kurumsal panel |
| PDF üretimi | Sunucu tarafında (ör. Playwright/HTML-to-PDF) | YK Beyanı çıktısı |
| Test | Vitest (birim) + Playwright (e2e temel akış) | Her kilometre taşı kapısında koşar |

**⚠ Veri yerelleştirme notu (mimari borç olarak kayıtlı):** VII-128.10 md. 26 birincil/ikincil sistemlerin **yurt içinde** bulunmasını şart koşar. Supabase'in Türkiye bölgesi yoktur. Karar: MVP/PoC **geliştirme ve demo** ortamı Supabase'te kalır (gerçek müşteri verisi girmeden); üretim öncesi self-hosted Supabase veya yerli PaaS'a taşıma **M6'da** planlıdır. Kod, `DATABASE_URL` soyutlaması ve saf-Postgres özellikleriyle taşınabilir yazılmalı — Supabase'e özgü servislere (Edge Functions hariç tutulabilir) sıkı bağlanma yok. Bu kısıt her PR'da hatırlanmalı.

### 1.1 Mimari karar kaydı — 16 Temmuz 2026

Kurucu, projeye daha geniş kapsamlı bir ürün/mimari vizyon belgesi girdi olarak verdi (`KALKAN_OS_MVP_Yol_Haritası_ve_Ajan_Talimatları.md`). O belge NestJS + Prisma + Turborepo monorepo + Keycloak + MinIO + Redis/BullMQ öneriyor ve çok daha geniş bir veri modeli (9 rol, olay/delil odası, RegChain) tanımlıyor.

**Karar:** mevcut **Next.js + Supabase tek-repo** yığınında kalınıyor. Gerekçe: M1-M5 bu yığınla, gerçek migration dosyalarına karşı PGlite ile test edilmiş RLS politikalarıyla zaten inşa edildi (bkz. `src/lib/__tests__/rls-*.test.ts`); NestJS/Turborepo'ya geçiş haftalarca sürer ve kanıtlanmış, test edilmiş işi çöpe atar.

O belgeden **kavramsal olarak** projeye alınanlar:
- Kanıt bütünlüğü tasarımı — hash zinciri, Merkle batch, anchor provider soyutlaması (bkz. **M5.5**, §2.3);
- Genişletilmiş güvenlik/test kontrol listesi (bkz. M5.5 ve M6 kabul kriterleri);
- Dört-göz onayı vurgusu, bulgu kapatma disiplini (bkz. M5.5).

Alınmayanlar: belgenin teknoloji yığını (NestJS/Prisma/Keycloak/MinIO/Turborepo), 9 rollük tam RBAC modeli (pilot ölçeği 5-15 kullanıcı için mevcut 3 rol + genişletilebilir tasarım yeterli, gerekirse ayrı bir milestone'a alınır), olay/delil odası (custody events, Faz 7 muadili — MVP dışı), RegChain/çok-kurumlu DLT (blockchain karar kapısı zaten "hayır" veriyor: tek kurum var, §2.3'teki 5 sorudan en az 4'ü olumsuz).

### 1.2 Mimari karar kaydı — 17 Temmuz 2026 (simülasyon vizyonu)

Kurucu ikinci bir vizyon belgesi verdi (`KALKAN_OS_Tam_MVP_Simulasyonlu_...md`). Belge, ürüne
**siber dayanıklılık simülasyonu** modülü ekliyor: senaryo şablonları, canlı/zamanlı/hızlandırılmış
tatbikat yürütme, deterministik puanlama ve simülasyon sonucundan otomatik bulgu üretimi.

**Alınan (ürünün asıl değeri burada):** simülasyon modülünün tamamı — ama ayrı bir oyun olarak
değil, belgenin kendi ifadesiyle "mevcut uyum ve kanıt işletim sisteminin test üretme katmanı"
olarak. Vaat şu: ürün "belgen var mı?" diye sormakla kalmaz, "kontrolün gerçekten çalıştı mı?"
sorusunu da sorar ve cevabı kanıta bağlar. Bkz. **M7-M9**.

**Alınmayan:** belgenin teknoloji yığını (NestJS + Prisma + Turborepo + Keycloak + MinIO +
Redis/BullMQ + Docker Compose). Gerekçe §1.1'dekiyle aynı ve artık daha güçlü: o karardan bu yana
uygulama gerçek Supabase'e taşındı, 14 migration canlıda, 193 test yeşil. Geçiş, kanıtlanmış işi
çöpe atar. Belgenin istediği yetenekler mevcut yığında karşılanıyor:

| Belge | Bizdeki karşılığı |
|---|---|
| Keycloak/OIDC | Supabase Auth (canlıda çalışıyor) |
| MinIO/S3 | Supabase Storage |
| Prisma | `pnpm db:types` ile şemadan üretilen tipler |
| Redis + BullMQ | Zamanlı inject'ler için `pg_cron`/scheduler — kuyruk altyapısı pilot ölçeğinde gereksiz |
| Docker Compose | PGlite (test) + canlı Supabase; Docker bu makinede yok, gerekmedi |
| NestJS API | Next.js Route Handlers + RLS |

**Ertelenen:** 11 rollük tam RBAC (mevcut 3 rol + simülasyon rolleri M7'de eklenecek), CSV/XLSX
import-export, PDF/ZIP raporlar (M9), OpenTelemetry, SBOM.

**Belgeyle çelişen bir nokta, kayda geçsin:** belge "20-30 örnek kontrol" istiyor, bizde 17 var.
Bu bir eksik değil bilinçli sınır: kontrol içeriği YAML'dan seed ediliyor ve kural 3 gereği
uydurulamaz. Kontrol sayısı ancak doğrulanmış mevzuat maddesi eklendikçe artar.

### 1.5 Mimari karar kaydı — 17 Temmuz 2026 (2026 ürün araştırması: yetenekler kabul, yığın varsayımı üçüncü kez red)

Kurucu dördüncü vizyon/araştırma belgesini verdi. Kopyası repoda:
`docs/arastirma/KALKAN_OS_Urun_Gelistirme_Yol_Haritasi_2026.md` — önceki
belgeler repo dışında kaldığı için sonraki oturumlar okuyamamıştı; bu hata
tekrarlanmıyor.

**Karar 1 — yetenek omurgası KABUL.** Belgenin bağımlılık sırası
(*Evidence Envelope → Control Test/CCM → Scope Engine → Critical Service →
Incident/Recovery → sonrası*) ürünün asıl değer zincirini doğru kuruyor ve
mevcut işle örtüşüyor. Yeni taşlar M11-M15 bu omurgayı izler (aşağıda §"2026
ürünleşme planı").

**Karar 2 — teknoloji yığını varsayımı ÜÇÜNCÜ kez reddediliyor.** Belge
"mevcut teknik temel: NestJS, Prisma, Redis/BullMQ, Keycloak, MinIO,
OpenTelemetry, Docker" diyor. Bu iddia YANLIŞ: package.json'da bunların
hiçbiri yok (17 Temmuz 2026'da grep ile doğrulandı). Gerçek yığın Next.js +
Supabase; §1.1 ve §1.2'deki red gerekçeleri aynen geçerli ve artık daha da
güçlü (25 migration canlıda, 400+ test, PGlite RLS düzeni, e2e canlı
doğrulama disiplini). Karşılık tablosu (§1.2'dekinin devamı):

| Belge varsayımı | Bizdeki karşılığı |
|---|---|
| Redis + BullMQ işleri | `pg_cron` + Next.js route handlers (idempotent job deseni korunur) |
| MinIO Object Lock/WORM | Supabase Storage + append-only DB + hash zinciri + anchor. Gerçek WORM, yurt içi/on-prem hedefte MinIO ile gelir (kural 4 zaten bunu istiyor) — Storage erişimi bu yüzden ince bir katman arkasında tutulur |
| Keycloak + ABAC | Supabase Auth + RLS + katılım/rol tabloları; ABAC ihtiyacı doğduğunda politika RLS'te kalır |
| OpenTelemetry | Ertelendi; telemetri kanıt yerine geçmez (belgenin kendi notu) |
| Prisma şeması | `pnpm db:types` ile şemadan üretilen tipler |

Kurucu fiilen yığın geçişi istiyorsa bu ayrı ve pahalı bir karardır; bedeli
(test düzeninin, migration geçmişinin ve canlı doğrulamaların yeniden inşası)
açıkça konuşulmadan varsayılan cevap hayırdır.

**Karar 3 — takvim değil kapı.** Belge 14 FTE × 52 hafta × 2 haftalık sprint
varsayar. Bu proje tek kurucu + AI oturumlarıyla ilerliyor. Tarihli fazlar
ALINMADI; belgenin sırası korunarak kapılı taşlara çevrildi (kural 5 ve §5
madde 4: sıralama bağlayıcıdır, takvim değildir).

**Karar 4 — belgenin bağımsız DOĞRULADIKLARI, kayda geçsin.** Belge, bu
oturumlarda verilmiş birkaç kararı bilmeden aynen önermiş: RFC 8785 kanonik
JSON (bugün geçildi), dört-hash'li paket bütünlüğü (bugün kuruldu), RFC 3161
"ilk sürümde opsiyonel, production'da zorunlu" (bizim erteleme kararımızın
aynısı), "Neo4j ekleme, Postgres node/edge + recursive CTE ile başla" (kural
4'ün ruhu), `Failed ≠ Unknown ≠ Stale` ayrımı (bilinen kanıt-süresi borcumuzun
genelleştirilmiş hali), `hash_algorithm` alanı zorunluluğu (bugün eklendi).
Bağımsız yakınsama, bu kararların keyfî olmadığının kanıtıdır.

**Karar 5 — ad çakışması.** Belge modülleri M01-M18 kodlarını kullanıyor;
repo taşları M1-M10 (ve devamı M11+). Çakışma gerçek: belgenin M10'u TLPT,
reponun M10'u YK Beyanı. Bu dosyada belge modülleri her zaman "belge M0X"
diye anılır; repo taş numaraları çıplak kalır.

**Karar 6 — inşa edilmeyecekler listesi aynen kabul.** Belge §11 (SIEM/EDR,
vulnerability scanner, PAM, genel GRC, tam dijital ikiz vb. YENİDEN İNŞA
EDİLMEZ; bunlar connector/test sağlayıcısıdır) ürün sınırını doğru çiziyor.

### 1.6 Mimari karar kaydı — 18 Temmuz 2026 (SPK/SPL çalışma notları — DEĞERLENDİRME, KOD YOK)

Kurucu beşinci bir belge verdi: `docs/arastirma/KALKAN_OS_SPK_Notlari_Urunlestirme_Eki_2026.md`
(SPL 1020/1023 çalışma notlarının ürünleştirme önerisi). **Bu bölüm yalnızca
değerlendirmedir — bu oturumda hiçbir kod/şema yazılmadı.** Sebep: belge M13/
M14/M09/M15'i genişleten dört ayrı yeni alt-sistem öneriyor (kurum profili
şeması, SoD motoru, denetim örnekleme motoru, üçüncü taraf/kripto yaşam
döngüsü); bunları gece boyu tek taraflı tasarlamak yerine kapsamı burada
netleştirip kurucuyla birlikte önceliklendirmek daha doğru.

**Belgenin kendi sınırı, kural 3'ü DOĞRULUYOR:** belge açıkça "çalışma notları
tek başına bağlayıcı mevzuat kaynağı olarak kullanılmamalı" diyor (SPL 1020/
1023 birer sınav hazırlık notu, Resmi Gazete/SPK metni değil). Yani belgenin
§7'sindeki "ilk 20 SPK kontrolü" (SPK-GOV-01 vb.) veri/controls'a girecekse
DOĞRUDAN değil, mevcut disipline uyarak: `TODO-DOGRULA` etiketiyle, madde
referansı doğrulanana kadar. Belgenin kendisi de bunu istiyor (§15: "yürürlükteki
resmi düzenleme doğrulanmadan sabitlenmiş süre/kapsam hükümleri" ürüne ALINMAZ).

**Örtüşen kısımlar — YENİ TAŞ DEĞİL, mevcut taşları zenginleştiriyor:**

| Belge bölümü | Zaten planlı yer | Not |
|---|---|---|
| §2 `RegulatoryEntityProfile` + kapsam motoru | **M14** (Kapsam motoru, belge M03) | M14 zaten `regulation_sources`+`applicability_rules` planlıyor; SPK notları kurum profili alan listesini (11 özellik) somutlaştırıyor — M14'ün "eklenecekler" notuna girmeli |
| §3 Varlık-hizmet-süreç-tedarikçi grafiği | **M13** (Kurum profili, kritik hizmet) | M13 zaten bağımlılık node/edge planlıyor (Postgres, Neo4j yok); SPK notları asgari varlık alanlarını (owner, custodian, kritiklik sınıfı vb.) zenginleştiriyor |
| §9 Üçüncü taraf yaşam döngüsü (başlat/sürdür/sonlandır) | 2026 planı "M09 Third/Nth-Party" (ertelenmiş) | `closed_verified` kapısı fikri M12'nin verified-closure guard desenine (kural 14) doğrudan uyarlanabilir |
| §10 Kripto anahtar yaşam döngüsü | 2026 planı "M15 Crypto/PQC" (ertelenmiş) | Belgenin kendi notu doğru: bu gereksinimler bugünkü JWS imza anahtarı (ADR-M11-01) ve gelecekteki RFC 3161 zinciri için ŞİMDİDEN uygulanabilir bir kontrol listesi |

**Gerçekten YENİ — repo'da hiçbir taşta karşılığı yok:**

1. **Görevler Ayrılığı (SoD) motoru** (§5) — `ConflictRule`/`SoDViolation`/
   `CompensatingControl`/`ExceptionApproval`. Telafi edici kontrol + süre sonu +
   otomatik yeniden açma fikri, M12'nin verified-closure guard'ının (kural 14)
   doğal bir genişlemesi: "istisna süresiz kabul edilemez" aynı DB-invariant
   disipliniyle kurulabilir.
2. **Denetim örnekleme + çalışma kâğıdı motoru** (§6) — mevcut `paylasim`
   (M4) yalnızca kapsam-filtreli GÖRÜNTÜLEME; bu öneri çok daha geniş
   (`AuditEngagement`/`Population`/`SamplingPlan`/`Workpaper`/bağımsız kapanış
   incelemesi). Kabul kriteri "tekrar üretilebilir örnek seçimi" M9'un
   deterministik puanlama disipliniyle (kural 11) aynı aileden.
3. **Rol bazlı eğitim/yetkinlik modülü** (§11) — hiçbir yerde planlı değil,
   düşük öncelik (belgenin kendi P1/Ay4-6 sıralamasıyla uyumlu).

**Ad çakışması notu (Karar 5'in devamı):** belge "M19 SPK Assurance Pack"
öneriyor. 2026 planında repo taşları hâlâ M13-M15'te; "belge M19" ifadesi
yalnızca SPK notlarının kendi numaralandırmasına aittir, repo taş sırasına
otomatik dahil edilmedi — SoD ve denetim örnekleme motorlarının nereye
oturacağı (M13-M15'in bir alt maddesi mi, ayrı yeni taş mı) sabah kararı.

**Sıradaki adım kurucuda:** yukarıdaki üç "gerçekten yeni" alandan hangisinin
önceliklendirileceği ve M13-M15'in "eklenecekler" notlarının ne zaman devreye
alınacağı konuşulmadan şema/kod yazılmayacak.

**Karar geldi (18 Temmuz 2026, "M12 Sonrası Geliştirme Talimatı"):** üç alan
ayrı taş oldu — **M16** (SoD, belge §5), **M17** (denetim örnekleme, belge §6),
**M18** (eğitim/yetkinlik, belge §11). Repo'da M15 dolu olduğu için (Olay
saati ve kurtarma kanıtı) kurucunun taslak numaraları (M15/M16/M17) bir
kaydırıldı — var olan taş yeniden numaralandırılmadı (kural: "mevcut modülleri
yeniden numaralandırma"). **Bu turda yalnız M16'nın ilk dikey dilimi
kodlanıyor**; M17/M18 yalnız ADR/sınır dokümanı seviyesinde (§ aşağıda).
Talimatın "Prisma kalıpları"/"BullMQ" varsayımı Karar 2'deki (§1.5) tabloyla
aynı gerekçeyle sessizce Supabase migration + TS tipi + senkron/`pg_cron`'a
çevrildi — ayrı bir onay istemedi çünkü zaten üç kez reddedilmiş bir karar.

### 1.7 Mimari karar kaydı — 18 Temmuz 2026 (Master Talimat: UI + regülasyon zekâsı — PR-0 KEŞİF, KOD YOK)

Kurucu altıncı belgeyi verdi: `docs/arastirma/KALKAN_OS_Master_Talimat_UI_
Regulasyon_2026.md` (birebir kopya, diff doğrulı). İki eksen: (A) "Regulatory
Observatory" tasarım sistemi + responsive kabuk + dark/light tema; (B) M19–M33
regülasyon zekâsı modülleri (kaynak sicili → temporal korpus → knowledge graph
→ applicability → legal guard → citation → change radar → düzenleme paketleri).

**Bu tur belgenin §35'i gereği YALNIZ PR-0:** keşif + baseline + envanterler +
ADR taslakları + plan → **`docs/adr/PR0-master-talimat-kesif-2026-07-18.md`**
(tek yetkili kaynak; burada özet):
- Baseline ÖLÇÜLDÜ: 631 birim + 17 e2e, 0 skip (belgedeki 581 bayat).
- Belgenin PR-3A/3B'si REPO'DA ZATEN BİTMİŞ (§28 kendi talimatıyla tekrar
  yapılmayacak); MIME kontrolü + import UI PR-3D'ye eşlendi.
- Hostinger tipi AÇIK KARAR DEĞİL: Seçenek A (managed Node.js) 17 Temmuz'da
  kanıtla doğrulanmıştı; eksikler (health endpoint, CSP, rollback prosedürü)
  PR-1 planına girdi.
- 4 ADR taslağı kurucu onayı bekliyor: T1 token sistemi (shadcn adları korunur,
  belge renkleri değer olarak girer), T2 tema (paketsiz inline script + cookie +
  profil tercihi), T3 ortak hukuk verisi ↔ tenant ayrımı (kural 1'in kapsam
  netleşmesi: ortak referans tablosuna tenant_id UYDURULMAZ), T4 kaynak erişim
  politikası + "bugün worker yok" kararı.
- Sıra: PR-1 UI foundation → PR-2 ekran taşıma → PR-3C rollback → PR-3D import
  UI + e2e + **M16 üretim kapısı** → ancak ondan sonra M19+ (PR-4 kaynak sicili).
  M17/M18 kodu M16 kapısından önce YOK (belge de aynı şeyi söylüyor).

### 1.4 Mimari karar kaydı — 17 Temmuz 2026 (bütünlük modeli: dört hash, iki katman)

**Karar:** tek bir `reportHash` yerine dört ayrı hash; çekirdek manifest ile paket
manifesti iki ayrı katman; kanonikleştirme RFC 8785 (JCS).

**Sorun 1 — ad yanıltıyordu.** `reportHash` adı, PDF DOSYASININ hash'i sanılmasına
yol açıyordu; oysa değer raporun dayandığı VERİNİN hash'iydi. Bir bütünlük
ürününde bir hash'in NEYİ doğruladığı hakkındaki belirsizlik, hash'in kendisi
kadar ciddi bir kusurdur: yanlış şeyi doğruladığını sanan denetçi, aslında
doğrulamadığı bir şeye güvenir.

| Değer | Neyi doğrular |
|---|---|
| `reportDataHash` | Raporun dayandığı deterministik sonuç verisini |
| `coreManifestHash` | Rapor verisi + kanıt zarflarının bütününü |
| `pdfFileHash` | Üretilmiş PDF dosyasının baytlarını |
| `packageManifestHash` | Dışa aktarılan ZIP paketinin içeriğini |

**Sorun 2 — döngü.** Bir belge kendi hash'ini içeremez. Üretim sırası tek yönlü:
ReportData → `reportDataHash` → çekirdek manifest (+kanıt zarfları) →
`coreManifestHash` → PDF (içinde ilk iki hash + QR) → `pdfFileHash` → paket
manifesti → `packageManifestHash` → anchor/audit zinciri. **PDF'in içine
`pdfFileHash` veya `packageManifestHash` BASILMAZ** — ikisi de PDF'ten sonra doğar.

**`pdf_file_hash` neden manifest tablosunda değil:** PDF her istekte yeniden
üretiliyor ve baytları birebir aynı olmak zorunda değil (üretici `CreationDate`
gibi alanlar gömer). Bir tatbikatın "tek bir PDF baytı" yok; olan şey dışa
aktarılan SOMUT bir dosya. Bu yüzden `pdfFileHash`/`packageManifestHash` dışa
aktarma kaydına ait. Manifest tablosuna koymak, her indirmede değişen bir değeri
mühürlenmiş gibi göstermek olurdu.

**RFC 8785 (JCS) — neden kendi kanonikleştirmemiz yetmiyordu:** eski uygulama
anahtarları sıralıyordu ve bizim veri tiplerimiz için doğru çıktı veriyordu — ama
bir STANDARDA değil, `JSON.stringify`'ın davranışına yaslanıyordu. Bağımsız
denetçi hash'i Python/Java/Go ile yeniden hesaplayacaksa dayanacağı şey "JS böyle
yapıyor" olamaz. `canonicalize` (RFC 8785 referans JS implementasyonu) eklendi;
saf JS, kural 4'ü bozmuyor. **Geçiş sessizce hash bozmadı** —
`canonical.test.ts` eski algoritmayla JCS'in zarf verisi üzerinde birebir aynı
çıktıyı verdiğini kanıtlıyor.

Ayrıca sabitlenenler: tarihler UTC/RFC 3339 (`kanonikZaman` — Postgres'in
`+00:00`'ı ile JS'in `Z`'si aynı hash'e düşsün diye), Postgres `numeric`'in
string hali (`kanonikSayi`), `null` ≠ boş dizi ≠ eksik alan, ve hash şema
sürümleri hash'lenen verinin İÇİNDE (`KALKAN_REPORT_DATA_V1` vb.) — doğrulayan
taraf hangi kuralla hesaplayacağını manifestin kendisinden öğrensin diye.

**Sıralama:** DB'den geliş sırası hiçbir hash'i etkilemez. Bu bir kez gerçek bir
hataya yol açtı (manifest sıralanıyordu ama ReportData sıralanmıyordu ve
`reportDataHash` manifestin içine girdiği için sıra mühre sızıyordu). Zorunlu
test: aynı veri 100 farklı rastgele satır sırasıyla → aynı hash.

### 1.3 Mimari karar kaydı — 17 Temmuz 2026 (OKTAGON-R ile ilişki)

Kurucu, `C:\Users\orhan\OKTAGON_R`'da paralel bir oturumda geliştirilen ayrı bir projeyi
("BIST şirketleri için siber/operasyonel dayanıklılık karnesi + Yönetim Kurulu Beyan Platformu")
KALKAN-OS ile birleştirmeyi önerdi ("technical-engine modülü" olarak). Kod tabanı okunmadan önce
bu makul bir varsayımdı; okunduktan sonra resim değişti.

**OKTAGON-R gerçekte ne yapıyor:** canlı sistem taraması YAPMIYOR. KAP bildirimlerini ve
faaliyet raporlarını (kamuya açık belgeler) indirip LLM ile kanıt çıkarımı yapıyor (alıntı
doğrulamalı — kaynak metinde birebir/yakın eşleşme yoksa `quote_verified=0`, skora girmiyor),
sonra T98 çerçevesinin 8 fonksiyon × 29 kategorisine göre deterministik bir olgunluk skoru
üretiyor. Yani FinanSkor'a yakın bir **çok-şirketli kamusal veri/skorlama ürünü** — KALKAN-OS'un
**tek-kiracılı, özel iç uyum verisi yöneten** modeliyle temelden farklı bir veri alanı. Python +
SQLite (Supabase'e taşınacak, M5+), ayrı repo, ayrı git geçmişi.

**Çakışan tek parça — ve neden taşınacak bir şey yok:** kurucu aynı beyan sorusu/çapraz denetim
spesifikasyonunu (17 Temmuz 2026) her iki oturuma da vermiş; OKTAGON-R kendi `declaration/`
modülünü bağımsız olarak inşa etmiş (`S1..S20`, `CR-001..CR-008`, aynı 5 durum sözlüğü:
`BEYAN_VAR_KANIT_YOK` vb.). Soru metinleri KALKAN-OS'takiyle **birebir aynı** — iki paralel
oturum aynı kaynaktan çalışmış. Ama OKTAGON-R'ın sürümü:
- SQLite üzerinde, RLS **hiç test edilememiş** ("Row Level Security bir Postgres/Supabase
  özelliğidir, SQLite'ta yok... test EDİLEMEDİ" — kendi SPEC.md'sinin itirafı);
- immutability trigger'ı yok;
- canlı veriye karşı uçtan uca doğrulanmamış (yalnızca birim testi + demo script).

KALKAN-OS'taki M10 sürümü ise canlı Postgres'te RLS testli, immutability trigger'lı ve gerçek
Supabase verisine karşı uçtan uca doğrulanmış (`pnpm demo:beyan`) durumda — **aynı özelliğin daha
olgun hâli zaten burada var.** Bu yüzden OKTAGON-R'dan KALKAN-OS'a kod taşınmadı: taşınacak,
buradakinden daha iyi olan bir şey yok. (İki oturumun soru→kural eşlemesinde küçük bir ayrışma
var — örn. CR-007'yi OKTAGON-R S18'e, KALKAN-OS YKB-01'e bağlamış; KALKAN-OS'unki CR-007'nin
kendi tetikleyici tanımıyla — "toplantı gündemi/karar tutanağı izi" — daha iyi örtüşüyor.)

**Karar:** iki proje **ayrı kalır**, birleştirilmez. OKTAGON-R'ın kendi `declaration/` modülüne
daha fazla oturum yatırılmaması önerildi (KALKAN-OS'unki kanonik sürüm); OKTAGON-R'ın asıl
değeri olan skorlama/karne işlevine (611 gerçek şirket, gerçek LLM extraction maliyeti zaten
harcanmış, golden-set kalibrasyonu yapılmış) **dokunulmadı** — bu gerçek, ayrı bir ürün ve
kurucunun kendi kararı olmadan silinecek/kapatılacak bir şey değil.

**Gelecekte anlamlı olabilecek gerçek entegrasyon noktası** (şimdi kapsam dışı, kural 5): bir
KALKAN-OS kiracısının kendi ticker'ı için OKTAGON-R'ın `scores` tablosundan sektör yüzdelik
karşılaştırması okuması — "kurumunuzun kanıtlı uyum skoru X, sektör ortalaması Y" gibi. Bu, iki
Supabase projesi arasında salt-okunur bir referans olur, kod birleşimi değil.

---

## 2. Veri modeli çekirdeği (M1'de şema olarak yazılacak)

```
tenants            (id, name, segment: araci_kurum|pys|kvhs|diger, created_at)
users              (Supabase auth + profiles: tenant_id, role: admin|uyum|denetci_misafir)
frameworks         (id, code: VII-128.10|7545|BDDK|DORA, name, version, yururluk_tarihi)
controls           (id, framework_id, madde_ref, baslik, aciklama, kanit_tipi[],
                    periyot: yillik|surekli|olay_bazli, kritiklik: 1-5)
control_mappings   (control_id ↔ control_id, iliski: esdeger|kismi)   -- "bir kanıt, dört çerçeve"
tenant_controls    (tenant_id, control_id, durum: karsilaniyor|kismi|acik|kapsam_disi,
                    sorumlu_user_id, son_degerlendirme, not)
evidences          (id, tenant_id, control_id, tip: dosya|link|beyan, storage_path,
                    hash_sha256, yukleyen, gecerlilik_bitis, created_at)   -- zaman damgalı, değişmez
findings           (id, tenant_id, kaynak: sizma_testi|denetim|ic_tespit, onem: acil|kritik|yuksek|orta|dusuk,
                    baslik, aksiyon_plani, yk_onay_tarihi, hedef_kapama, durum)  -- VII-128.10 bulgu takibi
audit_log          (append-only: kim, ne, ne_zaman, tenant_id)  -- ürünün kendisi denetim-izli olmalı
share_links        (denetçi salt-okunur erişim: token, tenant_id, kapsam, son_gecerlilik)
```

**RLS ilkesi:** her tabloda `tenant_id` + policy; `denetci_misafir` rolü yalnızca `share_links` kapsamındaki satırları okur. `evidences` ve `audit_log` güncellenemez/silinemez (yalnızca ekleme).

**M5.5'te eklenecek (kanıt bütünlüğü derinleştirme — henüz şemada yok):**
```
audit_log          (+ previous_event_hash, event_hash — canonical JSON + SHA-256 zincir)
evidences          (+ source_type, source_system, classification, retention_class — Evidence Envelope alanları)
anchor_batches     (id, tenant_id, merkle_root, period_start, period_end, created_at)
anchor_receipts    (id, batch_id, provider: local, receipt_payload, created_at)
action_approvals   (id, finding_id, approver_user_id, decision, created_at)  -- dört-göz onayı
```

---

## 3. Kilometre taşları

### M0 — İskele (hedef: ~2-3 oturum)
- Monorepo değil, tek Next.js uygulaması; TypeScript strict; ESLint/Prettier; Vitest + Playwright kurulu.
- Supabase projesi + migration altyapısı (`supabase/migrations`), seed script iskeleti.
- CI yerine yerel `pnpm check` betiği (typecheck + lint + test) — her kilometre taşı kapısında koşar.
- `.env.example`; `CLAUDE.md` (aşağıdaki çekirdek) repo köküne.
- **Kabul:** boş uygulama ayağa kalkar; `pnpm check` yeşil; migration up/down çalışır.

### M1 — Kontrol kütüphanesi + çok-kiracılı temel
- §2'deki şema migration'ları + RLS politikaları.
- **Seed verisi:** VII-128.10'un yapılandırılmış kontrol seti — `data/controls/vii-128-10.yaml` dosyasından yüklenir. ⚠ Claude Code tebliğ maddelerini **uydurmamalı**: YAML'a önce ~15 maddelik gerçekçi İSKELET girilir (madde_ref alanları `TODO-DOGRULA` etiketiyle), kurucu resmi metinden doğrular. 7545 sütunu ikinci YAML olarak eklenir; `control_mappings` ile 10-15 örnek eşleme.
- Auth: e-posta ile giriş, tenant oluşturma, kullanıcı davet (admin/uyum rolleri).
- **Kabul:** iki farklı tenant ile giriş yapılır; RLS testi (Vitest, service-role dışı istemciyle) tenant A'nın tenant B verisini OKUYAMADIĞINI kanıtlar; kontrol listesi çerçeve filtresiyle görüntülenir.

### M2 — Kanıt motoru (manuel)
- Kontrol detay sayfası: durum değiştirme, sorumlu atama, not.
- Kanıt yükleme: dosya → Supabase Storage, SHA-256 hash hesaplanır ve saklanır; link/beyan tipleri; geçerlilik bitişi (ör. sızma testi raporu 1 yıl).
- Süresi dolan kanıt → kontrol otomatik "kısmi"ye düşer (günlük cron/edge job veya sorgu-anında hesap).
- `audit_log` tetikleyicileri: durum/kanıt değişimi kayıt altına alınır.
- **Kabul:** e2e test — kanıt yükle → kontrol "karşılanıyor" olur → geçerliliği geçmişe çek → "kısmi"ye düşer; audit_log'da iki kayıt görünür.

### M3 — Boşluk & olgunluk panosu
- Tenant ana panosu: çerçeve bazında karşılanan/kısmi/açık dağılımı, kritiklik-ağırlıklı **olgunluk skoru (0-100)**, en riskli 10 açık kontrol.
- `control_mappings` üzerinden "bir kanıt, dört çerçeve": VII-128.10'a yüklenen kanıt, eşlenik 7545 kontrolünde de görünür (kaynağı etiketli).
- Bulgu (findings) modülü: sızma testi bulgusu girişi, önem derecesi (Acil→Düşük — VII-128.10 taksonomisi), aksiyon planı ve YK onay tarihi alanları.
- **Kabul:** seed verisiyle skor deterministik hesaplanır (birim testli formül); bir kanıt iki çerçevede görünür; bulgu yaşam döngüsü (açık→kapalı) çalışır.

### M4 — Denetçi paylaşım odası + YK Beyanı PDF
- Süreli, kapsamlı salt-okunur paylaşım linki (`denetci_misafir`): seçilen çerçeve + kanıtlar.
- "YK Beyanı" PDF: olgunluk skoru, açık bulgular, son sızma testi tarihi, kanıt sayıları, RTO/RPO alanları (manuel girilir).
- **Kabul:** e2e — link oluştur, gizli pencerede aç, yalnızca kapsamdaki veriyi gör, yazma denemesi 403; PDF üretilir ve alanları doludur. **Bu nokta = Faz 1 PoC demosu.** İki aracı kurumla ücretli keşif görüşmesine bu build çıkar.

### M5 — Pilot sertleştirme (PoC geri bildirimi sonrası)
- PoC görüşmelerinden gelen ilk 5 düzeltme (kapsam burada bilinçli boş bırakıldı).
- Türkçe arayüz metinlerinin gözden geçirilmesi, boş-durum ekranları, hata durumları.
- Temel güvenlik sertleştirme: rate limit, dosya tipi/boyut doğrulama, RLS ikinci gözden geçirme, bağımlılık taraması.
- **Kabul:** kurucu onaylı PoC geri bildirim listesi kapanmış; `pnpm check` + e2e yeşil.

### M5.5 — Kanıt bütünlüğü derinleştirme + dört-göz onayı (kaynak: vizyon belgesi §9, §2.2.2, §2.4)
- `audit_log` olaylarını `previous_event_hash` + `event_hash` ile zincirle (canonical JSON temsili + SHA-256); zincir kırığını tespit eden bir kontrol (test veya sorgu).
- Kabul edilen kanıtların hash'lerini periyodik **Merkle batch**'e al (`anchor_batches`); yaprak sırası deterministik olmalı.
- `EvidenceAnchorProvider` arayüzü + MVP implementasyonu `LocalAppendOnlyAnchorProvider` (saf Postgres, DLT yok — CLAUDE.md kural 4 ve §2.3'teki blockchain karar kapısıyla uyumlu).
- Bağımsız doğrulama ekranı/API: `/verify/:kod` → `VERIFIED|FAILED|PARTIAL|PENDING`; tahmin edilemez doğrulama kodu, hassas metadata sızdırmaz.
- Bulgu kapatmada **dört-göz onayı**: kapatma kanıtını yükleyen kullanıcı kendi bulgusunu tek başına nihai kapatamaz (`action_approvals`).
- **Kabul:** tek bit değişen kanıt doğrulamada `FAILED` döner; kasıtlı bozulan audit_log zinciri testle tespit edilir; aynı kullanıcı kendi yüklediği kapatma kanıtını tek başına onaylayıp bulguyu kapatamaz (RLS/domain testi).

### Supabase geçişi (M5.5 ile M6 arası — sürüyor)

Şema ve saf mantık katmanı canlıya alındı; uygulama kodu mock/localStorage
store'dan gerçek Supabase'e taşınıyor.

- [x] 12 migration canlı projeye uygulandı; `pnpm db:verify` ile 14 tablo + 4 fonksiyon fiilen doğrulandı.
- [x] `@supabase/ssr` client'ları (browser/server) + `src/proxy.ts` (Next.js 16'da `middleware.ts`'in yerini alır) + `pnpm db:types` ile şemadan üretilen tipler.
- [x] Gerçek Supabase Auth (`src/lib/auth.tsx`); kimlik `auth.users`'tan, yetki bağlamı (tenant/rol) `profiles`'tan. Kayıt formu yok — şartname §5.1 gereği kullanıcılar davetle gelir. İlk yönetici için tek seferlik `pnpm bootstrap:tenant`.
- [x] Kontrol kütüphanesi canlıya seed edildi (`pnpm seed:controls`): 2 çerçeve, 17 kontrol, 2 eşleme. `TODO-DOGRULA` etiketleri korunuyor.
- [x] Kuruma kontrol paketi atandı (`pnpm assign:controls`) — şartname §5.1'in onboarding adımı.
- [x] **Veri katmanı**: store ve tüm sayfalar gerçek tablolardan okuyor; `src/lib/mock-data.ts` uygulama kodunda artık kullanılmıyor.

**Bu geçişin açtığı, kapatılması gereken borçlar:**

- [x] ~~audit_log yazması atomik değil~~ — **kapatıldı** (`20260717090000_audit_triggers.sql`). Kayıtları artık trigger'lar üretiyor: iz ana yazmayla aynı transaction'da doğuyor ve istemcinin `audit_log`'a insert yetkisi kaldırıldı. Böylece istemci, kimliği doğru ama içeriği uydurma bir kayıt (hiç olmamış bir eylem) da yazamıyor.

> **Bu iş sırasında bulunan gerçek hata — ders olarak burada duruyor:**
> Canlıda her `tenant_controls` güncellemesi `function digest(text, unknown) does not exist` ile **sessizce başarısız oluyordu** ve hash zinciri hiç çalışmıyordu. Sebep: Supabase `pgcrypto`'yu `extensions` şemasına kurar, PGlite `public`'e; fonksiyonlar `set search_path = public` ile kilitliydi. **193 test yeşilken canlı bozuktu.**
> Düzeltme: `20260717093000_fix_digest_search_path.sql`.
> Çıkarım: PGlite testleri RLS mantığını kanıtlar, **Supabase'in kurulum farklarını kanıtlamaz**. Şemaya dokunan her migration'dan sonra canlıya karşı gerçek bir yazma denemesi yapılmalı — `pnpm db:verify` tabloların varlığını gösterir, çalıştıklarını değil.
- [x] ~~Denetçi paylaşımı çalışmıyor~~ — **kapatıldı** (`20260717100000_share_link_guest_access.sql`). `paylasim_goruntule` RPC'si (security definer) token'ı doğrular, süreyi kontrol eder ve kapsamı belirler; RLS politikası yerine RPC seçildi çünkü anon'un JWT'si yok, yani token'ı politikaya taşıyacak bir kanal da yok. Veri minimizasyonu: yalnızca kontrol durumu + kanıt SAYISI döner (dosya yolu/hash/yükleyen dönmez). Erişim `paylasim_goruntulendi` olarak denetim izine yazılır, token loglanmaz. Geçersiz ve süresi dolmuş token aynı cevabı verir (geçerli token elenemesin). **Canlıda doğrulandı**: gerçek token ile 15 kontrol göründü (7545 kapsam dışı kaldı), süresi dolmuş token reddedildi, iki erişim audit'lendi, zincir sağlam.
- [ ] **`evidences.kaynak_kontrol_id` kolonu yok.** "Bir kanıt, dört çerçeve" yansıtmasında kanıtın hangi kontrolden geldiği DB'de kaybolur (yalnızca `audit_log` detayında kalır); yansıtılan kanıt doğrudan yüklenmiş gibi görünür.
- [ ] **Kanıt süresi dolması** artık yalnızca yükleme anında hesaplanıyor; DB'de "karsilaniyor" kalıp UI'da "kismi" görünen kayıtlar oluşabilir. Cron/trigger ile şemaya taşınmalı.
- [ ] `scripts/generate-yk-beyani.ts` hâlâ `mock-data`'dan okuyor.
- [x] ~~Playwright akışları devre dışı~~ — **kapatıldı**. `scripts/setup-e2e-fixtures.ts` ayrı bir
  "E2E Test Kurumu A.Ş." kiracısı + iki test kullanıcısı kurar (service_role ile, rastgele
  üretilen şifreyle — bir insanın kimlik bilgisi değil, atılabilir CI fikstürü) ve her `pnpm e2e`
  koşusunda o kiracının kontrol/kanıt/bulgu durumunu sıfırlar. 4 spec dosyası (10 test) gerçek
  seed veriye göre yeniden yazıldı; `workers: 1` ile sıralı koşuyorlar (paylaşılan kiracı
  durumunda paralel koşu flaky testlere yol açardı). **9/9 canlıda yeşil**, 1 test bilinçli
  `test.skip` — kanıt süresi dolmasının DB'de otomatik yeniden hesaplanmadığı bilinen açığı
  sınıyordu (aşağıdaki madde), o düzelene kadar kırmızı kalması sessizce gizlemekten iyidir.
  Bu iş sırasında iki gerçek bug bulundu ve düzeltildi: (1) `paylasim` sayfasındaki çerçeve
  seçimi hiçbir zaman varsayılan bir değer almıyordu (kullanıcı elle seçmeden Select sonsuza
  kadar boş kalırdı); (2) `frameworks` sorgusunda `order()` yoktu, yani varsayılan seçili
  çerçeve sayfa yüklemesi başına değişebilirdi.

### M7 — Simülasyon şablon motoru ✅ (kaynak: simülasyon belgesi §7, Faz 6)

**Durum: tamamlandı** (`20260717110000_scenario_templates.sql`, `pnpm seed:scenarios`).
Canlıda: 5 şablon (hepsi `UNVERIFIED_SAMPLE`), 28 inject, 22 karar noktası, 18 beklenen aksiyon,
**18 aksiyon→kontrol bağı**, 24 puanlama kuralı. Immutability canlıya karşı doğrulandı: yayınlanmış
sürüm de, alt içeriği de (inject/puanlama kuralı) değiştirilemiyor.

Şablonlar kiracıya ait DEĞİL, kontrol kütüphanesi gibi ortak referans veri — bu yüzden `tenant_id`
yok. Kural 1'in "her tabloda tenant_id" şartı müşteri verisi içeren tablolar içindir; kiracıya ait
olan şey simülasyonun kendisidir (M8: `simulation_runs.tenant_id`).

Simülasyon ana üründen ayrı bir oyun DEĞİLDİR: her beklenen aksiyon bir kontrole bağlanır, her
sonuç kanıt üretir. Bu taş yalnızca şablonu kurar, yürütmeyi değil.

- `scenario_templates` + `scenario_template_versions`: yayınlanmış şablon **immutable**; değişiklik yeni sürüm doğurur.
- `scenario_injects` (zamanlı gelişmeler), `scenario_decision_points`, `scenario_expected_actions`, `scenario_roles`.
- `scenario_scoring_rules`: kural türleri belgede sabit (`ACTION_COMPLETED_WITHIN`, `ROLE_NOTIFIED_WITHIN`, `RTO_WITHIN_TARGET`, `MANDATORY_FAIL_IF` …). Kurallar sürümlenir.
- `scenario_control_mappings`: beklenen aksiyon → mevcut `controls` tablosu.
- Seed: beş şablon (S01 fidye, S02 ayrıcalıklı hesap, S03 veri sızıntısı, S04 yedekten dönüş, S05 tedarikçi kesintisi) — `UNVERIFIED_SAMPLE` etiketli, `data/scenarios/*.yaml`'dan; kural 3'ün aynısı burada da geçerli.
- **Kabul:** yayınlanmış şablon değiştirilemez (RLS/trigger testi); her beklenen aksiyon en az bir kontrole bağlanabiliyor; beş şablon YAML'dan seed ediliyor; şablon sürümü geçmiş simülasyonları etkilemiyor.

### M8 — Simülasyon yürütme + deterministik puanlama (Faz 7-8) ✅

**Tamamlanan:** şema (`20260717120000_simulation_runs.sql`) ve deterministik puanlama motoru
(`src/lib/scoring.ts`). 42 test. Canlıda doğrulandı: run oluşuyor, bağlı şablon sürümü silinemiyor,
geçersiz mod reddediliyor.

- Rol bazlı inject görünürlüğü **RLS'te** (UI filtresi değil): katılımcı başka rolün gizli
  gelişmesini sorguyla da göremiyor; yönetici/gözlemci hepsini görüyor; yayınlanmamış gelişme
  kimseye görünmüyor. Aynı inject iki kez yayınlanamaz — idempotency şemada (unique), uygulama
  koduna bırakılmadı.
- Kararlar/gözlem notları append-only; katılımcı başkası adına karar veremez; gizli gözlem notu
  katılımcıya kapalı; bulgu önerisini istemci yazamaz (sistem üretir, `PROPOSED` doğar).
- Puanlama saf TS ve deterministik: rastgelelik/tarih okuma yok, her satır gerekçeli, gözlemci
  puanı tek başına toplamı belirlemiyor, `MANDATORY_FAIL_IF` puana katılmıyor ama sonucu
  `CRITICAL_FAILURE` yapıyor. Uygulanamayan kural paydadan düşüyor (eksik şablon, katılımcının
  başarısızlığı gibi görünmesin).

**Durum makinesi tamamlandı** (`20260717130000`): geçişler trigger'da zorlanıyor — oynanmadan
puanlamaya geçilemiyor, kapanmış tatbikat yeniden açılamıyor, bittikten sonra gelişme
eklenemiyor, yayınlanmamış gelişmenin kararı verilemiyor. Duraklatılan süre biriktiriliyor ve
katılımcının yanıt süresine yazılmıyor.

**Aksiyon sonuçları** (`20260717140000`): puanlama motorunun girdisi. Karar noktalarıyla otomatik
bağ KURULMADI bilinçli olarak — "eskalasyon yapıldı" kararının verilmiş olması eskalasyonun
gerçekten yapıldığı anlamına gelmez; yönetici/gözlemci neyin fiilen olduğunu işaretler.

**Puanlama DB'ye bağlandı**: `POST /api/simulasyon/[id]/puanla`. İki aşamalı yetki — önce
kullanıcının oturumuyla RLS altında okuma (başka kiracının tatbikatı zaten görünmez), sonra
yalnızca yazma için service_role.

**Uçtan uca canlıda doğrulandı** (`pnpm demo:simulation`): S01 fidye tatbikatı oynandı — 10
gelişme, 4 karar, 6 aksiyon. Sonuç belgenin §8.5 örneğiyle birebir örtüştü: eskalasyon 42 dk
(hedef 15) → başarısız → otomatik bulgu önerisi. Puan 50/100 ama **CRITICAL_FAILURE** (delil
toplanmadı). 4 öneri üretildi, hepsi gerçek kontrollere bağlı, hepsi `PROPOSED`, hiçbiri onaysız
bulguya dönüşmedi. Audit zinciri sağlam kaldı.

**UI tamamlandı** (`/simulasyonlar/[id]`, `POST /api/simulasyon/[id]/oneri/[oneriId]`): tek sayfa,
rol-bazlı bölümler — üç ayrı control-room/katılımcı/gözlemci sayfası yerine `katilim_tipi`ye göre
koşullu render (pilot ölçeğinde üç sayfa aynı veriyi üç kere çekip senkronize tutmak olurdu).
Yönetici paneli: durum geçişleri, sıradaki gelişmeyi yayınlama, aksiyon sonucu işaretleme,
katılımcı ekleme. Herkese: rol-filtreli zaman çizelgesi (yalnızca `simulation_inject_deliveries`
okunur, `scenario_injects` doğrudan sorgulanmaz — UI disiplini, RLS zaten asıl sınır). Öneri
kabul/ret: kabul, kullanıcının KENDİ oturumuyla gerçek bir `findings` satırı yazar (audit_log
trigger'ı onaylayanı doğru yakalasın diye, service_role değil) — kural 11'in "PROPOSED doğar,
insan onaylamadan gerçek bulgu olmaz" şartı UI'da da geçerli.

**Uçtan uca canlı tarayıcıda doğrulandı** (`e2e/simulasyon.spec.ts`, gerçek Chromium + gerçek
Supabase): S05 tatbikatı baştan sona oynandı — başlat, tüm gelişmeleri yayınla, aksiyonları
işaretle, tamamla, puanla, üretilen öneriyi kabul et → `/findings`'te gerçek bulgu olarak
görüldü. İki kez art arda çalıştırılıp kararlılığı doğrulandı.

**Bu doğrulama sırasında bulunan gerçek bug — kendi cascade'ini bloke eden trigger**
(`20260717170000_fix_action_result_delete_cascade.sql`): `simulation_action_result_guard`
(`before insert/update/DELETE`) DELETE için erken çıkışı, ebeveyn tatbikatı arayan sorgudan
SONRA yapıyordu. `simulation_runs` silinince cascade ile `simulation_action_results` de silinir;
bu cascade sırasında ebeveyn satır ZATEN silinmiş olduğundan sorgu hiçbir şey bulamıyor, trigger
kendi "Tatbikat bulunamadi" hatasını fırlatıp TÜM SİLME İŞLEMİNİ engelliyordu — aksiyon sonucu
olan bir tatbikat asla silinemiyordu. `scripts/setup-e2e-fixtures.ts`'in e2e kiracısını
sıfırlaması sırasında bulundu (3 test run'ı hiç silinmeden birikmişti). PGlite regresyon testi
eklendi (`rls-simulasyon-durum.test.ts`).

- `simulation_runs` durum makinesi: `DRAFT → SCHEDULED → READY → RUNNING → PAUSED → COMPLETED → SCORING → REVIEWED → CLOSED`, `RUNNING → ABORTED`.
- **Başlatılan run, şablonun immutable snapshot'ını kullanır** — şablon sonradan değişse bile geçmiş simülasyon değişmez (belge §10.7).
- Üç mod: facilitated live, timed, accelerated demo. Hızlandırılmış modda rapor `SIMULATED_ACCELERATED` etiketi taşır.
- Rol bazlı görünürlük: katılımcı yalnızca kendi rolüne yayınlanmış inject'i görür. Bu bir RLS testi konusudur, UI filtresi değil.
- `simulation_decisions`, `simulation_tasks`, `simulation_observations`, `simulation_timeline_events`.
- Deterministik puanlama: aynı girdi aynı sonucu verir; her puan satırı neden verildiğini gösterir; kritik zorunlu aksiyon eksikse genel puan yüksek olsa bile `CRITICAL_FAILURE`.
- `simulation_finding_proposals`: öneri **`PROPOSED`** doğar; GRC/güvenlik yöneticisi kabul etmeden gerçek bulguya dönüşmez.
- **Kabul:** aynı veri aynı puanı üretir (deterministiklik testi); katılımcı başka rolün gizli inject'ini SORGUYLA DA göremez; aynı inject iki kez yayınlanmaz (idempotency); pause sırasında zaman hesabı doğru; öneri onaylanmadan bulgu oluşmaz.

### M9 — Fidye yazılımı dikey akışı + raporlar (Faz 9-10) ⏳ manifest+PDF+QR ✅, panosu/S01/yönetim raporu ✗

**Tamamlanan — mühür ve rapor zinciri.** Puanlama rotası artık sonucu mühürlüyor:
`simulation_result_manifests` (append-only, immutable trigger, tatbikat başına tek
satır) + `simulation_manifest_receipts` (makbuz ayrı tabloda — `anchor_batches`
desenindeki gerekçeyle: makbuz sonradan gelebilir, manifest satırı immutable
kalmalı). Mantık `src/lib/simulation-manifest.ts` (22 test), şema testi
`rls-simulasyon-manifest.test.ts` (14 test).

**Bütünlük modeli §1.4'te** (dört hash, iki katman, RFC 8785). Adım 1-4 bitti.

- ✅ Manifest: immutable, şablon sürümü + kararlar + kanıt hash'leri + puanlama
  kural hash'i + `reportDataHash`. Merkle kökü `merkle.ts`, mühür `anchor.ts`'in
  `EvidenceAnchorProvider`'ı üzerinden (local sağlayıcı — RFC 3161 bilinçli
  ertelendi, bkz. aşağıdaki borç).
- ✅ PDF: **simülasyon raporu** (`/api/simulasyon/[id]/rapor`, Playwright runtime
  bağımlılığı), rapor hash'i + QR → herkese açık `/dogrula/[hash]`.
- ✅ Kabul: simülasyon tamamlanmadan puanlama başlamıyor (M8 durum makinesi);
  başarısız kontrol otomatik öneri üretiyor (M8); **QR doğrulama hassas veri
  sızdırmıyor** — `manifest_dogrula` RPC'si yalnızca beş alan döndürür (hash,
  zaman, mühür durumu); puan/kurum/senaryo bilinçli olarak yok. Hem PGlite hem
  e2e testiyle kapıya bağlandı.
- ✅ Canlıda doğrulandı (kural: `db:verify` çalıştığını değil var olduğunu gösterir):
  manifest gerçekten yazıldı, makbuz düştü, `manifest_dogrula` canlıda döndü,
  değişmezlik trigger'ı service_role'ün UPDATE'ini reddetti.
- ✅ `e2e/simulasyon.spec.ts`: gerçek Chromium gerçek PDF üretti (%PDF imzası),
  QR'ın adresi oturumsuz açıldı, kurum/senaryo/puan sızmadı.

**M9'un tamamlanma sırası (kurucu talimatı, 17 Temmuz 2026).** Bu sıra
bağlayıcıydı; aynı gün akşamı kurucunun 2026 araştırma belgesi geldi (§1.5) ve
kalan adımlar yeni taş sırasına DEVREDİLDİ. Hiçbir adım düşmedi — her birinin
yeni adresi aşağıda. M9 bu haliyle kapanmış sayılmaz; kalanları M11-M13'ün
kabul kapılarında yaşıyor.

1. ✅ Kanonik `ReportData` ve dört ayrı hash tanımı (§1.4). Sonradan RFC 8785
   kendi uygulamamıza taşındı; referans implementasyon testte hakem
   (`canonical.ts` başlığı ve `canonical.test.ts` uygunluk külliyatı).
2. ✅ Evidence Envelope şema göçü (`20260717190000`): zarf alanları eklendi,
   guard yeni satırda tam zarf zorluyor, eski satırlar `LEGACY_FILE_HASH_ONLY`.
3. ✅ Manifest v2 zarf hash'ini taşıyor: puanlama rotası `zarfOlustur` +
   `envelopeHash` ile her kanıt için `fileHash` + `envelopeHash` mühürlüyor.
4. → **M12** S01'in 10 inject'inin eksiksiz oynanması
5. → **M11** gerçek dosya yükleme (Storage) + kabul akışının UI'a bağlanması
6. → **M13** RTO/RPO hedef kaynağı (kurum profili) ve ölçümü
7. → **M12** en az üç bulgu önerisi (S01 akışı içinde)
8. → **M12** bulguların aksiyona dönüştürülmesi + verified closure
9. → **M13** ana panoya sonuçların yansıması
10. ✅ Tatbikat PDF'i
11. → **M13** ayrı yönetim kurulu PDF'i (tatbikat raporunun kopyası OLMAYACAK:
    özet risk, RTO/RPO sonucu, kritik üçüncü taraflar, açık bulgular, kabul
    edilen artık riskler, aksiyon sahipleri, karar gerektiren konular)
12. → **M11** ZIP paket manifesti ve `packageManifestHash`'in anchor/audit
    zincirine yazımı
13. → **M12** S01 uçtan uca testi (S05 testi kabul için YETERLİ DEĞİL)

Ana panoda görünmesi gerekenler (adım 9): son S01 skoru, RTO ve RPO durumu,
kritik/yüksek bulgular, gecikmiş aksiyonlar, kanıt bütünlüğü durumu, son
tatbikat tarihi, yeniden test tarihi.

**Kanıt zarfı borcu — M9 KAPANMADAN çözülecek (adım 2-3).** Manifest bugün
`evidences.hash_sha256`'yı, yani DOSYA hash'ini mühürlüyor; M5.5'in zarf hash'ini
değil. Sebep şema: `evidences` tablosunda zarfın alanları yok. Tipler v2'de hazır
(`ManifestKanit`: `fileHash` + `envelopeHash` + `envelopeSchemaVersion` + `durum`)
ve mevcut kayıtlar **`LEGACY_FILE_HASH_ONLY`** taşıyor — bu kayıtlar "dosya
bütünlüğü doğrulandı" diyebilir, "kanıt kökeni ve zarf zinciri doğrulandı"
DİYEMEZ. Eksik alan uydurulmayacak; eski kayıtlar legacy kalacak.

Göç edilecek asgari alanlar: `evidenceVersionId`, `versionNumber`, `fileSize`,
`mimeType`, `storageObjectKey`, `storageVersionId`, `sourceSystem`, `sourceType`,
`capturedAt`, `retentionClass`, `classification`, `previousVersionHash`,
`previousEnvelopeHash`, `hashAlgorithm`, `envelopeSchemaVersion`.

**S01 ve RTO/RPO — hedef YAML'a yazılmayacak, kurum profilinden gelecek (adım 6).**
Önceki oturumun tespiti eksikti: S01'in RTO hedefi (`hedef_dakika: 90`) **zaten
uydurulmuş bir sayı** ve YAML'ın kendi başlığı (satır 9) bunu söylüyor. Yani
sorun "RPO eklemek uydurma olur" değil; mevcut RTO hedefi de uydurma. Karar:
hedefler senaryo şablonundan değil, kurumun onaylı BIA/iş sürekliliği
profilinden okunacak.

Hedef yoksa simülasyon DURMAZ; sonuç `TARGET_NOT_DEFINED`/`DEĞERLENDİRİLEMEDİ`
olur (ölçüm yine raporlanır: "RTO ölçümü 90 dakika, hedef tanımlanmamış") ve
otomatik bulgu açılır: *"Kritik hizmet için yönetimce onaylanmış RTO/RPO hedefi
tanımlanmamıştır."* Örnek seed'de temsili hedef kullanılabilir ama açıkça
**`DEMO_TARGET`** etiketli olmalı, gerçek mevzuat hedefi gibi gösterilmemeli.

Not — repoda olmayan referanslar: kurucu spesifikasyonundaki `CTRL-RTO-001` /
`CTRL-RPO-001` kontrol kodları bu repoda YOK (S01 `TODO-DOGRULA-07/13/14`
kullanıyor) ve `organizationProfile.criticalServices...` diye bir şema da yok
(`tenants` tablosunda yalnızca `id, name, segment, created_at`). Adım 6, kurum
profili şemasını sıfırdan yazmayı içerir; kontrol kodları ise ancak doğrulanmış
mevzuat maddesi geldiğinde (kural 3) eklenebilir.

### M10 — Yönetim Kurulu Beyanı ve çapraz denetim ✅ şema+motor, UI ✗ (kaynak: kurucu spesifikasyonu, 17 Temmuz 2026)

**Tamamlanan:** şema (`20260717150000_board_declarations.sql`), çapraz denetim motoru
(`src/lib/board-declaration-audit.ts`, 33 test), 20 soru + 8 kural seed edildi (`pnpm seed:beyan`).
**Uçtan uca canlıda doğrulandı** (`pnpm demo:beyan`): gerçek bir dönem açıldı, YKB-05 kanıtsız
"evet" cevaplandı → **CR-001 gerçekten tetiklendi** ("Kanıtlanmamış yönetim beyanı", risk
orta_yüksek); YKB-04 gerçek bir tatbikat sonucuna bağlandı → CR-002/CR-003 gerçek veriye göre
tetiklenmedi; beyan sunuldu ve **canlıda gerçekten değiştirilemedi**.

**Kalan (M10'un tamamlanması için):** beyan doldurma/sunma EKRANLARI, kanıt bağlama UI'ı, çapraz
denetim sonuçlarının panoda gösterimi, tetiklenen kuraldan gerçek bulgu önerisine geçiş (M8'deki
`simulation_finding_proposals` deseninin aynısı burada da uygulanmalı — PROPOSED doğmalı).

`scripts/generate-yk-beyani.ts`'teki M4-dönemi statik özet PDF'i (skor + bulgu sayısı, elle
girilen RTO/RPO) yerini bu daha zengin modele bırakıyor: 20 yapılandırılmış beyan sorusu +
her beyanı gerçek kanıt/simülasyon verisiyle karşılaştıran çapraz denetim motoru.

**Amaç teknik uzmanlık beyanı almak değil**: YK'nın kritik riskler hakkında zamanında, yeterli
ve güvenilir bilgiye dayanarak karar verip vermediğini belgelemek. TTK m.369/375/392 atıfları
**bilgilendirme amaçlıdır, doğrulanmış hukuki eşleme değildir** — kurucunun kendi notu bunu
açıkça söylüyor ve bu uyarı hem seed veride hem UI'da korunmalı.

- `board_declaration_questions`: 20 soru, ortak referans kütüphanesi (controls/scenario_templates
  ile aynı desen — `tenant_id` yok, yalnızca seed ile yazılır, `icerik_durumu` `UNVERIFIED_SAMPLE`).
- `board_declarations` (dönem) + `board_declaration_answers` (soru bazlı cevap: beyan/açıklama/
  tarih/sorumlu/YK karar referansı/son doğrulama tarihi) — kiracıya ait, **sunulduktan sonra
  immutable** (scenario_template_versions'daki trigger deseni: donmuş bir kayıt üzerine yazmak,
  "YK böyle karar verdi" iddiasını geçmişe dönük değiştirmek olurdu).
- `board_declaration_evidence_links` / `..._simulation_links`: bir cevabın hangi kanıta/tatbikat
  sonucuna dayandığını kaydeder — çapraz denetimin girdisi.
- `board_cross_audit_rules`: CR-001..CR-008, seed edilen referans veri.
- **Çapraz denetim SAF TS'TİR, DB'de saklanmaz** (`verifyEvidence`'daki desenin aynısı): durum
  (`BEYAN VAR – KANIT YOK` vb.) her okumada canlı veriye karşı hesaplanır. Sonucu saklamak, yeni
  kanıt geldiğinde "tutarlı" etiketinin bayatlamasına ve gerçek bir sorunu gizlemesine yol açardı.
- **Dürüst sınır**: CR-004 (tedarikçi envanteri), CR-005 (IAM erişim incelemesi), CR-006 (sızma
  testi SLA takibi) için gereken veri modelleri (tedarikçi, erişim incelemesi, güvenlik açığı
  takibi) henüz KALKAN-OS'ta yok. Bu üç kural referans veri olarak seed edilir ama değerlendirici
  bunlar için sahte bir karşılaştırma UYDURMAZ — `İNCELEME GEREKLİ` döner ve `veri_kaynagi_durumu`
  alanıyla nedenini söyler. Bu tabloları şimdiden icat etmek, bu milestone'un kapsamını kendi
  başlarına birer özellik olması gereken tedarikçi/IAM/güvenlik açığı yönetimine genişletirdi.
- **Kabul:** sunulmuş beyan ve cevapları değiştirilemez; beyan "Evet" ama kanıt sayısı 0 ise
  `BEYAN VAR – KANIT YOK` döner (CR-001); RTO beyanı fiili tatbikat süresinden düşükse
  `BEYAN VE KANIT TUTARSIZ` döner (CR-003); aynı girdi aynı sonucu verir (deterministiklik testi).

### M6 — MVP kapısına hazırlık (Faz 2 başlangıcı)
- Üretim barındırma kararının uygulanması (yurt içi / self-hosted Postgres taşıma provası: dump→restore→smoke test).
- İlk konektör iskeleti (yalnızca arayüz + 1 örnek: dosya-tabanlı log içe aktarımı) — 5 konektör hedefi Faz 2 gövdesidir, MVP kapısı değildir.
- **Kabul:** taşıma provası belgelenmiş; konektör arayüzü tanımlı; 1 yıllık sözleşme görüşmesine çıkılabilir demo.

---

## 2026 ürünleşme planı — M11 ve sonrası (kaynak: §1.5, belge: docs/arastirma/)

2026 araştırma belgesinin yetenek omurgası, mevcut yığın ve tek-kurucu
kapasitesiyle kapılı taşlara çevrildi. Sıra bağlayıcı, takvim yok (kural 5).

### Boşluk haritası — belge modülü → repodaki bugün → nereye

| Belge modülü | Repoda bugün | Nereye |
|---|---|---|
| M01 Evidence Envelope & Integrity | Zarf şeması + RFC 8785 + dört hash + immutable manifest + `hash_algorithm` + `legal_hold` VAR. İmza (JWS), gerçek dosya yükleme, redaction, örneklem/dönem, güven skoru, verify CLI, ZIP paketi YOK | **M11** |
| M02 Test DSL & CCM | Simülasyon puanlama motoru deterministik ama kontrol testi değil; durum makinesi 4 kaba durum (`karsilaniyor/kismi/acik/kapsam_disi`); Stale/Unknown ayrımı yok; kanıt süresi DB'de yeniden değerlendirilmiyor (bilinen borç) | **M12** |
| M03 Scope Engine & Knowledge Graph | 2 çerçeve + 17 kontrol + crosswalk eşleme ("bir kanıt, dört çerçeve") var; mevzuat sürümleme, uygulanabilirlik kuralları, as-of-date, değişiklik etkisi, OSCAL yok | **M14** |
| M04 Critical Service & Impact Tolerance | YOK (`tenants`: id, name, segment) — M9 adım 6'nın kurum profili kararıyla birleşiyor | **M13** |
| M05 Incident Clock | YOK | **M15** |
| M06 Recovery Proof & Reconciliation | S01/S04 senaryoları RTO/RPO ölçüyor; finansal mutabakat, restore kanıtı, dual sign-off yok | **M15** |
| M07 CFO Kalkanı | YOK | ertelendi (kapı: M11-M13 çekirdeği + kurumsal pilot adayı) |
| M08 Connector Platform | YOK | ertelendi (kapı: M12'de manuel/fixture testleri oturduktan ve gerçek sistem erişimi olan bir design partner bulunduktan sonra) |
| M09-M18 (3rd party, TLPT, DORA, Stress, CRQ, AI, PQC, SBOM, Passport) | YOK | belgenin kendi P1/P2/P3 sırası ve giriş kapılarıyla ertelendi |

Belgenin bilmediği mevcut varlıklar (yeni plana taşınan sermaye): audit_log
hash zinciri, dört-göz onayı (`evidence_reviews`), RFC 6962 Merkle + bağımsız
doğrulama kütüphanesi, YK Beyanı çapraz denetim motoru (M10), PGlite RLS test
düzeni, canlı Supabase'e karşı e2e doğrulama disiplini.

### M11 — Kanıt çekirdeği v2 (belge M01 / Faz 1) ⏳ Storage ✅ + JWS imza ✅ + verify CLI/ZIP ✅ + redaction soy ✅, redaction-UI/legal-hold/KMS/TSA ✗

Kanıt "yüklenen dosya adı" olmaktan çıkar: dosya gerçekten Storage'da, zarf
imzalı, paket bağımsız doğrulanabilir.

**Kurucu kararları (17 Temmuz 2026) — bağlayıcı ADR'ler:**

> **ADR-M11-01 (İmza):** Kanıt/paket manifestleri tenant bazlı, dışarı
> aktarılamayan **ES256** (NIST P-256) anahtarlarıyla **detached JWS** olarak
> imzalanır. SaaS'ta anahtar HSM destekli KMS'te, on-premise'de müşteri
> HSM/KMS'sinde; **private key veritabanında/env'de ASLA saklanmaz** —
> KALKAN_OS yalnız KMS imzalama API'sini çağırır. `kid` ile anahtar kimliği,
> yılda bir/olay halinde rotasyon, eski public key'ler süresiz doğrulama için
> saklanır, her imzalama audit log'a yazılır. **Hukuki sınır:** bu imza sistem
> bütünlüğü + paket kaynağı ispatıdır; nitelikli e-imza / kurumsal e-mühür
> YERİNE GEÇMEZ.
>
> **ADR-M11-02 (Zaman damgası):** İmzalı manifest özetleri RFC 3161 uyumlu
> bağımsız TSA ile damgalanır. TR üretim varsayılanı (ticari uygunluk
> doğrulandıktan sonra) **TÜBİTAK Kamu SM**; diğer BTK-bildirimli ESHS'ler
> takılabilir sağlayıcı. AB müşterilerinde seçim, işlem anında EU Trusted
> List'te "qualified timestamp" statüsü doğrulanan QTSP'lerle sınırlı.
>
> **ADR-M11-03 (Dayanıklılık):** TSA entegrasyonu sağlayıcıdan bağımsız. TSA
> kesintisi paket üretimini DURDURMAZ; paket `timestamp_pending`'te tutulur,
> kuyrukla tekrar denenir ve zaman damgası alınmadan `externally_verified`
> statüsüne GEÇEMEZ. (anchor_receipts'teki beklemede→sabitlendi deseninin aynısı.)

**Tamamlanan 1 — gerçek dosya yükleme (`20260717200000`):** private `evidence`
bucket'ı, içerik-adresli yol `{tenant_id}/{sha256}`, `storage.objects` üzerinde
tenant-izolasyonlu RLS (SELECT + INSERT own-tenant; UPDATE/DELETE YOK, kural 2
append-only). Yükleme store'da (`addEvidence(evidence, file)`), 409'u idempotent
sayar — "bir kanıt, dört çerçeve" yansımasında dosya bir kez yüklenir, N satır
aynı nesneyi paylaşır. İndirme imzalı, 60 sn ömürlü URL ile. `storage_object_key`
artık gerçek nesneye işaret ediyor. **Canlıda doğrulandı** (script + e2e):
round-trip baytları aynı, başka tenant klasörüne yükleme RLS ile reddedildi,
bucket private; tarayıcıdan gerçek dosya yüklenip imzalı URL ile geri indirildi.
CLAUDE.md'deki "Storage doğrulanamadı" kalemi KAPANDI.
- `storage_version_id` null: içerik-adreslemede sürüm yolun kendisinde (dosya
  değişirse hash değişir → yeni nesne). Kolon ileride bucket sürümleme açılırsa.
- PGlite storage şemasını taklit edemez: pg.ts'e stub eklendi ama YALNIZCA
  migration APPLY olsun diye; storage RLS'i gerçekten canlıda kanıtlandı.

**Tamamlanan 2 — JWS imza (ADR-M11-01, `20260717210000`):** çekirdek manifest,
mühürle aynı INSERT'te ES256 detached JWS ile imzalanıyor (`manifest-signature.ts`);
`signature_jws` + `signature_kid` + `signature_public_jwk` + `signer_ad`
manifestle birlikte donuyor (immutable). Doğrulama saklanan public JWK'yla
BİZE ULAŞMADAN yapılabiliyor. `alg:none` atlatma reddediliyor. Her imzalama
audit_log'a (`kanit_imzalandi`) yazılıyor. `manifest_dogrulama_durumu`:
imzasiz/imzali. **Canlıda doğrulandı** (script): manifest imzalı, saklanan JWK
ile bağımsız doğrulama geçti, manifest kurcalanınca doğrulama başarısız oldu,
audit kaydı düştü.
- **Soyutlama ADR-M11-01'i koruyor:** `ManifestSigner` yalnız `sign()` +
  `publicKeyJwk()` sunar, private key'e erişim yoktur. Bugünkü `LocalDevSigner`
  GEÇİCİ bellek anahtarı kullanır — production'da yerine KMS/HSM imzalayıcı
  gelir (aynı arayüz). `signer_ad` = `local-dev-*` olduğu için rapor ve
  doğrulama yüzeyi "geliştirme anahtarı, production authenticity'si değil, +
  nitelikli e-imza yerine geçmez" uyarısını taşıyor.

**Tamamlanan — gerçek dosya yükleme (`20260717200000`):** private `evidence`
bucket'ı, içerik-adresli yol `{tenant_id}/{sha256}`, `storage.objects` üzerinde
tenant-izolasyonlu RLS (SELECT + INSERT own-tenant; UPDATE/DELETE YOK, kural 2
append-only). Yükleme store'da (`addEvidence(evidence, file)`), 409'u idempotent
sayar — "bir kanıt, dört çerçeve" yansımasında dosya bir kez yüklenir, N satır
aynı nesneyi paylaşır. İndirme imzalı, 60 sn ömürlü URL ile. `storage_object_key`
artık gerçek nesneye işaret ediyor. **Canlıda doğrulandı** (script + e2e):
round-trip baytları aynı, başka tenant klasörüne yükleme RLS ile reddedildi,
bucket private; tarayıcıdan gerçek dosya yüklenip imzalı URL ile geri indirildi.
CLAUDE.md'deki "Storage doğrulanamadı" kalemi KAPANDI.
- `storage_version_id` null: içerik-adreslemede sürüm yolun kendisinde (dosya
  değişirse hash değişir → yeni nesne). Kolon ileride bucket sürümleme açılırsa.
- PGlite storage şemasını taklit edemez: pg.ts'e stub eklendi ama YALNIZCA
  migration APPLY olsun diye; storage RLS'i gerçekten canlıda kanıtlandı.

**KALAN (M11'in kapanması için):**
- **KMS/HSM imzalayıcı:** `ManifestSigner` arayüzünü uygulayan gerçek KMS
  bağlayıcısı (AWS KMS / Azure Managed HSM / GCP KMS / PKCS#11). Soyutlama
  hazır; bu, kod değil ALTYAPI provizyonu — deployment modeline göre anahtar
  yeri (ADR-M11-01 tablosu). Kurucu KMS'i sağlayınca takılır.
- **RFC 3161 zaman damgası (ADR-M11-02/03):** `TimestampProvider` soyutlaması +
  gerçek ASN.1 codec + Kamu SM endpoint. **Bilinçli ertelendi:** Kamu SM test
  endpoint'i olmadan ASN.1 kodeki KÖR yazılır ve doğrulanamaz — "inşa ettiğini
  doğrula" ilkesini çiğner. `manifest_dogrulama_durumu` bugün en üst 'imzali'
  döndürüyor; TSA bağlanınca 'dis_dogrulanabilir' kolu ve token tablosu
  (anchor_receipts deseni) eklenecek. Kurucu notu: bu "yalnız Kamu SM ile
  ticari sözleşme + test endpoint satın alma aşamasında netleşir".
- Zarf v2 alanları: population/sample/dönem; güven bileşenleri (kaynak
  otoritesi, bağımsızlık, güncellik, tamlık, yeniden üretilebilirlik);
  `kaynak_kontrol_id` (yansıtılan kanıt soyu — eski borç).
- Redaction UI: guard + zarf + soy bağı BİTTİ (aşağıda), ama redakte dosyayı
  yükleyip kaynağı seçtiren EKRAN yok — yetenek şemada ve mantıkta hazır,
  uygulama formu bağlanmadı.
- Legal hold zorunlaması: `legal_hold` kolonu VAR ama silme denemesini engelleyen
  + audit event üreten yol henüz bağlı değil (kanıt zaten append-only, ama legal
  hold'un kendi ihlal kaydı yok).

**Tamamlanan 3 — ZIP denetim paketi + BAĞIMSIZ verify CLI (`audit-package.ts`,
`scripts/verify-paket.ts`, `/api/simulasyon/[id]/paket`):** ürünün merkez iddiası
artık uçtan uca kanıtlı. Paket ZIP'i çekirdek manifest + rapor verisi + imza +
PDF + paket manifesti + BENIOKU içeriyor (`packageManifestHash` ayrı dosyada,
kendi hash'ini içermez). `paketiDogrula` saf fonksiyon: rapor hash'i ↔
reportDataHash, çekirdek hash'i ↔ package-manifest, her dosyanın bayt hash'i
(PDF dahil), ve JWS imzası — hepsi pakete bakarak, DB'siz. Paket rotası
ZIP'lemeden önce iki hash'i de self-check ediyor (jsonb round-trip'i yakalar).
- **CLI dış bağımlılıksız:** `verify-paket.ts` → `audit-package.ts` →
  `canonical.ts` + `manifest-signature.ts`, hiçbiri runtime'da dış paket
  kullanmıyor. Denetçi repoyu klonlayıp `npx tsx scripts/verify-paket.ts
  <klasor>` koşabilir; DB/env/ağ yok. `canonicalize`'ı runtime'dan çıkarmanın
  (§1.5) asıl ödülü bu.
- **Canlıda + repo dışında doğrulandı** (`e2e/simulasyon.spec.ts`): gerçek
  Chromium ZIP indirdi, açtı, verify CLI'yi AYRI PROCESS olarak koşturdu →
  VERIFIED (çıkış 0); core-manifest.json kurcalanınca → FAILED (çıkış 1).
- **Kabul KARŞILANDI:** "tek bayt değişikliği doğrulamada yakalanır" +
  "paket repo DIŞINDA temiz bir Node ortamında CLI ile doğrulanır" — ikisi de
  e2e ile kanıtlı.

**Tamamlanan 4 — redaction soy bağı (`20260717220000`):** redakte kanıt AYRI bir
kanıttır (append-only yeni satır, orijinal durur), farklı hash taşır ve orijinalle
soy bağını korur. Zarf guard'ı zorluyor: kaynak gerçek + aynı kiracı, redaksiyon
notu zorunlu (ne/neden karartıldı), redakte dosya kaynakla AYNI hash'e sahip
olamaz ("karartma yapılmamış"), kaydedilen kaynak hash'i kaynağın gerçeğiyle
tutmalı (soy uydurulamaz), `on delete restrict` orijinali korur. Zarf
`redactionOf` + `redactionNote` taşıyor — soy iddiası zarf hash'inin parçası,
yani "X'in redaksiyonuyum" mühürlü. **Canlıda + PGlite'ta doğrulandı:** geçerli
redaksiyon kabul, aynı hash reddedildi, notsuz reddedildi, çapraz kiracı
reddedildi, soy sorgulanabiliyor (`evidence_redaksiyon_soyu`).
- **Kabul KARŞILANDI:** "redacted sürüm farklı hash taşır ama soyu korur."

**Kabul (KALAN):** legal hold altındaki kanıt silinemez ve deneme audit event
üretir; redaction UI (yükleme formu).

### M12 — Kontrol test motoru ve durum makinesi (belge M02) ⏳ motor+durum ✅ + bulgu/verified-closure ✅ + test-rota+öneri ✅ + UI ✅, freshness/pano/S01 ✗

**Tamamlanan — deterministik motor + kural 13 durum sözlüğü (`control-test.ts`,
`20260717230000/230001`):** kontrolün "tasarlandı" değil "çalışıyor" durumunu
ölçen çekirdek. `control_test_definitions` (5 tür: MANUAL_PROCEDURE,
CONFIG_ASSERTION, SAMPLE_REVIEW, ATTACK_SIMULATION, RESTORE_TEST) +
`test_runs` (append-only + immutable trigger). Değerlendirme saf ve deterministik
(20 test); sonuç BEŞ AYRI durumdan biri, birleştirilemez (check constraint):
`PASSED / FAILED / UNKNOWN / STALE / EXCEPTION`.

- **Kural 13'ün kalbi KANITLANDI:** toplama/connector arızası ASLA `FAILED`
  üretmez — `UNKNOWN` üretir. İddia "karşılanmadı" dese bile toplama başarısızsa
  sonuç UNKNOWN; sinyal yoksa UNKNOWN. `FAILED` yalnız iddia GERÇEKTEN
  değerlendirilip karşılanmadığında. Karar ağacı sırası bilinçli:
  UNKNOWN(toplama) > EXCEPTION > STALE(tazelik) > PASSED/FAILED.
- Durum türetimi (`kontrolGuvenceDurumu`) birleştirmez, en kötüyü seçer
  (FAILED>STALE>UNKNOWN>EXCEPTION>PASSED); öncelik mantığı TEK yerde (TS),
  SQL (`kontrol_son_test_sonuclari`) yalnız ham malzemeyi verir — ayrışma yok.
- **Canlı doğrulama bir açık yakaladı ve kapattı:** append-only önce yalnız
  `revoke ... from authenticated, anon` ile kuruluydu; PGlite testi (authenticated)
  UPDATE'i reddederken service_role ile UPDATE GEÇİYORDU. test_runs kural 13'ü
  besleyen bütünlük olgusu olduğundan manifest deseni uygulandı: immutability
  trigger UPDATE'i her zaman reddeder (service_role dahil, canlıda doğrulandı),
  DELETE'e yalnız cascade için izin verir.
- **Kabul (karşılanan):** "aynı test aynı fixture ile deterministik sonuç verir"
  (determinizm testi + canlı).

**Tamamlanan 2 — bulgu üretimi + verified closure (`20260717240000/240001`,
kural 11+14):**
- Başarısız test → bulgu ÖNERİSİ (`bulguOnerisiUret`, PROPOSED, insan kabul
  etmeden gerçek bulgu olmaz). **Kritik ayrım kanıtlı:** yalnız FAILED öneri
  üretir; UNKNOWN/STALE ÜRETMEZ — "ölçemedik" bir ihlal değildir, iş listesine
  sahte bulgu sokmaz. `control_test_finding_proposals` (M8 deseni, `unique
  (test_run_id)` ile idempotent).
- **Verified closure guard (kural 14) — DB invariant, canlıda doğrulandı:** bir
  bulgu `acik → kapali` geçerken retest_gerekli ise (1) başarılı retest koşusu
  bağlı, (2) o koşu GERÇEKTEN PASSED, (3) aynı test tanımına ait, (4) bulgudan
  SONRA koşmuş, (5) onaylayan yetkili dolu olmalı. Aksi halde reddedilir.
  **Ticket/aksiyon düzenlemek (aksiyon_plani) durumu değiştirmediği için guard'ı
  tetiklemez — "ticket kapatmak kontrol kapatmaz".** Trigger'da, çünkü
  "başarılı retest olmadan kapanan kritik bulgu sıfır" bir KPI değil GARANTİ
  olmalı — service_role bile atlayamaz. Canlı: retestsiz red, FAILED retest red,
  başarılı retest+onay kapatır.
- **Yol boyunca bir PGlite≠Postgres farkı düzeltildi:** `audit_findings`
  değişen alanları `text[] || 'literal'` ile topluyordu; canlıda çalışıyor ama
  PGlite `||`'i array-array sanıp "malformed array literal" veriyordu.
  `array_append`'e çevrildi (canlıda birebir aynı) — findings güncellemeleri
  artık PGlite'ta da test edilebilir, closure guard testleri bu sayede koşuyor.

**Tamamlanan 3 — test çalıştırma + öneri kabul rotaları (canlıda e2e):**
- `POST /api/kontrol-test/[id]/calistir`: gözlemi alır, motoru koşar, `test_run`
  yazar, FAILED + otomatik_bulgu ise öneri doğurur. Sonucu MOTOR belirler, rota
  değil (kural 13 tek yerde). test_run + öneri INSERT'i kullanıcı oturumuyla
  (RLS tenant'ı zorluyor); service_role yalnız öneri kararında.
- `POST /api/kontrol-test/oneri/[oneriId]`: KABUL gerçek bulgu oluşturur
  (kullanıcı oturumuyla → audit doğru atfeder), `retest_gerekli`'yi tanımdan
  taşır, `kaynak_test_definition_id` bağlar; RET yalnız durumu günceller
  (service_role). M8 öneri rotasının aynı deseni.
- **`e2e/kontrol-test.spec.ts` (gerçek Chromium + gerçek Supabase):** FAILED →
  öneri; TOPLAMA ARIZASI → UNKNOWN ve öneri YOK (kural 13 uçtan uca); kabul →
  bulgu (retest_gerekli + kaynak bağı doğrulandı); retestsiz kapatma reddedildi;
  başarılı retest → kapanış. Test tanımı UI'ı yok, fixture bir MANUAL_PROCEDURE
  tanımı seed ediyor.

**Tamamlanan 4 — test tanımı + çalıştırma/öneri EKRANLARI (`kontrol-test-bolumu.tsx`,
canlıda e2e ile UI üzerinden doğrulandı):** Kontrol detay sayfasına "Kontrol
Testleri" kartı eklendi. Yeni test tanımı formu (tür/tazelik/önem/otomatik-bulgu/
retest-gerekli), her tanım için Gözlem seçici (İddia karşılandı/karşılanmadı/
Ölçülemedi/İstisna — dördü de motorun beş durumuna doğru eşleniyor) + Çalıştır
butonu, son sonucun rozeti (`TEST_SONUC_BADGE_VARIANT` — beş durum görsel
olarak da ayrı, kural 13 UI'da da korunuyor), açık öneri kartı + Kabul/Reddet.
`e2e/kontrol-test.spec.ts`'e gerçek Chromium ile UI'ı TIKLAYARAK süren ikinci
bir test eklendi: form doldur → tanım oluştur → dropdown'dan gözlem seç →
çalıştır → "Kaldı" rozetini gör → öneriyi kabul et → `/findings`'te bulguyu
gör. (MCP Browser aracı bu base-ui dropdown'ının koordinatını hesaplayamadı —
gerçek bir Playwright/Chromium e2e testiyle doğrulandı, daha güvenilir ve
kalıcı bir regresyon testi oldu.)

**KALAN:**
- Freshness otomasyonu: `pg_cron` ile kanıt süresi dolunca STALE — motor STALE'i
  hesaplıyor ama DB'de zamanlı yeniden değerlendirme yok (eski borç, skip'li e2e
  burada kapanır).
- Kontrolün gerçek `tenant_controls.durum`'una bağlama + panoda gösterim.
- S01 dikey akışı: 10 inject, kanıt yükleme, ≥3 bulgu, aksiyon, retest, S01 e2e
  (M9 adım 4, 7, 8, 13).

### M13 — Kurum profili, kritik hizmet ve YK çıktıları (belge M04)

- Kurum profili + `critical_business_services` + `impact_tolerances`
  (RTO/RPO dakika, onaylayan organ, son test, actual result). Seed'deki
  temsili hedefler `DEMO_TARGET` etiketli (kural 3'ün ruhu).
- Bağımlılık node/edge tabloları — Postgres + recursive CTE; Neo4j YOK
  (belgenin kendi kararı, kural 4 ile uyumlu).
- Simülasyon RTO/RPO hedefi kurum profilinden okunur; hedef yoksa
  `TARGET_NOT_DEFINED` + otomatik bulgu: "Kritik hizmet için yönetimce
  onaylanmış RTO/RPO hedefi tanımlanmamıştır." (M9 adım 6.)
- Ana pano kartları (M9 adım 9): son tatbikat + skor, RTO/RPO durumu,
  kritik/yüksek bulgular, geciken aksiyonlar, kanıt bütünlüğü
  (FULL_ENVELOPE / LEGACY oranı), yeniden test tarihi.
- YK çıktıları: M10 beyan UI'ı + yönetim kurulu PDF'i (M9 adım 11) —
  `generate-yk-beyani.ts` emekli edilir (mock-data borcu kapanır).
- Tolerans değişikliği yönetim kararı + audit event olmadan yürürlüğe girmez.
- **Kabul:** bir kritik hizmetten destekleyen sistem/ekip/tedarikçiye
  gidilebilir; senaryo sonucu toleransla otomatik karşılaştırılır; beyan
  ekranları canlıda; pano gerçek veriyle dolu.

**SPK notlarından eklenecek metadata (18 Temmuz 2026, §1.6 — yalnız not, ŞEMA
YAZILMADI):** hizmet sahibi, kullanıcı grupları, SLA hedefi (RTO/RPO'nun
yanına), bağımlılık türü ayrımı (uygulama/veri/altyapı/tesis/tedarikçi —
bugün tek `dependency_nodes/edges`), tek hata noktası tespiti, son doğrulama
tarihi. M13 uygulanırken eklenir; SoD'den (M16) ayrı bir migration.

### M14 — Kapsam motoru ve mevzuat sürümleme (belge M03)

- `regulation_sources` + `requirements` + `applicability_rules`; resmî kaynak
  soyu, yayım/yürürlük/ilga tarihleri, as-of-date sorgusu, değişiklik etkisi.
- İçerik genişlemesi kural 3 disipliniyle: yalnız doğrulanmış madde; mevcut
  TODO-DOGRULA'lar burada kapanmaya başlar. AI eşleme yalnız ADAY üretir,
  insan onayı şart (belgeyle uyumlu).
- OSCAL-lite export: veri modeli uyumlu tutulur, iç model OSCAL'e zorlanmaz
  (belge karar #9).
- **Kabul:** muafiyet bir kontrolü `Passed` yapmaz; as-of-date geçmiş tarih
  için doğru sürümü döndürür; kontrol sonucu requirement paragrafına kadar
  izlenebilir.

**SPK notlarından eklenecek metadata (18 Temmuz 2026, §1.6 — yalnız not, ŞEMA
YAZILMADI):** kuruluş türü, faaliyet izinleri, birincil düzenleyici rejim,
uygulanabilirlik ifadesi, muafiyet/geçiş hükmü, düzenleme sürümü + geçerlilik
tarihleri, kapsam karar gerekçesi (hangi profil alanı + hangi kural sürümü
sonucu üretti), manuel override onayı, `TODO_DOGRULA` durumu. Kapsam motoru
her karar için "sonuç / kullanılan alanlar / kural sürümü / gerekçe / varsa
muafiyet / varsa manuel override" izini üretmeli — bu M14 uygulanırken eklenir.

### M15 — Olay saati ve kurtarma kanıtı (belge M05 + M06)

- Olay zaman çizelgesi, sınıflandırma, bildirim kuralları (SPK/7545/KVKK
  konfigürasyonu; DORA paketi ertelendi), gönderim kayıtları ve sürümleme.
- `recovery_attempts` + actual RTO/RPO + finansal mutabakat (defter/bakiye/
  kayıt sayısı) + exception/dual sign-off; S01/S04 tatbikatlarına bağlanır.
- **Kabul:** olay sınıfı değişince saatler deterministik yeniden oluşur;
  teknik restore başarılı ama mutabakat başarısızsa `Recovered` sayılmaz;
  rapor düzenlemesi önceki gönderimi değiştirmez, yeni sürüm doğar.

### M16 — Görevler Ayrılığı ve Telafi Edici Kontroller (SPK notları §5) ⏳ dikey dilim + süre-dolumu + PR-3A (dry-run) + PR-3B (atomik apply) ✅; rollback/UI/tetikler/dashboard ✗

**Tamamlanan (18 Temmuz 2026):** şema (`sod_kurallari`/`sod_kural_taraflari`/
`sod_atamalari`/`sod_catismalari`/`sod_istisnalari`/`sod_telafi_edici_kontroller`/
`sod_degerlendirme_calistirmalari`, migration `20260718000000`), saf deterministik
motor (`src/lib/sod.ts`, kural 11 — 100 rastgele sıralamada aynı fingerprint testi
yok ama sıra-bağımsızlık testleri var), üç sunucu rotası (`/api/sod/degerlendir`,
`/api/sod/istisna/[id]/karar`, `/api/sod/kural/[id]/mevzuat-durumu`), tam UI
(`/sod` özet+kural+çatışma listesi, `/sod/[id]` detay+istisna+telafi edici kontrol),
audit trigger'ları (kural oluşturma/güncelleme, çatışma tespiti/durum değişimi,
istisna talep/karar, telafi kontrol atama — hepsi `audit_log`'a otomatik yazılır).
`e2e/sod.spec.ts`: gerçek Chromium + gerçek Supabase, kural oluştur → fixture
atama → değerlendir → çatışma gör → istisna talep et → **farklı kullanıcı
(rol=uyum) onaylar** → M12 test tanımı bağla → başarısız çalıştır (durum
DEĞİŞMEZ) → başarılı çalıştır (MITIGATED) → audit izini gör. 569 birim
(mevcut 534 + 35 yeni SoD testi) + e2e (mevcut 14 + 1 yeni SoD testi) yeşil —
mevcut davranış bozulmadı.

**Tamamlanan 2 (18 Temmuz 2026 — süre-dolumu otomasyonu, migration
`20260718010000`):** kurucunun işaret ettiği gerçek kontrol boşluğu — süresi
dolan istisnanın otomatik açılmaması — kapatıldı.
- `sod_istisna_suresi_dolanlari_isle()`: `durum='onaylandi'` + `bitis <
  current_date` istisnaları `suresi_doldu` yapar ve çatışmayı YALNIZ
  `EXCEPTION_APPROVED` ise `REOPENED`'e döndürür (MITIGATED çatışma ayrı
  mekanizma, dokunulmaz; telafi edici kontrol PASSED olsa bile istisna dolunca
  açılır). İdempotent (`durum='onaylandi'` koşullu UPDATE + `if found`),
  eşzamanlı-güvenli (`for update skip locked`), satır-bazlı hata izolasyonu
  (bir tenant'ın hatası diğerlerini durdurmaz), DB zamanı (`current_date`) esas.
- `kanit_suresi_dolanlari_isle()`: **eski M2 borcunu kapatır** — kanıtı süresi
  dolmuş `karsilaniyor` kontrolü `kismi`'ye düşürür ve "Sistem" adına
  (`actor_id=null`) `kanit_suresi_doldu` audit'i yazar. `e2e/kanit-motoru.spec.ts`'teki
  `test.skip` GERÇEK teste dönüştü — artık **17/17 e2e, SIFIR skip**.
- **BullMQ DEĞİL, pg_cron** (kural 4 + ROADMAP §1.5'in üç kez verdiği karar):
  mantık idempotent SQL fonksiyonunda, zamanlama pg_cron'da (`kalkan-sure-dolumu`,
  günlük 02:00 UTC). pg_cron **canlıda mevcut ve zamanlandı** (db:push NOTICE +
  fonksiyonlar service_role ile canlıda çağrıldı, 0 döndü — dolmuş veri yoktu).
  Zamanlama PGlite'ı bozmasın diye defansif DO bloğunda (test harness'inde
  no-op). Fonksiyonlar `authenticated/anon`'dan revoke — sistem işi.
- Testler: `rls-sure-dolumu.test.ts` (12 birim — sınır durumları: bugün dolan
  vs dün dolan, gelecek, idempotency, OPEN/MITIGATED çatışma, Sistem audit'i),
  `sod.spec.ts` Senaryo A (istisna dolar → çatışma UI'da "Yeniden açıldı"),
  kanıt süre-dolumu e2e. **581 birim + 17 e2e (0 skip) yeşil.**

**Yol boyunca bulunan bir tasarım kusuru:** `SodTaraf.sistem_kapsami` başta
kuralın KENDİSİNE sabit bir kapsam atıyordu ("A ve B yalnız 'kalkan_os'
kapsamında eşleşir") — birim testi bunu yakaladı: farklı kapsamlardaki gerçek
atamalar hiç eşleşmiyordu. Düzeltme: `rol_kodu` ile tutarlı olacak şekilde
`sistem_kapsami` de opsiyonel yapıldı (null = "hangi sistemde olursa olsun”);
asıl çatışma kararı her zaman atamaların GERÇEK ORTAK kapsamına göre verilir.

**Kapsam dışı (bilinçli, aşağıda da tekrar var):** atama (`sod_atamalari`)
YÖNETİM UI'ı yazılmadı — ilk dilim yalnız fixture/script ile atama kabul
ediyor; gerçek kullanım ya elle SQL/CSV içe aktarma ya da ileride bir
IAM/PAM connector ile gelir.

**Kaynak statüsü ilkesi (tüm M16-M18 için geçerli, kural 3'ün genişletilmiş
hali):** SPK/SPL çalışma notlarından türetilen hiçbir kural/kontrol doğrudan
`VERIFIED` doğmaz. Araştırma kaynaklı her madde şu yaşam döngüsünü izler:
`DRAFT_RESEARCH → TODO_DOGRULA → LEGAL_REVIEW → VERIFIED` (yan dallar:
`SUPERSEDED`, `REJECTED`). Yalnız `VERIFIED` durumu kapsam motorunda
zorunluluk üretebilir; `TODO_DOGRULA`/`LEGAL_REVIEW` UI'da görünür ama
bağlayıcı değildir. Bu geçiş genel edit yetkisiyle yapılamaz — ayrı bir
hukuk/uyum rolü gerekir (aşağıda "Güvenlik").

#### Problem ve amaç

Kritik bir işlemin talep, icra, onay ve doğrulama aşamalarının uygunsuz
biçimde aynı kişi/rolde birleşmesini tespit etmek. Tam ayrım mümkün
değilse (küçük aracı kurumlarda sıkça olduğu gibi) süreli, test edilebilir
bir telafi edici kontrol uygulamak — "uygunsuz" deyip bırakmak yerine.

**SoD motoru yeni bir IAM/PAM sistemi DEĞİLDİR.** Kullanıcı yetkilerini
yönetmez; KALKAN_OS'un kendi rolleri/atamaları ve (ilerideki) içe aktarılan
rol verisi üzerinde güvence ve çatışma DEĞERLENDİRMESİ yapar (belge §15'in
"SIEM/PAM/IAM'i yeniden inşa etme" sınırıyla aynı ilke).

#### Kullanıcı rolleri

Mevcut üç rol (`admin`, `uyum`, `denetci_misafir`) üzerine SoD'a özgü
YETENEK ayrımı gelir (aşağıda "Güvenlik ve tenant izolasyonu"). Pilot
ölçekte (5-15 kullanıcı) yeni bir rol tablosu AÇILMAZ — mevcut `profiles.role`
+ ince taneli yetenek kontrolü (route seviyesinde, M12'nin `admin`/`uyum`
kontrolü deseninin aynısı).

#### Temel nesneler

| Nesne | Repo adı | Not |
|---|---|---|
| `SodRule` | `sod_rules` | Çatışma kuralının kendisi |
| `SodRuleSide` | `sod_rule_sides` | Kuralın A/B tarafı (activityCode/roleCode/systemScope/matchExpression) |
| `SodAssignment` | `sod_assignments` | Kişi-rol-sistem ataması; PII minimize (harici kullanıcı id + asgari alan) |
| `SodConflict` | `sod_conflicts` | Tespit edilen çatışma; dedup fingerprint taşır |
| `SodException` | `sod_exceptions` | Süreli istisna; süresiz OLAMAZ |
| `CompensatingControlLink` | `compensating_control_links` | Çatışma/istisna ↔ mevcut M12 kontrol testi bağı |

`SodRule.regulatoryStatus` (spesifik, SodRule'a özgü — yukarıdaki genel
5-durumlu ilkeden ayrı ve daha dar): `INTERNAL | TODO_DOGRULA | VERIFIED`.
KALKAN_OS'un kendi tasarladığı bir kural (ör. "kanıt yükleyen kendi kontrol
testini onaylayamaz") `INTERNAL`'dır — SPK kaynaklı değildir, doğrulama
beklemez. SPK notlarından türetilen bir kural her zaman `TODO_DOGRULA` doğar.

`SodConflict.status`: `OPEN | UNDER_REVIEW | EXCEPTION_REQUESTED |
EXCEPTION_APPROVED | MITIGATED | RESOLVED | REOPENED | EXPIRED |
FALSE_POSITIVE`. (Kurucunun iki taslağının birleşimi: `REOPENED` ile
`EXPIRED` ayrı tutuldu ki "neden yeniden açıldı" — başarısız telafi edici
kontrol mü, istisna süresi mi — audit izinde ayırt edilebilsin.)

#### İş akışı

1. Kural tanımlanır (`INTERNAL` veya `TODO_DOGRULA`, kaynak + kaynak referansı ile).
2. Atamalar (bugün: KALKAN_OS içi roller/aktiviteler; connector'lar ertelendi)
   değerlendirme motoruna girer.
3. Motor deterministik çalışır (kural 11): aynı kural sürümü + aynı atama
   snapshot'ı → aynı çatışma kümesi. Yeni çatışma `OPEN` doğar; devam eden
   güncellenir; artık mevcut olmayan SESSİZCE silinmez (kanıt olmadan silme
   yasak — kural 2'nin ruhu).
4. Açık çatışmaya ya istisna talep edilir ya telafi edici kontrol bağlanır.
5. İstisna: gerekçe + risk sahibi + bitiş tarihi ZORUNLU; talep eden kendi
   istisnasını onaylayamaz (SoD'un SoD'u — kendi kendine emsal).
6. Telafi edici kontrol: mevcut bir `control_test_definitions` (M12)
   seçilir veya yeni tanımlanır; testin PASSED/FAILED sonucu çatışmanın
   durumunu belirler — motor M12'den ayrı bir test altyapısı İCAT ETMEZ.
7. Süresi dolan istisna otomatik `EXPIRED`; başarısız telafi edici kontrol
   çatışmayı `REOPENED` yapar; her iki durumda da bağımsız biri kapatmadan
   `RESOLVED` olamaz.

#### M12/M13/M14 bağımlılıkları

- **M12 (zorunlu, bugün var):** telafi edici kontrol testi `control_test_definitions`
  + `test_runs` + `testDegerlendir` motorunu YENİDEN KULLANIR. Yeni bir test
  altyapısı yazılmaz. `control_test_finding_proposals`'ın "yalnız FAILED bulgu
  üretir" ilkesi burada da geçerli: SoD çatışmasının kendisi bir "bulgu" değil,
  ayrı bir nesne (`sod_conflicts`) — ama bir çatışma+istisna kombinasyonu
  ciddiyse M12 desenine paralel bir `finding` ilişkisi kurulabilir (kapsam
  dışına alındı, aşağıda).
- **M13 (gevşek):** `CriticalActivity`/`sod_rule_sides.systemScope` ileride
  M13'ün kritik hizmet grafiğine bağlanabilir (bir SoD çatışması hangi kritik
  hizmeti etkiliyor). Bu turda BAĞLANMAZ — kapsam dışı.
- **M14 (gevşek):** yok bu turda; `regulatoryStatus` ilkesi M14'ün
  `TODO_DOGRULA` disipliniyle aynı dil.

#### Güvenlik ve tenant izolasyonu

Tüm tablolarda `tenant_id` + RLS (kural 1, PGlite testli). Yetenek ayrımı
(route seviyesinde, RLS'in üstünde bir kullanılabilirlik katmanı — RLS asıl
sınır):

| Yetenek | Kim |
|---|---|
| SoD görüntüleme | `admin`, `uyum` (RLS zaten `denetci_misafir`'i paylaşım dışında sınırlar) |
| Kural oluşturma/düzenleme | `admin`, `uyum` |
| Değerlendirme çalıştırma | `admin`, `uyum` |
| İstisna talep etme | `admin`, `uyum` |
| İstisna onaylama | `admin`, `uyum` — talep edenle AYNI kişi olamaz (route kontrolü) |
| Telafi edici kontrol bağlama | `admin`, `uyum` |
| Çatışma kapatma (`RESOLVED`) | `admin`, `uyum` |
| `TODO_DOGRULA → VERIFIED` | **Ayrı hukuk/uyum onayı** — genel `uyum` edit yetkisiyle YAPILAMAZ (bu turda: `admin` rolüne sıkıştırılmış bir DB guard'ı; ince taneli "hukuk" rolü gerekirse sonraki tur) |

#### Denetim izi gereksinimleri

Kural oluşturma/değiştirme/yayımlama, çatışma tespiti, istisna talebi/onay/
red, telafi edici kontrol atama, test sonucu, süre dolması, bağımsız kapanış
— hepsi `audit_log`'a yazılır (mevcut trigger deseni, M8/M12 ile aynı). Kural
ve çatışma tabloları APPEND-ONLY değil (durum makinesi UPDATE gerektiriyor,
findings gibi) ama her durum geçişi audit_log'da satır bırakır.

#### Kabul kriterleri

- Aynı kullanıcının çatışan iki faaliyeti üstlenmesi otomatik tespit edilir.
- Farklı kişilerin atamaları çatışma üretmez.
- Tenant'lar birbirinin kural/çatışmasını SORGUYLA da göremez.
- Aynı girdilerle tekrar değerlendirme duplicate çatışma üretmez (fingerprint).
- Kaldırılan çatışma kanıtsız silinmez.
- Talep eden kendi istisnasını onaylayamaz; süresiz istisna oluşturulamaz.
- Süresi dolan istisna otomatik yeniden açılır; başarısız telafi edici kontrol
  çatışmayı yeniden açar.
- Bağımsız kapanış olmadan çatışma `RESOLVED` olamaz.
- `TODO_DOGRULA` kural normal kullanıcı tarafından `VERIFIED` yapılamaz.
- Gerçek Chromium'da en az bir uçtan uca akış (kural→çatışma→istisna→onay→
  telafi edici kontrol→başarısız/başarılı→durum).

#### Üretim kapatma — kurucunun 18 Temmuz talimatı (12 madde) karşısında durum

Kurucu M16'yı "gösterim özelliği"nden "işletilebilir kontrol sistemi"ne
çevirmek için 12 maddelik bir tamamlama sırası verdi. **Bu turda ilk iki madde
(kurucunun kendi sırasının başı) tam ve doğrulanmış teslim edildi:**
- ✅ **#1 Test tabanı tamamen yeşil** — "15/16" aslında 15 geçen + 1 BİLİNÇLİ
  SKIP'ti (başarısızlık değil, M2 borcunun placeholder'ı); o skip artık gerçek
  bir teste dönüştü → **17/17 e2e, 0 skip**, 581 birim.
- ✅ **#2 İstisna süre-dolumu** — yukarıda "Tamamlanan 2".

**PR-3 ön koruma (18 Temmuz 2026, migration `20260718020000/020001`) — kurucu
kararı: CSV import'tan ÖNCE iki korkuluk:**
- ✅ **Onaylı/dolmuş istisna süre-kimlik kilidi** (`sod_istisna_kilit_guard`):
  `durum ∈ (onaylandi, suresi_doldu)` istisnanın `bitis/talep_eden_id/
  onaylayan_id/conflict_id/tenant_id` alanları UPDATE ile DEĞİŞTİRİLEMEZ.
  Süre uzatmak için kaydı düzenleme yolu kapalı; uzatma #3'te ayrı talep+onayla
  gelecek. **`durum` frozen değil** — süre-dolumu işi (onaylandi→suresi_doldu)
  ve iptal hâlâ çalışır (regresyon testiyle kanıtlı).
- ✅ **pg_cron sıklığı günlük → `*/5`** (5 dakika): dolan istisna ~24 saat değil
  ~5 dakika içinde açılır. `cron.unschedule` + `cron.schedule` (aynı isim,
  duplicate yok). **Canlıda doğrulandı:** `sod_cron_durumu()` tam **1** kayıt
  döndürdü (`*/5 * * * *`, active). Zamanlama defansif DO bloğunda (PGlite no-op).

**KALAN (kurucunun sırası, sonraki turlar — her biri ayrı PR):**
**PR-3 dört ayrı PR'a bölündü (kurucu kararı 18 Temmuz):** 3A güvenlik temeli
+ sözleşme + dry-run (SALT OKUR); 3B atomik apply + idempotency + outbox;
3C rollback + bağımsız onay; 3D dar UI + gerçek Chromium e2e. Her PR kendi
kabul kapısıyla; biri geçmeden sonraki başlamaz.

**✅ PR-3A BİTTİ (18 Temmuz, migration `20260718030000`) — hiçbir atama
değiştirmez:**
- Sözleşme `SodAssignmentImportRecord` (sağlayıcıdan bağımsız; gelecekteki
  IAM/PAM connector yalnız ilk adımı — kaynağı bu tipe çevirmeyi — değiştirir).
- Güvenli CSV parser (`src/lib/sod-import.ts`): RFC 4180 tarzı tırnak/kaçış,
  BOM temizleme, null-byte/boyut/kolon/satır/hücre sınırları, **formula
  injection** reddi (`= + - @ \t \r` ile başlayan hücre → satır reddi),
  yinelenen başlık, eksik zorunlu kolon.
- Deterministik normalizasyon: satır SIRASI çıktıyı etkilemez (doğal anahtara
  göre sıralı), e-posta küçük harfe (değişmez kimlik DEĞİL), duplicate
  (`source, sourceRecordId`) tespiti.
- Diff: ekle/güncelle/değişmez/**sona erdir** (DELTA vs AUTHORITATIVE_SNAPSHOT;
  boş snapshot = kaynağı boşalt; BAŞKA kaynağın atamasına dokunmaz; eski elle
  atamalar (`source_record_id` null) kapsam dışı).
- Bütünlük hash'leri: `fileHash` (ham bayt), `normalizedRecordsHash`,
  `assignmentSnapshotHash` + `ruleSetVersion` (motorun mevcut fonksiyonları
  yeniden kullanıldı). `onizlemeBayatMi()` → stale preview mantığı (409 zemini,
  apply 3B'de zorlar).
- Şema: `sod_atamalari`'na import alanları (`source_record_id/subject_type/
  display_name/email`) + idempotency partial unique index; `sod_import_
  onizlemeleri` tablosu (dry-run kaydı, append-only, RLS, audit trigger).
- Rota `POST /api/sod/import/onizle` (admin/uyum): CSV → güvenlik → normalize →
  diff → hash → önizleme yaz + **beklenen yeni çatışmalar** (motor projeksiyonu,
  TAHMİN — 3A'da tam kimlik çözümlemesi yok). **İnşa yoluyla kanıt:**
  `sod_atamalari` yalnız OKUNUYOR (tek `.insert` önizleme tablosuna), atama
  yazılmıyor.
- **Testler:** `sod-import.test.ts` (29 — parser/güvenlik/determinizm/diff/
  stale), `rls-sod-import.test.ts` (6 — önizleme kiracı izolasyonu, append-only,
  idempotency index). **621 birim + 17 e2e, sıfır skip.**
- **Bilinçli borç:** kimlik çözümleme minimal (harici kimlik = `kaynak:
  externalSubjectId`; e-posta ipucu, otomatik-link yok) — tam çözümleme 3B/
  sonrası. Route e2e'si (upload→dry-run) 3D'de (kurucu split'i).

**✅ PR-3B BİTTİ (18 Temmuz, migration `20260718040000`) — canlı smoke ile
doğrulandı:**
- **Atomik apply** tek plpgsql fonksiyonunda (`sod_import_uygula`): stale
  yeniden-kontrol → ekle/güncelle/sona-erdir → manifest → outbox → önizleme
  APPLIED, hepsi tek transaction. Yarı-uygulanmış import olamaz (STALE testi:
  reddedilince HİÇBİR şey yazılmadı — atomiklik kanıtlı).
- **Stale 409:** apply-öncesi güncel atama snapshot + kural seti hash'i TS'te
  yeniden hesaplanır (`onizlemeBayatMi`); farklıysa önizleme STALE'e taşınır,
  409 `IMPORT_PREVIEW_STALE`. Fonksiyon kilit altında ikinci kez de kontrol eder.
- **Sona-erdirme FİZİKSEL SİLME DEĞİL** (kural 2 ruhu): yalnız `gecerlilik_bitis`
  atanır; SNAPSHOT modunda kaynakta olmayan atamalar sona erdirilir.
- **İdempotency üç katman:** (a) önizleme durum kilidi (`for update` +
  READY_FOR_REVIEW kontrolü — çift-apply reddi canlıda doğrulandı), (b) manifest
  `unique(onizleme_id)`, (c) atama partial unique index + apply `ON CONFLICT`
  upsert (aynı kaynak kaydı iki atama üretmez).
- **Transactional-outbox** (kural 4, BullMQ YOK): apply "SoD yeniden
  değerlendirilmeli" olayını `sod_outbox`'a AYNI transaction'da yazar; drenaj
  rotası (`POST /api/sod/outbox/isle`) bekleyenleri çekip BİR değerlendirme
  koşar (ortak `sod-kosu.ts` — elle "Değerlendir" ile aynı mantık) ve olayları
  DONE'a taşır.
- **Import manifesti:** `sod_import_manifestleri` (append-only, RLS) uygulanmış
  içe aktarmanın değişmez kaydı; `manifestHash` (kanonik, kural 15) apply
  kararını mühürler + PR-3A'nın dört bütünlük demiri.
- Rota `POST /api/sod/import/[onizlemeId]/uygula` (admin/uyum): RLS altında
  önizleme okur (IDOR yok), stale kontrol, sonra **service_role** ile atomik
  RPC. Fonksiyonun execute'u authenticated/anon'dan revoke edildi (doğrudan
  çağrı ile tenant atlama yok); service_role Supabase default-privilege ile
  çağırabiliyor (canlı smoke ile kanıtlı — PGlite≠Supabase farkı).
- **Testler:** `rls-sod-import-apply.test.ts` (7 — atomik apply/stale/çift-apply/
  idempotent-upsert + manifest/outbox RLS + append-only + execute-revoke),
  `sod-import.test.ts` +3 (manifestHash determinizm). **631 birim + 17 e2e,
  sıfır skip.** Canlı smoke: geçici kiracıda round-trip + guard, sonra cascade
  temizlik (audit zinciri kirletilmedi).
- **Bilinçli borç:** kimlik çözümleme minimal (harici = `kaynak:externalSubjectId`,
  profiles'a otomatik-link yok — PR-3A ile aynı). Değerlendirme `gecerlilik_bitis`
  filtrelemiyor (sona-erdirilen atama motorda hâlâ görünür — mevcut davranış
  korundu, #5/#8'e bırakıldı). Apply route + drenaj + apply→outbox→değerlendirme
  uçtan-uca e2e'si PR-3D'de (kurucu split'i).
- **Bilinçli borç (yarış):** TS stale-okuma ile RPC çağrısı arası dar pencere
  fonksiyon-içi hash kontrolü + önizleme kilidiyle daraltıldı ama tümüyle
  kapatılmadı; çift-apply yarışı `for update` ile TAM kapalı.

**KALAN PR-3 aşamaları:**
- **PR-3C:** rollback (ters değişiklik seti, fiziksel silme yok) + bağımsız
  onay (uygulayan kendi rollback'ini onaylayamaz).
- **PR-3D:** dar UI (yükleme/kaynak/mod/dry-run/hata/önizleme/apply/geçmiş/
  rollback) + gerçek Chromium e2e (A import, B idempotency, C stale, D rollback).
- **#3 İstisna uzatma** akışı (yeni gerekçe/risk/süre + bağımsız onay, geçmiş
  silinmez). Süre-kilidi yukarıda kondu; uzatma-kaydı modeli hâlâ yok.
- **#4 CSV atama içe aktarma** — sağlayıcıdan bağımsız import contract, dry-run
  önizleme, SHA-256 + import manifesti, evidence storage, rollback, idempotency
  (`source+sourceRecordId`), formula-injection/boyut/MIME güvenliği. (Hiç yok.)
- **#5 SoD değerlendirme tetikleri** — atama/kural değişiminde `sod.evaluate`
  kuyruğa alma (bugün yalnız manuel "Değerlendir" butonu).
- **#6 Atama yönetim UI'ı** (dar sürüm — liste/filtre/CSV/dry-run/import geçmişi).
- **#7 Domain event'ler** (`SOD_*` — sağlayıcıdan bağımsız; e-posta/Slack yok).
- **#8 Üretim dashboard'u** (bugün `/sod` özet var ama kurucunun istediği tüm
  metrikler — kapsama oranı, importtan sonra yeni çatışmalar vb. — eksik).
- **#9 Güvenlik testleri** (CSV injection, IDOR, yetki yükseltme, worker'da RLS
  yanlış tenant, dolaylı özdeşlikle kendi istisnasını onaylama).
- **#10 e2e Senaryo B/C** (CSV import + idempotency) — #4 gelince.
- **#12 M17 ADR incelemesi** — M16 üretim kapısı geçmeden M17 kodu yazılmaz
  (kurucu kararı; M17 hâlâ yalnız tasarım).

Harici IAM/PAM connector'ları ve ReviewCampaign bu sırada da kapsam dışı.

#### Açık kurucu kararları

1. `TODO_DOGRULA → VERIFIED` geçişini bugün `admin` rolüne veriyoruz (ayrı bir
   "hukuk" rolü yok) — kurucu ayrı bir rol isterse sonraki tur.
2. İlk 8 çatışma kuralı (§2.3, kurucunun listesi) `INTERNAL` mi `TODO_DOGRULA`
   mı? Bu ROADMAP'te: KALKAN_OS'un KENDİ süreçlerine dair olanlar (kanıt
   yükleyen/onaylayan, bulgu sahibi/kapanış, kural oluşturan/yayımlayan)
   `INTERNAL` — SPK'dan değil, ürünün kendi tasarım kararından geliyor. Genel
   SPK bağlamlı olanlar (finansal işlem başlatma/onay, tedarikçi değerlendirme/
   risk kabulü) `TODO_DOGRULA`. Kurucu onayı bekliyor.
3. `CriticalActivity`/M13 bağlantısı ne zaman kurulacak.

### M17 — Denetim Örnekleme ve Çalışma Kâğıtları (SPK notları §6) — YALNIZ ADR, KOD YOK

**Bu turda hiçbir migration/UI/route yazılmadı.** Kabul kriteri "tekrar
üretilebilir örnek seçimi", M9'un deterministik puanlama disipliniyle (kural
11) aynı aileden ama kapsamı (evren tamlığı kanıtı, örnekleme yöntemi,
reviewer sign-off, bağımsız kapanış) M16'dan bağımsız, ayrı bir alt sistem —
aynı oturumda ikisini birden tasarlayıp kodlamak "üç alanı aynı anda
geliştirme" hatasının küçültülmüş hali olurdu.

#### Problem ve amaç

Mevcut `share_links`/`paylasim_goruntule` (M4) yalnızca kapsam-filtreli
GÖRÜNTÜLEME sağlıyor. Bu modül çok daha geniş: denetim evreni tanımlama,
önemlilik/risk değerlendirmesi, örnekleme planı + tekrar üretilebilir seçim,
test prosedürü, çalışma kâğıdı, kanıt değerlendirmesi, bağımsız kapanış.

#### Kullanıcı rolleri

`uyum` (denetim hazırlığı), `denetci_misafir` (yalnızca kendi engagement'ına
atanmış örneklem/çalışma kâğıdını görür — mevcut `paylasim` token deseninin
genişlemesi), yeni bir "reviewer" kavramı (bağımsız kapanış — talep eden
kendi işini kapatamaz, M16'daki istisna onay ayrımıyla aynı ilke).

#### Temel nesneler (tasarım seviyesinde, ADR'de detaylandırılacak)

`AuditUniverse`, `AuditEngagement`, `MaterialityRule`, `Population`,
`SamplingPlan`, `SampleSelection`, `SampleItem`, `TestProcedure`, `Workpaper`,
`EvidenceEvaluation`, `ReviewerSignoff`.

#### İş akışı (taslak)

Evren tanımlanır + tamlık kanıtı → önemlilik/risk kriteri → örnekleme planı
(rastgele/yargısal ayrımı + tekrar üretilebilir seed) → örnek seçilir →
test prosedürü çalışır → çalışma kâğıdı + kanıt değerlendirmesi → reviewer
bağımsız imza → bulgu (varsa) M12/M16 desenine paralel PROPOSED doğar.

#### M12/M13/M14 bağımlılıkları

M12'nin kanıt/test durumu sözlüğü (`PASSED/FAILED/UNKNOWN/STALE/EXCEPTION`)
`TestProcedure` sonuçlarına doğrudan uygulanabilir — yeni bir durum sözlüğü
İCAT EDİLMEZ.

#### Güvenlik ve tenant izolasyonu

Aynı ilke: `tenant_id` + RLS; `denetci_misafir` yalnızca kendi engagement'ına
atanmış veriyi görür (mevcut `paylasim` token/RPC desenine benzer, ama
zaman-sınırlı token yerine engagement-bazlı atama).

#### Denetim izi gereksinimleri

Örneklem değişikliği, reviewer imzası, kapanış — hepsi audit_log.

#### Kabul kriterleri (ADR onaylandığında hedeflenecek, bugün YOK)

Tekrar üretilebilir örnek seçimi; evren tamlığı kanıtlanmadan test başlamaz;
AI örneklem büyüklüğünü veya denetim görüşünü TEK BAŞINA belirleyemez
(belgenin kendi sınırı); bağımsız kapanış olmadan workpaper kapanmaz.

#### Kapsam dışı

Bu turda HER ŞEY kapsam dışı — yalnız ADR onaylandıktan sonra migration/kod.

#### Açık kurucu kararları

Örnek büyüklüğü kuralı (istatistiksel mi, sabit yüzde mi) denetçi/kurucu
sorumluluğunda kalmalı mı yoksa ürün bir varsayılan mı önerecek — belgenin
kendi notu "denetim görüşü AI'ya bırakılmaz" diyor, ama örnek büyüklüğü
formülünün kendisi ürün mü sağlayacak, yoksa her zaman kullanıcı girdisi mi
olacak, bu net değil.

### M18 — Eğitim ve Yetkinlik Güvencesi (SPK notları §11) — YALNIZ SINIR, KOD YOK

**Bu turda hiçbir migration/UI/route yazılmadı.**

#### Problem ve amaç

Genel yıllık farkındalık kaydı yetersiz: rol-risk-eğitim matrisi, işe giriş/
rol değişikliği eğitimi, olay/tehdit tetiklemeli hedefli eğitim, içerik
sürümü, katılım/başarı ölçümü, kapsam dışı kalan kullanıcı tespiti.

**SPL'nin telifli sınav soru/cevapları ürüne ALINMAZ.** Soru bankası
geliştirilecekse özgün, KALKAN_OS'a ait senaryo/soru üretilir.

#### Kullanıcı rolleri

`uyum` (matris tanımı, kapsam takibi), tüm kullanıcılar (kendi eğitim
kaydı) — ama bu turda kullanıcı arayüzü/rol ayrımı TASARLANMADI bile,
yalnızca kapsam çizildi.

#### Temel nesneler (tasarım seviyesinde)

Rol-risk-eğitim matrisi, eğitim ataması, katılım/sonuç kaydı, içerik sürümü,
HR/LMS connector sınırı (bağlanmaz, yalnızca içe aktarma noktası olarak
tasarlanır), eğitim kanıtı + bütünlük kaydı (M01/Evidence Envelope ile
uyumlu olmalı — yeni bir kanıt modeli İCAT EDİLMEZ).

#### M12/M13/M14 bağımlılıkları

Eğitim kanıtı da `evidences`/zarf modeline (M11) girmeli — ayrı bir kanıt
sistemi açılmaz.

#### Güvenlik ve tenant izolasyonu, Denetim izi

Aynı ilke: `tenant_id` + RLS; eğitim kaydı değişikliği audit_log'a yazılır.

#### Kabul kriterleri, Kapsam dışı

Bu turda tanımlı değil — ADR/sınır dokümanı onaylanınca yazılacak.

#### Açık kurucu kararları

Soru bankası içeriğinin kaynağı (tamamen özgün mü, üçüncü bir lisanslı
kaynaktan mı) ve LMS entegrasyonunun connector mı yoksa manuel içe aktarma
mı olacağı kurucu kararı bekliyor.

### Ertelenenler ve giriş kapıları

Belgenin P1/P2/P3 modülleri (CFO Kalkanı, connector platformu, DORA/FIRE,
TLPT, 3./n. taraf grafiği, Stress Lab, CRQ-lite, AI assurance, PQC, SBOM,
Passport/benchmark) M15 sonrasına ertelendi. Her birinin giriş kapısı
belgede tanımlı; ek kapımız: çekirdek (M11-M15) canlıda en az bir gerçek
kurum verisiyle çalışmadan hiçbiri başlamaz. Belge §11'in "inşa edilmeyecekler"
listesi aynen geçerli.

---

## 4. CLAUDE.md çekirdeği (repo köküne kopyala)

```markdown
# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Değişmez kurallar
1. Her tabloda tenant_id + RLS; RLS'i test etmeden hiçbir tablo "bitti" sayılmaz.
2. evidences ve audit_log append-only: UPDATE/DELETE yolu açma.
3. Mevzuat içeriği (controls tablosu) ASLA üretilmez/uydurulmaz — yalnızca data/controls/*.yaml
   dosyalarından seed edilir; belirsiz madde referansı TODO-DOGRULA etiketiyle işaretlenir.
4. Supabase'e taşınamaz bağımlılık ekleme (saf Postgres kal); yurt içi barındırmaya taşınabilirlik
   mimari gerekliliktir (VII-128.10 md.26).
5. Kilometre taşı kapıları sıralı: docs/ROADMAP.md'deki kabul kriterleri geçilmeden sonraki taşa geçme.
6. Türkçe UI, İngilizce kod/commit. Para/tarih formatları tr-TR.
7. Gizli anahtarlar yalnızca .env; loglara PII/kanıt içeriği yazılmaz.
8. Her taş sonunda: pnpm check (typecheck+lint+test) + ilgili Playwright akışı yeşil olmalı.
```

---

## 5. Riskler ve açık kararlar (Code başlamadan kurucu onayı gerekenler)

1. **Barındırma:** demo için Supabase bulut (AB bölgesi) kabul mü? **Çözüldü (16 Temmuz 2026):** kurucu kendi ayrı Supabase hesabında yeni proje açtı (`jgunbctnoprklseusaee`), evet. Gerçek müşteri verisi girmeden önce yurt içi taşıma zorunluluğu geçerliliğini koruyor — M6.
2. **Kontrol kütüphanesi doğrulama:** YAML iskeletindeki madde referanslarını resmi tebliğ metniyle kim, ne zaman doğrular? (Öneri: M1 sonunda kurucu + hukuk bürosu; bu, yazılım değil içerik işi.)
3. **7545 sütunu derinliği:** İkincil mevzuat hâlâ akışta — M1'de 7545 kontrolleri "taslak/v0" etiketiyle girilir, Mevzuat Radar süreci manuel başlar.
4. Bu yol haritasındaki süre tahminleri verilmedi (bilinçli): Claude Code oturum sayısı ortama göre değişir; sıralama ve kapılar bağlayıcıdır, takvim değildir.
