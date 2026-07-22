# Yedekleme ve Geri Yükleme (M16 üretim kapanışı)

**Tarih:** 18 Temmuz 2026 · **Proje:** Supabase `jgunbctnoprklseusaee`
(Session Pooler; direct connection IPv6-only).

## 1. Neyin yedeği var

| Katman | Yedek mekanizması | Durum |
|---|---|---|
| Postgres verisi | Supabase otomatik günlük yedek (plan dahilinde) | Platformca sağlanıyor; **restore hiç prova edilmedi** (aşağıda) |
| Şema (migration'lar) | `supabase/migrations/*.sql` git'te (kaynak-kod = şema kaynağı) | ✅ tam; PGlite + canlı ile doğrulanıyor |
| Kanıt dosyaları | private `evidence` bucket (içerik-adresli `{tenant}/{sha256}`) | Supabase Storage yedeği; içerik-adresli olduğu için hash'ten yeniden doğrulanabilir |
| Denetim bütünlüğü | audit_log hash zinciri + immutable manifest'ler | Restore sonrası zincir bağımsız doğrulanabilir (verify-paket CLI) |

## 2. Geri yükleme prosedürü (yazılı — prova K1'e bağlı)

### 2.1 Şemayı boş bir projeye kur (her zaman mümkün, provalı yol)
```
# Yeni Supabase projesi aç → .env.local'i o projeye yönelt →
pnpm db:push        # tüm migration'lar sırayla
pnpm db:verify      # çekirdek tabloların fiilen var olduğunu doğrula
pnpm db:types       # tipleri yeni projeye göre üret
```
Bu yol PGlite testleriyle her gün fiilen doğrulanıyor (migration seti temiz
uygulanıyor). **Şema kurtarma provalı.**

### 2.2 Veri geri yükleme (Supabase snapshot'tan)
1. Supabase Dashboard → Database → Backups → hedef günü seç.
2. **Point-in-time / snapshot restore** yeni bir projeye (üretimin ÜZERİNE
   restore ETME — önce yeni projeye al, doğrula, sonra DNS/env değiştir).
3. Restore sonrası MUTLAKA:
   - `pnpm db:verify` (tablolar var mı),
   - audit_log hash zinciri doğrulaması (`verify_audit_chain` RPC),
   - bir SoD import manifesti için `manifestHash` yeniden hesabı,
   - bir kanıt dosyası için `sha256` yeniden doğrulaması (içerik-adresli).

### 2.3 Kanıt dosyası kurtarma
Storage içerik-adresli olduğu için bir nesnenin bütünlüğü adından
(`{tenant}/{sha256}`) doğrulanır: indir → SHA-256 hesapla → yol ile karşılaştır.
Uyuşmazlık = bozulma sinyali.

## 3. PROVA DURUMU — dürüst

- **Şema restore: PROVALI** (PGlite + boş-projeye db:push her gün koşuyor).
- **Veri snapshot restore: PROVA EDİLMEDİ.** Supabase yedekleri var ama gerçek
  bir restore→doğrula turu yapılmadı. Tam prova ayrı bir Supabase projesi
  (maliyet) ister → **kurucu kararı K1 (staging)**. K1 "evet" olunca prova bu
  belgeye tarih+sonuçla işlenir; o zamana kadar bu bir YAZILI PROSEDÜR ama
  DOĞRULANMAMIŞ restore'dur (üretim kapısında bu satır açıkça borç sayılır).

## 4. RPO/RTO (hedef, ölçülmedi)
- RPO: Supabase günlük yedek → en kötü ~24 saat veri kaybı (PITR planı varsa
  daha düşük — plan doğrulanmalı).
- RTO: şema ~dakikalar (db:push), veri restore Supabase snapshot süresine bağlı
  (ölçülmedi). K1 provasında ölçülüp buraya yazılacak.

## 5. K1 PROVA KANIT ZİNCİRİ (kurucunun 22 Temmuz 2026 kararı — Dikey G1
kapanışı sonrası) — GERÇEK MÜŞTERİ VERİSİ ALINMADAN ÖNCE BLOKLAYICI ÇIKIŞ
KAPISI

Bu bölüm §3'ün "PROVA EDİLMEDİ" borcunu operasyonel olarak nasıl kapatacağını
yazılı hâle getirir. **Prova bir kod görevi değildir** — kurucunun/ekibin
Supabase erişimi ve staging ortamı gerektirir; Claude bu adımları
YÜRÜTEMEZ, yalnız hazırlayabilir/doğrulayabilir (script/checklist).

