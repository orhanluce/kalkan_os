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
- [ ] **Playwright akışları devre dışı** (`playwright.config.ts` → `GECIS_SURUYOR`). Kural 8'in bilinçli ve işaretlenmiş ihlali. Artık gerçek kullanıcı + gerçek veriye karşı yeniden yazılabilirler; bunun için test kullanıcısının şifresi CI/env'den gelmeli.

### M7 — Simülasyon şablon motoru (kaynak: simülasyon belgesi §7, Faz 6)

Simülasyon ana üründen ayrı bir oyun DEĞİLDİR: her beklenen aksiyon bir kontrole bağlanır, her
sonuç kanıt üretir. Bu taş yalnızca şablonu kurar, yürütmeyi değil.

- `scenario_templates` + `scenario_template_versions`: yayınlanmış şablon **immutable**; değişiklik yeni sürüm doğurur.
- `scenario_injects` (zamanlı gelişmeler), `scenario_decision_points`, `scenario_expected_actions`, `scenario_roles`.
- `scenario_scoring_rules`: kural türleri belgede sabit (`ACTION_COMPLETED_WITHIN`, `ROLE_NOTIFIED_WITHIN`, `RTO_WITHIN_TARGET`, `MANDATORY_FAIL_IF` …). Kurallar sürümlenir.
- `scenario_control_mappings`: beklenen aksiyon → mevcut `controls` tablosu.
- Seed: beş şablon (S01 fidye, S02 ayrıcalıklı hesap, S03 veri sızıntısı, S04 yedekten dönüş, S05 tedarikçi kesintisi) — `UNVERIFIED_SAMPLE` etiketli, `data/scenarios/*.yaml`'dan; kural 3'ün aynısı burada da geçerli.
- **Kabul:** yayınlanmış şablon değiştirilemez (RLS/trigger testi); her beklenen aksiyon en az bir kontrole bağlanabiliyor; beş şablon YAML'dan seed ediliyor; şablon sürümü geçmiş simülasyonları etkilemiyor.

### M8 — Simülasyon yürütme + deterministik puanlama (Faz 7-8)

- `simulation_runs` durum makinesi: `DRAFT → SCHEDULED → READY → RUNNING → PAUSED → COMPLETED → SCORING → REVIEWED → CLOSED`, `RUNNING → ABORTED`.
- **Başlatılan run, şablonun immutable snapshot'ını kullanır** — şablon sonradan değişse bile geçmiş simülasyon değişmez (belge §10.7).
- Üç mod: facilitated live, timed, accelerated demo. Hızlandırılmış modda rapor `SIMULATED_ACCELERATED` etiketi taşır.
- Rol bazlı görünürlük: katılımcı yalnızca kendi rolüne yayınlanmış inject'i görür. Bu bir RLS testi konusudur, UI filtresi değil.
- `simulation_decisions`, `simulation_tasks`, `simulation_observations`, `simulation_timeline_events`.
- Deterministik puanlama: aynı girdi aynı sonucu verir; her puan satırı neden verildiğini gösterir; kritik zorunlu aksiyon eksikse genel puan yüksek olsa bile `CRITICAL_FAILURE`.
- `simulation_finding_proposals`: öneri **`PROPOSED`** doğar; GRC/güvenlik yöneticisi kabul etmeden gerçek bulguya dönüşmez.
- **Kabul:** aynı veri aynı puanı üretir (deterministiklik testi); katılımcı başka rolün gizli inject'ini SORGUYLA DA göremez; aynı inject iki kez yayınlanmaz (idempotency); pause sırasında zaman hesabı doğru; öneri onaylanmadan bulgu oluşmaz.

### M9 — Fidye yazılımı dikey akışı + raporlar (Faz 9-10)

- S01 baştan sona oynanabilir: 10 inject, RTO/RPO ölçümü, kanıt yükleme, en az üç bulgu önerisi.
- Simülasyon sonuç manifesti: immutable, şablon sürümü + kararlar + kanıt hash'leri + puanlama kural sürümü + rapor hash'i (belge §11.3). Mevcut Merkle/anchor altyapısı (M5.5) burada kullanılır.
- PDF: yönetim raporu, simülasyon raporu; rapor hash'i + QR doğrulama → mevcut `verification.ts`.
- **Kabul:** simülasyon tamamlanmadan puanlama başlamıyor; başarısız kontrol otomatik öneri üretiyor; sonuç ana panoya yansıyor; QR doğrulama hassas veri sızdırmıyor.

### M6 — MVP kapısına hazırlık (Faz 2 başlangıcı)
- Üretim barındırma kararının uygulanması (yurt içi / self-hosted Postgres taşıma provası: dump→restore→smoke test).
- İlk konektör iskeleti (yalnızca arayüz + 1 örnek: dosya-tabanlı log içe aktarımı) — 5 konektör hedefi Faz 2 gövdesidir, MVP kapısı değildir.
- **Kabul:** taşıma provası belgelenmiş; konektör arayüzü tanımlı; 1 yıllık sözleşme görüşmesine çıkılabilir demo.

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
