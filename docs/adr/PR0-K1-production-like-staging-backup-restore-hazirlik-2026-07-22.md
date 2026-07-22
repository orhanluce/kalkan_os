# ADR — K1: Production-like Staging ve Gerçek Backup/Restore Provası Hazırlık Analizi

**Tarih:** 22 Temmuz 2026 (güncelleme: 22 Temmuz 2026, §15 — 5 kurucu kararı KAPANDI)
**Durum:** MİMARİ ANALİZ + KARAR SEÇENEKLERİ KABUL EDİLDİ, BEŞ KARAR KAPANDI
(§15) — provanın KENDİSİ hâlâ BAŞLAMADI, ayrı açık "başla" talimatı
bekliyor. Bu turda (analiz + karar kapanışı) migration yazılmadı, staging/
Supabase projesi oluşturulmadı, backup alınmadı, restore denenmedi, DB'ye
bağlanılmadı, seed/migration çalıştırılmadı, Storage kopyalanmadı, Auth
kullanıcısı oluşturulmadı, DNS/Hostinger/SMTP/cron değiştirilmedi,
production deploy yapılmadı, gerçek veri export edilmedi, secret
okunmadı/yazılmadı. Yalnızca analiz + `docs/operasyon/
YEDEKLEME_GERI_YUKLEME.md`'nin çalıştırılabilir bir runbook'a dönüştürülmesi.

## 1. Bağlam

Özel SMTP kapısı bugün kapandı (`docs/operasyon/OZEL_SMTP_KURULUMU.md` §3.6/
§4). Kural 20'nin sırasında sıradaki gerçek iş **K1**: gerçek müşteri verisi
sisteme girmeden önce, production-benzeri izole bir staging ortamında
yedekleme+geri yükleme provasının güvenli/tekrarlanabilir/kanıtlanabilir
biçimde yapılabileceğinin gösterilmesi. K1 kapanmadan: gerçek pilot verisi
alınmaz, connector geliştirmesi (Entra ID dahil) başlamaz, billing/self-servis
açılmaz. K2 (kritik zamanlanmış görev güvencesi) ayrı, ilişkili bir sonraki
kapıdır — bu belgede K2'nin KENDİSİ uygulanmaz, yalnız K1'in K2'ye olan
bağımlılığı (§10) değerlendirilir.

## 2. Mevcut ortam envanteri (repo/belgeden doğrulanabilen)