### 5.1 Kanıt zinciri (kurucunun sırası)

```
production-benzeri staging
→ kontrollü test tenant verisi
→ backup oluşturma
→ ayrı ortama restore
→ auth/profile/tenant üyelik kontrolü
→ RLS ve cross-tenant negatif testler
→ kritik hizmet/kontrol/tedarikçi bütünlüğü
→ onboarding state kontrolü
→ uygulama smoke
→ ölçülen restore süresi
→ yazılı sonuç ve bağımsız inceleme
```

Her adım bir öncekinin ÜZERİNE inşa edilir — bir adım başarısız olursa
prova durur, kayıt "BAŞARISIZ" olarak bu belgeye işlenir (sessizce
atlanmaz, tekrar denenmeden önce kök neden yazılır).

### 5.2 Dikey G1 tablolarının AYRICA doğrulanması gereken kalemleri

K1'in genel `db:verify` + hash-zinciri kontrolüne EK olarak, restore
sonrası şu G1-özgü bütünlük noktaları AÇIKÇA kontrol edilmeli (bunlar genel
kontrolde örtük değildir — provisioning/onboarding kendi guard/audit
zincirlerine sahiptir):

- [ ] Pilot tenant kaydı (`tenants`) restore sonrası eksiksiz.
- [ ] İlk admin üyeliği (`profiles` — tenant_id/role doğru, CHECK
      constraint'ler [`profiles_tenant_id_role_check`] geçerli).
- [ ] Davet ve onboarding durumu (`tenant_provisioning.durum` restore
      ANINDAKİ ile birebir; durum makinesi guard'ı restore sonrası da
      geçersiz geçişleri reddediyor mu — bir negatif test ile doğrula).
- [ ] Kabul kayıtları (`tenant_onboarding_acceptances` — KVKK/şartlar
      satırları eksiksiz, append-only guard'ı hâlâ UPDATE/DELETE reddediyor).
- [ ] Kritik hizmet/kontrol/tedarikçi içe aktarma batch'leri
      (`onboarding_import_onizlemeleri.durum` + gerçekten uygulanmış
      kayıtlar `critical_business_services`/`tenant_controls`/
      `third_parties`'ta karşılığını buluyor mu).
- [ ] Mevzuat paketi seçimi (`tenant_regulation_scope` — yalnız VERIFIED
      paketlere bağlı olduğu kuralı restore sonrası da geçerli).
- [ ] Denetim izi (`tenant_provisioning_audit` — append-only, restore
      sonrası da UPDATE/DELETE reddediyor; INSERT/UPDATE sayısı orijinal
      ortamla eşleşiyor).
- [ ] Entitlement ve pilot tarihleri (`tenant_subscriptions.trial_bitis`,
      `tenant_provisioning.pilot_baslangic/pilot_bitis`).
- [ ] RLS cross-tenant negatif testi: restore edilmiş ortamda bir
      `platform_operator` oturumuyla BAŞKA bir tenant'ın iş verisini
      SEÇMEYE çalış — sıfır satır dönmeli (bkz. `src/lib/__tests__/
      rls-dikey-g1-onboarding.test.ts` test 6, AYNI iddia canlı ortamda
      TEKRAR kanıtlanmalı, PGlite'a güvenilmez).

### 5.3 Sonuç kaydı

Her prova denemesi (başarılı veya başarısız) bu bölüme YENİ bir alt başlık
olarak eklenir — üzerine yazılmaz (kural 2'nin ruhu, operasyonel belgede de
geçerli): tarih, ortam, ölçülen RTO, bulunan sorunlar, bağımsız inceleyenin
adı/tarihi.

**Durum: HAZIRLIK ANALİZİ TAMAMLANDI + BEŞ KURUCU KARARI KAPANDI (22 Temmuz
2026), PROVANIN KENDİSİ HENÜZ BAŞLAMADI.** Tam mimari analiz + karşılaştırma
+ kapanan kararlar: `docs/adr/PR0-K1-production-like-staging-backup-restore-
hazirlik-2026-07-22.md` §15 (özet §6.0 aşağıda). Dikey G2'ye geçmeden önce
ve gerçek müşteri (pilot) verisi sisteme girmeden önce PROVANIN KENDİSİ
zorunlu — karar kapanmış olmak provanın BAŞLADIĞI anlamına gelmez, ayrı bir
açık "başla" talimatı gerekir. Bu belge yalnız YAZILI/ÇALIŞTIRILABİLİR bir
runbook'tur, aşağıdaki hiçbir adım bu ADR/runbook güncellemesi sırasında
UYGULANMADI.

## 6. K1 Runbook — uygulanabilir adımlar (kod/canlı işlem içermez, kurucu onayı bekliyor)

Derin gerekçe/karşılaştırma için PR0-K1 ADR'sine bakın — burada yalnız
YAPILACAK adımlar, komut şablonları ve kontrol listeleri var.

### 6.1 Ön koşullar

- [x] Özel SMTP kapısı KAPALI (✅ tamamlandı, `OZEL_SMTP_KURULUMU.md`).
- [x] Bu runbook'un ADR'si (PR0-K1 §15'teki 5 karar) kurucu tarafından
      KAPANDI (22 Temmuz 2026) — özet §6.0 aşağıda.
- [ ] Supabase hesabında yeni proje açma yetkisi var.
- [ ] `.env.local`'in BUGÜN hangi projeye (`jgunbctnoprklseusaee`,
      production) işaret ettiği teyit edildi.
- [ ] Kurucudan açık "K1 provasına BAŞLA" talimatı alındı — karar kapanmış
      olmak provanın kendisini BAŞLATMAZ.

### 6.0 Kapanan beş karar — özet (tam gerekçe PR0-K1 ADR §15'te)

1. **Staging modeli:** KALICI, tamamen ayrı Supabase projesi — ayrı DB/
   Auth/Storage/key/URL/environment. Production verisi ASLA kopyalanmaz.
2. **Backup yöntemi:** ANA = Supabase managed backup (önce PRODUCTION
   projesinin panelinden PITR/plan uygunluğu doğrulanır). Bağımsız
   doğrulama = açık şema kapsamlı (`public`+`auth`+`cron`) `pg_dump`/
   `pg_restore`. Managed backup kullanılamıyorsa ana yöntem `pg_dump`'a
   döner ve bu sapma kanıt paketine yazılır.
3. **Storage yedeği:** DB backup'tan AYRI, gerçek dosya kopyalama + object
   manifest (path/size/MIME/checksum/evidence kaydı). Restore sonrası
   metadata YETMEZ — gerçek dosya indirilip hash'i yeniden hesaplanır.
4. **Staging SMTP:** AÇIK kalır (invite/reset testi için), ama yalnız
   kurucu onaylı allow-list adreslerine gönderim; gerçek müşteri/pilot
   adresi YASAK; e-posta içeriği/konusu staging olduğunu gösterir.
5. **Ledger/outbox:** Restore hedefinde cron/worker/outbox consumer
   VARSAYILAN KAPALI; PENDING/PROCESSING otomatik claim edilmez; eski
   artefaktlar yeniden üretilmez, yalnız doğrulanır; production signer/
   anchor kullanılmaz; duplicate/orphan-leaf/idempotency kontrolleri
   (§9 H2) TAMAMLANMADAN consumer açılmaz.

### 6.2 GÜVENLİK UYARILARI (her adımdan önce okunur)

1. **Her komuttan önce, hangi Supabase projesine bağlı olduğunuzu TEYİT
   EDİN.** Bu oturumda MCP/CLI bağlantısının YANLIŞ bir hesaba baktığı
   GERÇEKTEN yaşandı (PR0-K1 ADR §3) — "muhtemelen doğru proje" ile devam
   etmeyin, `echo $NEXT_PUBLIC_SUPABASE_URL` (veya ilgili env dosyasını)
   AÇIKÇA kontrol edin.
2. **Staging ve production için AYRI env dosyaları kullanın**
   (`.env.local` = production, `.env.staging.local` = staging — ikisi de
   gitignore'da). Aynı dosyada iki projenin bilgisini TUTMAYIN.
3. **Restore hedefi HER ZAMAN ÜÇÜNCÜ, boş bir proje/ortam olmalı** —
   production'ın ÜZERİNE ASLA restore etmeyin (bu belgenin §2.2'sinde
   zaten yazılı, K1'de de aynen geçerli).
4. **Staging'in Auth URL Configuration'ı production'dan TAMAMEN BAĞIMSIZ
   olmalı** — staging URL'lerini production'ın Redirect URLs allow-list'ine
   ASLA eklemeyin (bu oturumda AYNI sınıf bir hatanın gerçek sonucu
   `OZEL_SMTP_KURULUMU.md` §3.6'da kayıtlı).
5. **Gerçek müşteri/pilot verisi staging'e ASLA kopyalanmaz** — yalnız §8
   (ADR) sentetik veri paketi kullanılır.
6. **Hiçbir secret (service_role key, DB parolası, API key) bu belgeye,
   commit'e, chat'e veya log'a YAZILMAZ** — yalnız panel veya
   `.env.*.local` (gitignore'da) dosyalarına girilir.
7. **Restore hedefinde cron/worker/`ledger_outbox` consumer VARSAYILAN
   KAPALI başlar** (karar 5) — §9 H2'deki duplicate/orphan-leaf/
   idempotency kontrolleri TAMAMLANMADAN elle de AÇILMAZ.
8. **Staging SMTP yalnız kurucu onaylı allow-list adreslerine gönderim
   yapar** (karar 4) — gerçek müşteri/pilot adresine gönderim YASAK,
   e-posta konu/içeriği staging olduğunu göstermeli.
9. **Production signer veya production anchor staging'de KULLANILMAZ**
   (karar 5) — yeni bir staging artefaktı gerekiyorsa AYRI test signer.

### 6.3 Komut şablonları (ÇALIŞTIRILMADI — yalnız şablon)

```
# 1) Hangi projeye bağlı olduğunu teyit et (staging kurulumundan SONRA,
#    .env.staging.local'e geçmeden önce mutlaka):
grep NEXT_PUBLIC_SUPABASE_URL .env.staging.local

# 2) Staging'e migration uygula (mevcut, test edilmiş tooling — yeni script
#    YAZILMAZ):
cp .env.staging.local .env.local.bak-oncesi   # geçici, işlem sonunda silinir
pnpm db:link      # SUPABASE_ACCESS_TOKEN + staging project ref ister
pnpm db:push      # tüm migration'lar sırayla
pnpm db:verify    # çekirdek tabloların fiilen var olduğunu doğrula
pnpm db:types     # staging şemasına göre tip üret (geçici, commit edilmez)

# 3) Sentetik veri paketini yükle (PR0-K1 ADR §8 tasarımına göre YAZILACAK
#    yeni bir script — bu turda YAZILMADI, yalnız tasarımı var):
pnpm exec tsx scripts/setup-k1-fixtures.ts     # (henüz mevcut değil)

# 4) ANA yöntem: Supabase managed backup (karar 2) — panelden tetiklenir,
#    komut YOK. Önce panelde (§6.4 madde 7) PITR/plan uygunluğu doğrulanır;
#    kullanılamıyorsa bu adım atlanır ve pg_dump ANA yönteme döner (karar 2
#    sapma notu, kanıt paketine yazılır).

# 5) Bağımsız doğrulama: açık şema kapsamlı pg_dump (karar 2, Yöntem B —
#    auth/cron şemaları BİLİNÇLİ dahil, varsayılana bırakılmaz):
pg_dump --schema=public --schema=auth --schema=cron \
  "postgresql://postgres:$SUPABASE_DB_PASSWORD@$SUPABASE_DB_POOLER_HOST:5432/postgres" \
  -f k1-prova-dump.sql
sha256sum k1-prova-dump.sql

# 6) Storage yedeği (karar 3) — gerçek dosya kopyalama + manifest (henüz
#    yazılmamış bir script tasarımı, path/size/MIME/checksum/evidence-id
#    kolonlu bir CSV/JSON üretir):
pnpm exec tsx scripts/export-k1-storage-manifest.ts   # (henüz mevcut değil)

# 7) Restore hedefinde cron/outbox consumer'ın KAPALI olduğunu teyit et
#    (karar 5 — restore SONRASI, herhangi bir doğrulama testinden ÖNCE):
#    panelden Database -> Extensions/Cron bölümünde pg_cron job'larının
#    ya hiç kurulmadığını ya da devre dışı olduğunu kontrol et.

# 8) Restore sonrası doğrulama (mevcut tooling, hedef projeye karşı):
pnpm db:verify
pnpm exec tsx scripts/verify-paket.ts <klasor>
pnpm exec tsx scripts/verify-seffaflik.ts <klasor>
pnpm exec vitest run src/lib/__tests__/rls-dikey-g1-onboarding.test.ts

# 9) Storage restore doğrulaması (karar 3 — yalnız metadata DEĞİL, gerçek
#    dosya + hash):
#    indirilen dosyanın sha256'sını hesapla, path'teki hash ile karşılaştır
#    (mevcut §2.3 yöntemi, K1'in genişlemesi §9 D2).

# 10) Temizlik (§6.6):
rm .env.local.bak-oncesi k1-prova-dump.sql   # yerel geçici dosyalar
```

### 6.4 Panel adımları (kurucunun elle yapması gereken — PR0-K1 ADR §14)

0. **ÖNCE, staging açılmadan:** PRODUCTION projesinin (`jgunbctnoprklseusaee`)
   panelinden Database → Backups'ta managed backup/PITR özelliğinin plan
   dahilinde gerçekten var olduğunu doğrula (karar 2) — sonucu ne olursa
   olsun bu belgeye/kanıt paketine yazılır.
1. Supabase Dashboard → **yeni, KALICI** bir staging projesi oluştur (karar
   1 — geçici/prova-başına DEĞİL), bölge/plan seç.
2. Yeni projenin `Project Settings → API`'sinden URL/anon key'i
   `.env.staging.local`'e gir (AYRI dosya, production ile karışmaz).
3. `Project Settings → Database`'den DB şifresini ve pooler host'unu al.
4. Authentication → URL Configuration: staging'in KENDİ Site URL'i +
   Redirect URLs'i ayarla (production'la KARIŞTIRMA — bu oturumda AYNI
   sınıf bir hatanın gerçek sonucu `OZEL_SMTP_KURULUMU.md` §3.6'da kayıtlı).
5. Storage: `evidence` bucket'ını staging'de de private olarak oluştur.
6. SMTP (karar 4): custom SMTP staging'de de BAĞLANIR (kapatılmaz), ama
   gönderim yalnız kurucu onaylı allow-list test adreslerine yapılacak
   şekilde disiplinli kullanılır — e-posta şablonuna `[STAGING]` benzeri
   bir gösterge eklenmesi ayrı, küçük bir kod/panel işi (bu turda
   YAPILMADI, yalnız gereksinim olarak kayıtlı).
7. Backup: Database → Backups panelinden mevcut PITR/günlük backup
   özelliğini ve restore akışını incele (henüz TETİKLEME).
8. **pg_cron/Extensions:** staging projesinde migration'lar uygulandıktan
   sonra hangi cron job'larının otomatik kurulduğunu kontrol et — restore
   sonrası consumer'ın kapalı kalması gerektiği için (karar 5), gerekirse
   ilgili job'lar panelden/SQL ile devre dışı bırakılır (bu turda
   YAPILMADI).

### 6.5 Test matrisi

PR0-K1 ADR §9'daki tam matrisi (A1-H3) kullanın — bu runbook'ta tekrar
edilmedi, tek kaynak ADR'dir.

### 6.6 Rollback / cleanup

- Prova BAŞARISIZ olursa: restore hedefi SİLİNMEZ (kök neden analizi için
  saklanır), §5.3'e "BAŞARISIZ" olarak işlenir, tekrar denemeden önce kök
  neden yazılır (kural: sessizce atlanmaz).
- **Staging projesinin KENDİSİ (kaynak) KALICIDIR (karar 1)** — prova
  başarılı da olsa başarısız da olsa SİLİNMEZ; yalnız restore HEDEFİ
  (§7 adım 4'teki üçüncü, ayrı ortam) prova/kanıt paketi tamamlandıktan
  sonra arşivlenir veya silinir, kaynak staging etkilenmez.
- Restore hedefinde açılan (varsa) herhangi bir cron/outbox consumer,
  prova bitince — başarılı da olsa — TEKRAR kapatılır (karar 5'in
  varsayılan-kapalı ilkesi kalıcı, tek seferlik bir istisna değildir).
- Yerel geçici dosyalar (`*.bak-oncesi`, dump dosyaları, storage manifest
  export'u, `.env.staging-restore.local`) prova sonunda SİLİNİR — hiçbiri
  commit edilmez.

### 6.7 Kanıt paketi

PR0-K1 ADR §12'deki tam şablonu kullanın (prova kimliği, tarih, uygulayan/
inceleyen, ortam kimlikleri, checksum, test matrisi sonucu, ölçülen
süreler, commit/migration/build SHA, son onay — secret'sız). Tamamlanan
kanıt paketi bu belgenin §5.3'üne YENİ bir alt başlık olarak eklenir.