| Ortam | Durum |
|---|---|
| **Production Supabase** | `jgunbctnoprklseusaee` (Session Pooler; direct connection IPv6-only). Repo genelinde tarandı — bundan BAŞKA hiçbir Supabase proje ref'i yok (`.claude/worktrees/*` dahil, yalnız aynı ref'in kopyaları). |
| **Staging Supabase** | **YOK.** Ne kod ne dokümanda ikinci bir proje ref'i bulunamadı — K1'in sıfırdan kuracağı şey tam olarak bu. |
| **Local test** | PGlite (Postgres'in WASM derlemesi) — gerçek Supabase DEĞİL, yalnız migration/RLS testleri için (`src/lib/__tests__/helpers/pg.ts`). Supabase eklentileri (`extensions` şeması) taklit edilemiyor — bu daha önce canlıyı bir kez bozmuştu (CLAUDE.md, `digest()` bulunamama olayı). **K1'in gerekçesi kısmen bu ders:** PGlite'a güvenilmez, gerçek Supabase'e karşı prova şart. |
| **E2E test "izolasyonu"** | Bugün AYRI BİR PROJE değil, AYNI production projesinde AYRI BİR TENANT ("E2E Test Kurumu A.Ş.", `scripts/setup-e2e-fixtures.ts`) — idempotent, kriptografik rastgele şifre, `@kalkan-os.test` sabit e-postalar, çalıştırıldığında kendi tenant'ının kanıt/bulgu/audit_log kaydını SİLİP sıfırlar. **Bu K1 için önemli bir bulgu: bugün "test ortamı" kavramı proje-seviyesinde DEĞİL, tenant-seviyesinde izolasyon.** K1 bunun ÜSTÜNE değil, YANINA yeni bir proje-seviyesi izolasyon katmanı ekler. |
| **Deploy** | Hostinger Business, `main` push'unda otomatik `pnpm run build` + restart (`docs/operasyon/DEPLOY_ROLLBACK.md`). Geçici eski alan (`blue-yak-865668.hostingersite.com`) artık servis vermiyor. Otomatik health-gate yok — push doğrudan canlıya gider, health MANUEL doğrulanır. **`DEPLOY_ROLLBACK.md` §5 zaten şunu not ediyor: "Staging (K1) gelirse önce staging'e push + health + e2e, sonra üretim."** — K1'in deploy tarafı bu notun somutlaştırılmasıdır. |
| **Env var kaynakları** | `.env.local` (gitignored, gerçek değerler) + `.env.example` (commit'li şablon, secret'sız). Alanlar: `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (tarayıcıya gider, gizli değil), `SUPABASE_SERVICE_ROLE_KEY` (RLS bypass — "sızarsa tüm kiracıların verisi açılır" diye şablonda AÇIKÇA uyarılı), `SUPABASE_ACCESS_TOKEN` (CLI PAT), `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_POOLER_HOST`, `NEXT_PUBLIC_APP_URL`, `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` (+ ikinci kullanıcı — script tarafından üretilir, elle doldurulmaz). |
| **Mevcut db tooling** | `pnpm db:link` / `db:push` / `db:verify` / `db:types` (sırasıyla `scripts/db-link.ts`/`db-push.ts`/`db-verify.ts`/`db-types.ts`) — hepsi `.env.local`'deki `NEXT_PUBLIC_SUPABASE_URL`'den `projectRefFromUrl()` ile ref çıkarıp O projeye işlem yapar. `pnpm check` = typecheck+lint+test, `pnpm e2e` = fixture kurulumu + Playwright. |

## 3. Tespit edilen riskler (bazıları BUGÜN CANLI OLARAK GÖZLEMLENDİ)

Talimatın listelediği risklerin her biri repo/oturum gerçekliğine karşı
değerlendirildi:

- **Production/staging secret karışması:** bugün tek proje olduğu için henüz
  fiilen mümkün değil, ama staging kurulunca `.env.local`'in HANGİ projeye
  işaret ettiği kritik hale gelir. Mevcut tooling (`env.ts`'in
  `projectRefFromUrl()`) hangi projeye bağlı olduğunu TÜRETİR ama İNSANA
  GÖSTERMEZ — komutlar sessizce doğru/yanlış projeye gidebilir. **Öneri
  (§9.14):** her K1 komutundan önce script'in bağlandığı proje ref'ini
  konsola YAZDIRAN bir ön-kontrol (bu belgenin runbook'unda şablon olarak
  var, kod DEĞİL).
- **MCP/CLI oturumunun yanlış hesaba bakması: BU RİSK BU OTURUMDA GERÇEKTEN
  YAŞANDI.** SMTP kapanışı sırasında bağlı Supabase MCP bağlantısı
  `jgunbctnoprklseusaee`'ye değil, başka bir hesaptaki iki farklı projeye
  (Finanskor.com, EquScore) bakıyordu — kullanılmadı, ama K1'in gerçek
  provasında AYNI risk connector/CLI/MCP oturumu için de geçerli. **Bu bir
  varsayım değil, bu sohbette gerçekleşmiş bir olay** — runbook'a AÇIKÇA
  yazıldı (§9.1).
- **Production service role key'in yerel dosyalarda bulunması:** `.env.local`
  zaten gitignore'da (kural 7). K1 için öneri: staging'in kendi service_role
  key'i AYRI bir dosyada tutulmalı (`.env.staging.local`, gitignore'a EKLENİR)
  — production ve staging key'lerinin AYNI `.env.local`'de yan yana durup
  yanlışlıkla karışması yapısal olarak önlenir.
- **Staging'in production DB'ye bağlanması:** bugün TEK env seti/deploy hedefi
  var; staging AYRI bir deployment target (yeni Hostinger alt-alan adı veya
  ayrı hosting) + AYRI env seti gerektirir — bugün YOK, K1'in kuracağı şey.
- **Production e-postalarının staging'den gönderilmesi:** eğer staging AYNI
  Resend/Supabase Auth SMTP kimliğini paylaşırsa, staging testleri gerçek
  kullanıcılara mail gitmesi riski taşır. **Öneri:** staging AYRI, test-only
  bir e-posta yapılandırması kullanmalı (§4, §9.15 — Resend'de ikinci,
  düşük-limitli bir domain/sink VEYA Supabase'in varsayılan e-posta servisi
  — staging'de rate-limit sorun DEĞİL, düşük hacimli prova için yeterli).
- **Eski Hostinger domaininin kullanılması:** `blue-yak-865668.hostingersite.com`
  artık servis vermiyor (CLAUDE.md); staging YENİ bir alt-alan adı seçmeli,
  eski domain HİÇ kullanılmamalı.
- **Staging URL'lerinin production Auth allow-list'e kontrolsüz eklenmesi:
  BU RİSK DE BU OTURUMDA CANLI OLARAK GÖZLEMLENDİ** — SMTP testinde Supabase
  Auth `Redirect URLs` allow-list'inin BOŞ olması + `Site URL`'in
  `localhost:3000`'de kalması, gerçek bir parola sıfırlama linkinin yanlış
  adrese gitmesine sebep oldu (`docs/operasyon/OZEL_SMTP_KURULUMU.md` §3.6
  madde 2). **Ayrı bir Supabase PROJESİ kullanmak bu riski YAPISAL OLARAK
  ortadan kaldırır** — her projenin kendi, birbirinden bağımsız URL
  Configuration'ı vardır; staging'in URL'leri production'ın allow-list'ine
  HİÇ eklenmemelidir (ayrı proje = ayrı allow-list, karışma imkânsız).

**Yan bulgu (bilgi amaçlı, K1'i bloklamaz):** repoda `.claude/worktrees/
angry-mccarthy-e92f90` ve `.claude/worktrees/beautiful-bhabha-a4d2bf` adında
iki git worktree'si var — önceki oturumlardan kalma, bu görevin kapsamı
dışında, dokunulmadı.

## 4. Production-like staging tanımı

**Asgari (gerçek izolasyon için ZORUNLU):**
- Ayrı Supabase projesi (ayrı proje ref, ayrı Postgres, ayrı Auth kullanıcı
  havuzu, ayrı Storage bucket'ları, ayrı `service_role`/`anon` key) — bu, e2e
  tenant-izolasyonundan YAPISAL OLARAK farklı ve DAHA GÜÇLÜ bir izolasyon
  (proje sınırı, tenant sınırı değil).
- Production ile AYNI migration zinciri, `pnpm db:push` ile TAM uygulanmış
  (kod zaten bunu destekliyor — `db-link.ts`/`db-push.ts` herhangi bir proje
  ref'ine karşı çalışabilir).
- Production'a yakın RLS/Auth yapılandırması — migration'dan otomatik gelir,
  ayrıca elle kurulacak bir şey yok.
- Production'daki pg_cron işlerinin (Dikey K analizinde tespit edilen 9 iş —
  `kalkan-sure-dolumu`, `kalkan-tpr-sozlesme-dolumu`, `kalkan-policy-sure-
  dolumu`, `kalkan-iddia-yeniden-inceleme`, `kalkan-roi-export-yeniden-
  inceleme`, `kalkan-egitim-periyot-yenile`, `kalkan-e2-telafi-suresi-dolumu`,
  `kalkan-tedarikci-anket-suresi-dolumu` + K2 kapanınca eklenecek olan)
  AYNI migration'lardan staging'de de otomatik kurulur (migration'lar zaten
  defansif `DO $$ ... EXCEPTION` bloğunda — PGlite'ta no-op, gerçek
  Supabase'de kurulur).
- Sentetik test verisi (§8) — gerçek müşteri verisi KESİNLİKLE YOK.
- Gözlemlenebilirlik: Supabase'in kendi Logs paneli (Auth/Postgres/API) her
  projede otomatik var, ayrıca kurulacak bir şey yok.

**AYNI OLMASI GEREKMEYEN (bilinçli farklar):**
- **Domain:** staging kendi alt-alan adını kullanır (örn.
  `staging.wardproof.com` veya geçici bir alan) — production `wardproof.com`'u
  ASLA kullanmaz.
- **SMTP/e-posta davranışı:** staging AYRI, test-only bir yapılandırma
  kullanabilir/kullanmalı — production Resend/`info@wardproof.com`
  kimliğini paylaşmaz (§3, §9.15).
- **Ölçek:** K1'in amacı restore PROSEDÜRÜNÜ ve bütünlüğü kanıtlamak, yük
  testi DEĞİL — sentetik veri küçük ölçekli yeterli.
- **Supabase planı:** staging daha küçük/ucuz bir plan olabilir, YETER Kİ
  PITR/backup özelliğini test edebilecek asgari plan olsun — **bu özellik
  panelden DOĞRULANMALI, tahmin edilmedi** (§6).

## 5. Backup kapsamı

| Kategori | DB dump'a (Postgres seviyesi) dahil mi? | Notlar |
|---|---|---|
| Şema (tablo/kolon/constraint/enum/generated kolon/extension) | ✅ Evet | `public` şemasının doğal parçası |
| RLS politikaları, fonksiyonlar, trigger'lar | ✅ Evet | Şemanın parçası, migration'dan gelir |
| Tenant/iş verisi (evidences, test_runs, findings, manifest, ledger_outbox, transparency_ledger_entries, tenant_provisioning, vb. — TÜM `public` tabloları) | ✅ Evet | Postgres dump doğası gereği |
| `pg_cron` iş tanımları (`cron.job` tablosu) | ⚠️ BELİRSİZ | `cron` şeması `public` DIŞINDA — standart bir `pg_dump --schema=public` bunu KAÇIRIR; kapsanması için AÇIKÇA dahil edilmeli. **Panelden/testle doğrulanmalı, varsayılmadı.** |
| `auth.users`, `auth.identities` (Supabase Auth şeması) | ⚠️ KOŞULLU | Supabase'in **managed backup'ı** bunu kapsar (tüm Postgres'i yedekler). **Manuel `pg_dump` ile `--schema=public` kullanılırsa auth şeması KAÇAR** — bu K1'in en kritik bulgularından biri, §6'da netleştirildi. |
| Storage dosya içerikleri (`evidence` bucket'ındaki gerçek dosyalar) | ❌ Hayır | Object storage'da tutulur, yalnız METADATA'sı (`storage.objects`) Postgres'te. Dosyaların KENDİSİ ayrı export/kopyalama gerektirir (§6, Yöntem E). |
| Panel yapılandırması (SMTP ayarları, Auth URL Configuration, redirect allow-list) | ❌ Hayır | Supabase platform-seviyesi config, Postgres dump'ının parçası DEĞİL — ayrıca export/elle kayıt gerekir (bu belgenin §9.7'sindeki gibi bir ekran görüntüsü/metin kaydı). |
| Domain/deployment bilgisi (Hostinger) | ❌ Hayır | Kod dışı, `docs/operasyon/DEPLOY_ROLLBACK.md`'de zaten belgeli. |
| Secret'lar (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, Resend API key, JWT signing secret) | ❌ ASLA | Ne dump'a ne kanıt paketine girer — yalnız Supabase panel/güvenli secret store'da yaşar (kural 7). |

## 6. Backup yöntemi karşılaştırması

| Yöntem | Kapsar | Kapsamaz | Gerekli yetki | Güvenlik riski | Tekrarlanabilirlik | Restore kolaylığı | Kanıt üretme | Maliyet/plan bağımlılığı | K1 uygunluğu |
|---|---|---|---|---|---|---|---|---|---|
| **A. Supabase managed backup/PITR** | Tüm Postgres (public+auth+cron şemaları dahil, Supabase'in kendi mekanizması) | Storage dosya içerikleri, panel config | Proje sahibi/panel erişimi | Düşük (Supabase yönetir) | Yüksek (otomatik günlük) | Panelden "yeni projeye restore" akışı var (Supabase'in kendi dokümantasyonu — **panelden DOĞRULANMALI**) | Panel restore log'u, export edilebilir | PITR genelde Pro+ plan gerektirir, günlük backup daha düşük planda olabilir — **panelden DOĞRULANMALI, varsayılmadı** | **YÜKSEK — önerilen ANA yöntem** |
| **B. `pg_dump` + `pg_restore`** | `--schema` ile seçilebilir; `public`+`auth`+`cron` AÇIKÇA belirtilirse hepsini kapsar | Storage, panel config; şema bayrağı unutulursa auth/cron KAÇAR | `SUPABASE_DB_PASSWORD` + pooler host (zaten `.env`'de) — doğrudan Postgres bağlantısı, `service_role` key DEĞİL | Connection string/parola terminal geçmişinde kalabilir — redaksiyon disiplinli olmalı | Yüksek (script/CI'da otomatikleştirilebilir) | Orta (hedef DB hazır olmalı) | Dump dosyasının `sha256sum`'ı kolayca alınır — İYİ kanıt formu | Ek maliyet yok | **YÜKSEK — önerilen İKİNCİL/bağımsız doğrulama** (managed backup'a kör güvenmemek için ayrı kanal) |
| **C. Supabase CLI dump** | B ile aynı (CLI sarmalı) | B ile aynı | CLI kurulumu + login | B ile aynı | Yüksek | Orta | B ile aynı | Yok | B'ye eşdeğer, tercih meselesi |
| **D. Uygulama-seviyesi mantıksal export** (tablo→JSON/CSV) | Yalnız seçilen tabloların VERİSİ | Şema/RLS/trigger/function (DDL), auth şeması (ayrı API çağrısı gerekir), Storage | `service_role` key (zaten var) | Orta (uygulama kodu hatası riski, A/B kadar test edilmemiş bir yol) | Kod kalitesine bağlı | Düşük (şema AYRICA `db:push` ile kurulmalı) | JSON checksum alınabilir | Yok | **DÜŞÜK ana yöntem olarak** — ama restore sonrası "satır sayısı eşleşiyor mu" doğrulaması için TAMAMLAYICI |
| **E. Storage object export** | Yalnız dosya içerikleri + path | DB, config | `service_role` veya Storage-scoped key | Düşük-orta | Yüksek | Content-addressed olduğu için (`{tenant}/{sha256}`) bütünlük kendiliğinden doğrulanır | Path=hash eşleşmesi doğrudan kanıt | Yok | **ZORUNLU TAMAMLAYICI** — A/B/C hiçbiri Storage dosya içeriklerini kapsamaz |

**Önerilen K1 mimarisi:** ANA yöntem = **A** (Supabase managed backup/PITR,
panelin kendi restore akışı) + İKİNCİL/bağımsız doğrulama = **B** (`pg_dump`,
checksum'lı, "tek noktaya güvenme" ilkesine karşı ayrı bir kanal) + **E**
(Storage export, zorunlu, A/B/C'nin hiçbiri kapsamıyor). **D** yalnız
satır-sayımı çapraz kontrolü için opsiyonel destek. Tahmin edilmeyen/panelden
doğrulanması gereken noktalar açıkça işaretlendi (PITR plan gereksinimi,
`cron` şemasının managed backup kapsamı, auth şemasının pg_dump'a dahil
edilme yöntemi).

## 7. Restore prosedürü (izole, yıkıcı olmayan senaryo — bu turda UYGULANMADI)

```
1.  Production-benzeri sentetik staging verisi oluştur     (§8)
2.  Backup al                                                (Yöntem A, panelden)
3.  Backup checksum üret                                     (Yöntem B'nin dump'ı için sha256sum;
                                                                Yöntem A'nın panel-seviyesi backup'ı
                                                                için checksum kavramı panelden
                                                                doğrulanmalı — Supabase kendi
                                                                bütünlük garantisini nasıl sunuyor?)
4.  Ayrı ve BOŞ restore hedefi hazırla                        (ÜÇÜNCÜ bir proje veya staging'in
                                                                KENDİSİNİN restore hedefi olması —
                                                                §15 karar 1)
5.  Migration/şema uyumluluğunu doğrula                       (pnpm db:verify)
6.  Database restore gerçekleştir                             (Yöntem A panel akışı VEYA
                                                                pg_restore)
7.  Storage varlıklarını geri yükle                           (Yöntem E)
8.  Auth/test kullanıcı senaryolarını doğrula                 (§9.C)
9.  Uygulamayı restore hedefe bağla                           (.env.staging-restore.local — AYRI
                                                                dosya, production/staging ile
                                                                karışmaz)
10. Smoke, RLS, e2e ve iş zinciri testlerini çalıştır          (§9)
11. Kriptografik artefaktları doğrula                          (§9.F, §10)
12. Sonuçları kanıt paketi olarak arşivle                      (§12)
13. Restore ortamını güvenli şekilde kapat veya sakla          (§15 karar 1'e bağlı)
```

Her adım bir öncekinin ÜZERİNE inşa edilir — bir adım başarısız olursa prova
DURUR, "BAŞARISIZ" olarak kayda geçer (sessizce atlanmaz), tekrar denenmeden
önce kök neden yazılır (§13'ün ruhu).

## 8. Sentetik veri paketi (tasarım — kod YAZILMADI)

Mevcut `scripts/setup-e2e-fixtures.ts` deseni TEMEL alınmalı — YENİDEN İCAT
EDİLMEZ: idempotent, kriptografik rastgele şifre (asla loglanmaz/konsola
basılmaz), sabit `@kalkan-os.test` tarzı e-postalar, gerçek kişi/müşteri adı
YOK. K1 için bu deseni GENİŞLETEN (henüz yazılmamış) bir fixture script'i
tasarımı:

- **En az iki tenant**, tenant başına farklı kullanıcı/rol (admin, uyum) +
  bir `platform_operator` (tenant_id NULL) senaryosu.
- **Cross-tenant erişim reddi** doğrulanabilecek şekilde iki tenant'ın
  ÇAKIŞMAYAN veri kümeleri.
- Her tenant'ta: kritik hizmet (`critical_business_services`) + kontrol
  (`tenant_controls`) + manuel kanıt (`evidences`, en az bir **version
  lineage** zinciri — `previous_evidence_id` dolu) + test tanımı
  (`control_test_definitions`) + test koşusu (`test_runs`, PASSED VE FAILED
  örnekleri) + bulgu (`findings`) + düzeltici faaliyet + retest + **bağımsız
  kapanış** (kapatan ≠ öneriyi kabul eden — kural 14 guard'ı gerçekten
  tetiklenmiş olsun).
- **RTO/RPO measurement + comparison** (`test_run_recovery_measurements`/
  `test_run_recovery_comparisons`, en az biri MANUEL_BEYAN biri OTOMATIK_OLCUM
  — F4/F5 disiplini).
- **Kritik hizmet test paketi snapshot'ı** (`kritik_hizmet_test_paketi_
  snapshots`, en az bir mühürlenmiş paket).
- **Proof Room hedefleri:** 5 polimorfik dalın (test_run, roi_export,
  graph_snapshot, cloud_assurance, kritik_hizmet_test_paketi) HER BİRİNDEN
  en az bir `proof_room_links` kaydı — restore sonrası hepsinin çalıştığını
  görmek için.
- **Manifest + `ledger_outbox`/`transparency_ledger_entries`** — en az bir
  tam işlenmiş (PROCESSED) ve backup ANINDA bilinçli olarak PENDING bırakılan
  bir kayıt (§10'un "backup anındaki pending outbox" testi için gerekli).
- **G1 onboarding'den en az bir TAMAMLANMIŞ tenant** (`tenant_provisioning.
  durum = PILOT_AKTIF`, `tenant_onboarding_acceptances` dolu,
  `onboarding_import_onizlemeleri` uygulanmış) **ve en az bir REDDEDİLMİŞ/
  EKSİK onboarding** (örn. `KURULUM_INCELEMEDE`'de takılı kalmış) — durum
  makinesi guard'ının restore sonrası da geçersiz geçişleri reddettiğini
  negatif test edebilmek için.
- **Storage'da örnek private evidence dosyası** (content-addressed, gerçek
  bir küçük test dosyası — PII/gerçek içerik YOK).

Gerçek kişi adı, gerçek e-posta, gerçek müşteri adı veya üretim verisi
KULLANILMAZ — tamamı `setup-e2e-fixtures.ts`'in zaten kanıtladığı sabit/
sentetik desenin genişlemesi.

## 9. Restore sonrası doğrulama matrisi

| # | Alan | Kontrol | Nasıl (mevcut araç) |
|---|---|---|---|
| A1 | Şema bütünlüğü | Migration sayısı/sürümü, tablo/kolon/constraint | `pnpm db:verify` |
| A2 | Şema bütünlüğü | Trigger/function/enum/RLS policy | `pnpm db:verify` + manuel `\d` / `pg_policies` sorgusu |
| B1 | Tenant izolasyonu | Tenant A, Tenant B verisini GÖREMEZ | Mevcut desen: `src/lib/__tests__/rls-*.test.ts` AYNI iddiaların canlıya karşı TEKRARLANMASI (PGlite'a güvenilmez, ders zaten öğrenildi — YEDEKLEME_GERI_YUKLEME.md §5.2 son madde) |
| B2 | Tenant izolasyonu | `service_role` dışındaki yollar tenant izolasyonunu aşamaz | Aynı |
| B3 | Tenant izolasyonu | `platform_operator` sınırları korunur (iş verisini GÖREMEZ, yalnız provisioning/tenant-registry tablolarını) | `rls-dikey-g1-onboarding.test.ts` test 6'nın canlı tekrarı |
| C1 | Auth/onboarding | Test admin giriş yapabilir | Manuel giriş denemesi |
| C2 | Auth/onboarding | İlk giriş/onboarding akışı bozulmamış | `/ilk-giris` akışının manuel/e2e testi |
| C3 | Auth/onboarding | Davet/redirect davranışı STAGING'e göre güvenli (production allow-list'e KARIŞMADI) | URL Configuration'ın staging projesine özgü olduğunun panelden teyidi |
| D1 | Evidence/Storage | Metadata ile dosya eşleşir | `storage_path`/`hash_sha256` karşılaştırması |
| D2 | Evidence/Storage | Hash doğrulanır | İndir → SHA-256 hesapla → path ile karşılaştır (mevcut §2.3 yöntemi) |
| D3 | Evidence/Storage | Private erişim korunur | Yetkisiz bir istekle bucket'a erişim denemesi (403 beklenir) |
| D4 | Evidence/Storage | Version lineage bozulmaz | `previous_evidence_id`/`previous_file_hash` zincirinin restore sonrası tutarlılığı |
| E1 | Test/bulgu/retest | İlişkiler eksiksiz | `test_runs`→`findings`→retest FK zincirinin sorgulanması |
| E2 | Test/bulgu/retest | Kapanış onayları korunur | `finding_verified_closure_guard`'ın restore sonrası da aktif olduğu negatif testle (aynı kişi kapatmaya çalışsın, reddedilmeli) |
| E3 | Test/bulgu/retest | Maker-checker çalışır | Aynı |
| F1 | Kriptografik | Canonical hash aynı | `verify-paket.ts` / `verify-seffaflik.ts` (DB'siz CLI'lar, restore hedefinden export edilen bir pakete karşı) |
| F2 | Kriptografik | JWS doğrulanabilir | Aynı CLI'lar |
| F3 | Kriptografik | Manifest tüketilebilir | Aynı |
| F4 | Kriptografik | Merkle/şeffaflık defteri tutarlı | `tutarlilikDogrula` (transparency.ts) restore öncesi/sonrası STH karşılaştırması |
| F5 | Kriptografik | Restore sonrası yeniden üretim eski imzalı artefaktla KARIŞTIRILMAZ | §10, kanıt paketinde restore-öncesi/restore-sonrası ayrımı |
| G1 | Uygulama | `/health/live`, `/health/ready` | Mevcut health endpoint'leri |
| G2 | Uygulama | Login, dashboard, kritik hizmet, test, Proof Room, AI Güvence, onboarding, platform operatör akışı | Manuel gezinme + varsa staging'e özel e2e koşusu |
| H1 | Operasyon | Loglar, hata mesajları | Supabase Logs paneli (proje-başına otomatik) |
| H2 | Operasyon | Cron/queue durumu | `sod_cron_durumu()` benzeri sorgular, `ledger_outbox` PENDING sayımı (§10) |
| H3 | Operasyon | SMTP staging'de gerçek kişilere e-posta GÖNDERMİYOR | §4/§9.15 — staging SMTP yapılandırmasının test-only olduğunun teyidi |

## 10. Kriptografik ve immutable kayıtların özel riski

- **Restore edilmiş kayıtların hash'i AYNI KALMALI.** Hash içerik-türevlidir;
  restore bunu DEĞİŞTİRMEMELİDİR — değişirse bu BOZULMA sinyalidir (F1-F3'ün
  tam amacı bunu yakalamak).
- **Restore ZAMANI yeni bir ledger event'i olarak YAZILMAZ.** Mevcut mekanizma
  yalnız belirli tabloların (`test_runs`, `dsar_fulfillment_packages`, vb.)
  `AFTER INSERT` trigger'ıyla outbox'a düşer — restore bir DB-seviyesi
  kopyalama, yeni bir domain-event DEĞİL, yeni bir INSERT tetiklemez. Restore
  denemesinin KENDİSİ yalnız bu ADR'nin kanıt paketinde (§12) operasyonel bir
  not olarak kayıt altına alınır, LEDGER'a YAZILMAZ.
- **`LocalDevSigner`/production signer ayrımı korunmalı.** Bugün TEK signer
  var (`LocalDevSigner`, production dahil — kural 19) ve **her drain
  çağrısında YENİ bir ephemeral anahtar üretir** (`ledger-outbox.ts:347`) —
  bu K1'e özgü bir sorun değil, mevcut mimarinin bilinen bir sınırı, ama K1
  provasında BİLİNÇLİ gözlemlenmeli: staging'de de AYNI dev-grade signer
  kullanılacak, restore sonrası "artık production-grade bir imza üretiliyor"
  gibi YANLIŞ bir izlenim OLUŞTURULMAMALI — kanıt paketi bunu açıkça
  "dev-grade signer" etiketiyle işaretlemeli.
- **`ledger_outbox` yeniden işlenirse duplicate/orphan-leaf riski VAR —
  ÖNCEKİ Dikey K analizinde tespit edilmiş, henüz doğrulanmamış bir tasarım
  riski.** Backup ANINDA `PROCESSING` durumunda olan bir outbox satırı, eğer
  imzalama+`transparency_ledger_entries` INSERT'i tamamlanmış ama
  `ledger_outbox_mark_processed` ÇAĞRILMAMIŞSA, restore sonrası 5 dakikalık
  stale-reclaim mekanizmasıyla TEKRAR claim edilip TEKRAR imzalanabilir —
  `transparency_ledger_entries`'in kendisinde `(tenant_id, artifact...)`
  üzerinde bir uniqueness guard YOK (yalnız `ledger_outbox` ve
  `artifact_ledger_links` üzerinde var). Sonuç: görünür bir "duplicate kanıt"
  oluşmaz (link tablosu `ON CONFLICT DO NOTHING`), ama Merkle ağacına
  fazladan, hiçbir artefakta bağlanmamış bir "orphan leaf" sızabilir. **K1'in
  restore-sonrası testi (§9, H2) bunu AÇIKÇA aramalı:** restore sonrası
  `ledger_outbox`'ta `PENDING`/`PROCESSING` kalan satır var mı, drain
  edilirse Merkle ağaç boyutu beklenenden fazla mı büyüyor.
- **İdempotency anahtarı:** `ledger_outbox.unique(artifact_table,
  artifact_id)` + `artifact_ledger_links.unique(artifact_table, artifact_id)`
  — ikisi de şemanın parçası, restore sonrası AYNEN geçerli kalır.
- **Backup anındaki PENDING outbox kayıtları:** restore sonrası bunlar YİNE
  `PENDING` gelir, normal akışla (route-tetikli veya manuel drain) işlenmeye
  devam eder — bu SORUN DEĞİL, ama "restore sonrası kaç satır PENDING kaldı,
  hepsi başarıyla drain edildi mi" doğrulama matrisinin (H2) parçası olmalı.
- **Bitemporal/snapshot alanlarda restore zamanı semantiği:**
  `impact_tolerances` gibi bitemporal tablolardaki (`superseded_at`,
  `onay_zamani`) alanlar VERİdir, dump'ın parçasıdır, restore AYNEN taşır —
  restore İŞLEMİNİN KENDİSİ yeni bir "sistem zamanı" olayı YARATMAZ, yalnız
  var olan veriyi kopyalar.

**Önerilen "restore güven sınırı":** restore edilmiş bir ortamdaki
kriptografik artefaktlar "restore ÖNCESİ üretilmiş ve o anda geçerliliği
kanıtlanmış" olarak güvenilir. **Restore işleminin kendisi yeni bir güven/
doğrulama olayı DEĞİLDİR** — yalnız var olan güvenceyi TAŞIR. Restore
SONRASI yeni üretilen herhangi bir imza/ledger kaydı (örn. PENDING outbox'un
restore-sonrası drain'i) restore ÖNCESİ üretilenlerle KARIŞTIRILMAMALI —
kanıt paketinde (§12) restore-öncesi vs restore-sonrası artefaktlar AYRI
listelenir.

## 11. RPO/RTO ölçüm planı

Ölçülecek (talimattaki liste birebir):
- Backup başlangıç/bitiş süresi.
- Restore başlangıç/bitiş süresi.
- Uygulamanın kullanılabilir hale gelme süresi (`/health/ready` 200'e kadar).
- Doğrulama testlerinin (§9) tamamlanma süresi.
- Backup'ın kapsadığı SON kayıt zamanı (backup anındaki en son `created_at`).
- Backup ile "arıza" varsayımı arasındaki veri kaybı penceresi (varsayımsal —
  prova sırasında backup ANINDAN SONRA bilinçli olarak eklenen bir-iki test
  kaydının restore sonrası KAYBOLDUĞU gösterilerek RPO somutlaştırılır).
- Storage geri yükleme süresi.
- Auth yeniden yapılandırma süresi.

**Sonuçlar DOĞRUDAN "RTO/RPO karşılandı" şeklinde YAZILMAZ** — F4/F5'in
MANUEL_BEYAN/OTOMATIK_OLCUM ayrımıyla aynı disiplin: **ölçüm, hedef ve
karşılaştırma AYRI tutulur.** Bu K1 provasındaki ölçümler script/panel
tarafından üretileceği için OTOMATIK_OLCUM sınıfına yakındır, ama yine de
"karşılandı/aşıldı" gibi nihai bir dil TEK BAŞINA bu belgede kullanılmaz —
format: *"ölçülen: X dakika; hedef (mevcut §4 tablosu): Y; karşılaştırma: K1
provası TAMAMLANDIKTAN SONRA doldurulacak."*

## 12. Kanıt paketi (tasarım)

- Prova kimliği (benzersiz, örn. `K1-PROVA-001`).
- Tarih/saat (başlangıç-bitiş).
- Uygulayan kişi.
- Bağımsız inceleyen kişi (kural 14'ün ruhu — restore provasını uygulayan
  kişi KENDİ provasını tek başına "geçti" ilan etmez).
- Kaynak ve hedef ortam kimlikleri (proje ref'leri — DEĞER değil, yalnız
  hangi projenin kaynak/hangisinin hedef olduğu).
- Backup yöntemi (§6'daki A/B/E kombinasyonundan hangisi kullanıldı).
- Kullanılan komutların REDAKTE EDİLMİŞ kaydı (connection string/parola/key
  SİLİNMİŞ, yalnız komut şablonu + zaman damgası).
- Backup checksum (`sha256sum`, Yöntem B/E için).
- Restore log özeti.
- Test matrisi sonucu (§9'daki her satır için PASS/FAIL).
- Başarısız adımlar (varsa, kök nedeniyle).
- Düzeltici faaliyet (başarısız adım varsa).
- Tekrar prova gereksinimi (evet/hayır, gerekçe).
- Ölçülen süreler (§11).
- RPO veri penceresi (§11).
- Ekran görüntüsü/panel kanıtları (Supabase panel restore ekranı, Logs).
- Git commit SHA (bu ADR'nin/runbook'un o anki hali).
- Migration head (o anki en son migration dosya adı).
- Uygulama build SHA (Hostinger'ın çektiği commit).
- Son onay (bağımsız inceleyenin imzası/tarihi).

**Secret, token, parola, connection string veya kişisel veri pakete
GİRMEZ** — kural 7'nin bu belge için somutlaşmış hali.

## 13. Başarı ve başarısızlık kriterleri

**K1 ancak şunlar SAĞLANIRSA kapanır** (talimattaki liste, aynen kabul):
izole production-like staging hazır; sentetik veri paketi yüklenmiş; backup
alınmış; ayrı hedefe restore yapılmış; database+Auth+Storage kapsamı
doğrulanmış; RLS/cross-tenant testleri geçmiş; kritik iş zincirleri
çalışmış; manifest/JWS/transparency doğrulanmış; ölçülen RTO/RPO değerleri
raporlanmış; bağımsız inceleme yapılmış; kanıt paketi tamamlanmış; kritik/
yüksek bulgu açık kalmamış.

**Şunlardan biri varsa K1 KAPANMAZ:** production verisinin staging'e
kontrolsüz kopyalanması; restore'un yalnız şema düzeyinde yapılmış olması;
Storage'ın test edilmemesi; RLS testinin yapılmaması; Auth/onboarding
testinin yapılmaması; hash/JWS/ledger doğrulamasının atlanması; yalnız
"backup başarılı" panel mesajına dayanılması; kanıt paketinin eksik olması;
restore'un AYNI kaynak ortam üzerinde denenmesi.

## 14. Kullanıcıdan istenecek panel bilgileri (kurucunun elle yapması gereken)

- Doğru Supabase PRODUCTION project ref'inin (`jgunbctnoprklseusaee`) teyidi
  (her K1 komutundan önce — §3'teki MCP/CLI yanlış-hesap riskinin somut
  önlemi).
- Supabase plan seviyesi ve PITR/backup özelliğinin gerçekten mevcut olduğu
  (panelden — tahmin edilmedi).
- Yeni staging projesi OLUŞTURMA yetkisi ve işlemin kendisi.
- Staging project ref'i (oluşturulunca).
- DB password/connection bilgisinin güvenli yerleştirilmesi (AYRI bir
  `.env.staging.local` dosyasına, §3'teki karışma riskine karşı).
- Storage export erişimi (staging projesinde bucket kurulumu).
- Auth URL Configuration (staging projesinin KENDİ Site URL/Redirect URLs'i
  — production'la KARIŞTIRILMAMASI, §3/§9.C3).
- Staging SMTP davranışı kararı (§15 karar 4).
- Hostinger staging deployment seçeneği (yeni subdomain/ayrı hosting).
- Domain/alt-alan adı tercihi.

**Hiçbir secret sohbet içinde paylaşılmamalı** — secret'lar yalnız panel
veya güvenli environment store'a girilir, bana asla yapıştırılmamalı (bu
oturumun kendi disiplini — SMTP kapanışında da API key hiç istenmedi/
paylaşılmadı).

## 15. Kurucu kararları — KAPANDI (22 Temmuz 2026)

Aşağıdaki beş karar kurucu tarafından verildi. Bu belge artık bunları
"açık seçenek" olarak DEĞİL, bağlayıcı karar olarak taşır. **Karar
verilmiş olmak K1 provasının BAŞLADIĞI anlamına gelmez** — provanın
kendisi hâlâ ayrı, açık bir "başla" talimatı bekliyor (bu belgenin üstündeki
"Durum" satırı, ROADMAP §1.74, DEVAM -12).

**1. Staging modeli — KALICI, tamamen ayrı proje.** Kendi başına duran,
   sürekli var olan bir Supabase staging projesi kurulacak: ayrı DB, ayrı
   Auth kullanıcı havuzu, ayrı Storage bucket'ları, ayrı `anon`/
   `service_role` key, ayrı URL, ayrı environment. **Production verisi
   staging'e KESİNLİKLE kopyalanmayacak** — yalnız §8'deki sentetik veri
   paketi kullanılacak. (Önceki §15 taslağının "geçici/prova-başına"
   önerisinin YERİNE geçti — kurucu kalıcı modeli tercih etti; hijyen
   disiplini riski §6.2'nin güvenlik uyarılarına ve §13'ün kabul
   kriterlerine işlendi.)

**2. Backup yöntemi — ANA yöntem Supabase managed backup, koşullu geri
   düşüş `pg_dump`'a.** Managed backup/PITR özelliğinin ve plan
   uygunluğunun GERÇEKTEN var olduğu, ÖNCE doğru WardProof PRODUCTION
   projesinin (`jgunbctnoprklseusaee`) panelinden doğrulanacak — tahmin
   edilmeyecek. Bağımsız doğrulama ve taşınabilirlik testi için AYRICA
   açık şema kapsamlı `pg_dump`/`pg_restore` kullanılacak (`--schema=public
   --schema=auth --schema=cron` — §6'daki AÇIK şema riski burada çözülüyor,
   şema bayrağı ASLA varsayılana bırakılmayacak). **Managed backup/PITR
   panelde KULLANILAMIYORSA** (plan desteklemiyor vb.), ana yöntem
   `pg_dump`/`pg_restore`'a ÇEVRİLECEK ve bu sapma kanıt paketinde (§12)
   AÇIKÇA kayıt edilecek — sessizce "plan B'ye geçildi" denmeyecek.

**3. Storage yedeği — DB backup'tan AYRI, gerçek dosya kopyalama.** Storage
   dosyaları veritabanı yedeğinden bağımsız olarak yedeklenecek (§6 Yöntem
   E). Bir object manifest tutulacak: path, size, MIME, checksum ve ilgili
   `evidence` kaydının kimliği. **Restore sonrası doğrulama yalnız
   `storage.objects` metadata'sıyla YETİNMEYECEK** — gerçek dosya içeriği
   indirilip SHA-256'sı yeniden hesaplanacak ve path'teki hash'le
   eşleştirilecek (§9 madde D2'nin zaten önerdiği yöntem, şimdi ZORUNLU).

**4. Staging SMTP — açık kalacak, ama yalnız kurucu onaylı allow-list
   adreslerine.** Staging'de custom SMTP TAMAMEN KAPATILMAYACAK (invite/
   reset akışlarının gerçekten test edilebilmesi için gerekli — SMTP
   kapısının kendisini yeniden kanıtlamak değil, restore-sonrası Auth
   zincirinin ÇALIŞTIĞINI göstermek amacıyla). Gönderim yalnız kurucu
   tarafından ÖNCEDEN onaylanmış allow-list test adreslerine yapılacak —
   gerçek müşteri/pilot adreslerine gönderim KESİNLİKLE YASAK. E-posta
   içeriği ve konu satırı staging olduğunu AÇIKÇA gösterecek (örn. konu
   satırına `[STAGING]` öneki — bu, gerçek uygulanışı K1 provası
   sırasında/sonrasında panel şablon düzenlemesiyle yapılacak bir
   gereksinim, bu turda kod/şablon DEĞİŞMEDİ).

**5. Ledger/outbox — restore hedefinde VARSAYILAN OLARAK KAPALI, kontrol
   tamamlanmadan AÇILMAYACAK.** Restore hedefinde cron işleri, worker'lar
   ve `ledger_outbox` consumer'ı (drain) VARSAYILAN OLARAK KAPALI
   başlayacak. `PENDING`/`PROCESSING` kayıtlar OTOMATİK claim
   EDİLMEYECEK. Eski JWS/manifest/şeffaflık defteri artefaktları restore
   sonrası YENİDEN ÜRETİLMEYECEK — yalnız DOĞRULANACAK (§10'daki "restore
   güven sınırı" ilkesinin somutlaşması). Production signer veya
   production anchor staging'de KULLANILMAYACAK. Yeni staging artefaktı
   üretilmesi gerekiyorsa AYRI bir test signer ve staging'e özgü bir güven
   alanında üretilecek. **§10'daki duplicate-leaf/orphan-leaf/idempotency
   kontrolleri (H2, §9) TAMAMLANMADAN outbox consumer AÇILMAYACAK** —
   önceki taslağın "riski gözlemleyerek çalıştır" önerisinin YERİNE geçti;
   kurucu riski önce KAPATMAYI, sonra AÇMAYI tercih etti.

Her beş karar `docs/operasyon/YEDEKLEME_GERI_YUKLEME.md` §6 runbook'una ve
ROADMAP/DEVAM'daki açık karar listelerine işlendi.
