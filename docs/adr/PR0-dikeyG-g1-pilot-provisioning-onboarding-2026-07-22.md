# ADR — Dikey G1: Kontrollü Pilot Provisioning ve Kurum Onboarding

**Tarih:** 22 Temmuz 2026
**Durum:** KABUL EDİLDİ (kurucu "Kararlarım" — bu belge onları + keşif sırasında bulunan bir gerçek açığı yansıtır)

## 1. Bağlam

Dikey F (F1→F5.1) çekirdek güvence zincirini olgunlaştırdı, ama bugün
**hiçbir yeni kurumu kendi başımıza sisteme sokamıyoruz** — hiçbir signUp/
inviteUser/createUser rotası yok; tek yol service_role script'i (bkz.
`scripts/setup-e2e-fixtures.ts`). G1 bu boşluğu kapatır: WARDPROOF operatörü
gerçek bir pilot kurumu güvenli/denetlenebilir biçimde oluşturur, ilk kurum
yöneticisini davet eder, kurum kendi temel verisini (kritik hizmet/kontrol/
tedarikçi) sisteme alır. **Bu bir billing/self-servis büyüme sistemi
DEĞİLDİR** — o, ayrı bir gelecek dilim olan G2'ye bırakılır.

## 2. Keşif sırasında bulunan GERÇEK açık (G1'den ÖNCE kapatılmalı)

`auth/profiles/tenant` grep sweep'i (kurucunun istediği ilk adım) şunu
ortaya çıkardı: `20260716120003_rls_helpers_tenants_profiles.sql`'de **hâlâ
canlıda duran** iki RLS politikası —

```sql
create policy tenants_insert_authenticated on public.tenants
  for insert with check (auth.role() = 'authenticated');

create policy profiles_insert_self on public.profiles
  for insert with check (
    id = auth.uid() and role = 'admin'
    and not public.tenant_has_profiles(tenant_id)
  );
```

— **herhangi bir authenticated Supabase Auth kullanıcısının (uygulama UI'ı
hiç gerekmeden, doğrudan PostgREST/REST çağrısıyla) yeni bir tenant açıp
kendini o tenant'ın admin'i yapabildiği** bir self-servis bootstrap
mekanizmasıdır — dosyanın kendi yorumu bunu M1'in "self-serve bootstrap"
niyeti olarak açıklıyor ve altında literal bir `TODO(M1): add public.
invite_user(...)` bırakmış. Kod tabanında `signUp`/`inviteUserByEmail`/
`createUser` hiç çağrılmıyor (grep doğrulandı) — yani bu politika **ölü
kod değil, canlı ve kullanılmayan bir arka kapı**.

Kurucunun G1 kararı ("açık internetten Kayıt Ol ekranı yapılmayacak, self-
servis provisioning G2'ye bırakılacak") bu politikayla doğrudan çelişiyor:
UI'da böyle bir ekran olmasa bile RLS bunu hâlâ izin veriyor. **Bu ADR'nin
ilk migration'ı bu iki politikayı kapatır** (forward-fix, `20260722000000`)
— `tenants` INSERT ve "boş tenant'a kendini admin yap" INSERT'i artık
yalnız `service_role`'e (yani yalnız bu dilimin provisioning rotasına)
açık. Hiçbir mevcut akış bu politikaya bağımlı değildi (e2e fixture'ı zaten
service_role kullanıyor) — davranış kaybı yok, yalnızca kapatılmamış bir
risk kapanıyor.

## 3. Rol modeli

Mevcut `profiles.role` CHECK: `'admin' | 'uyum' | 'denetci_misafir'`.
Forward-fix ile eklenir: **`platform_operator`**.

`platform_operator`:
- tenant oluşturabilir, ilk `TENANT_ADMIN`* davetini başlatabilir, pilot
  planı/süresini (`tenant_subscriptions.trial_bitis`) atayabilir.
- **kurumun iş verisini (kontrol/kritik hizmet/kanıt/bulgu/test) hiç
  GÖREMEZ/DÜZENLEYEMEZ** — RLS bunu satır seviyesinde zorlar: platform_
  operator'ın `tenant_id`'si `NULL` kalır (kendi tenant'ı yoktur, herhangi
  bir tenant'a ait değildir), bu yüzden `current_tenant_id()`'ye dayanan
  HİÇBİR mevcut tenant-scoped SELECT politikası ona satır döndürmez —
  yeni bir "hariç tut" kuralı icat edilmedi, mevcut izolasyon zaten yeter.
  Yalnız provisioning'e özgü YENİ tablolara (aşağıda) erişimi vardır.

(*) `TENANT_ADMIN` ayrı bir rol DEĞİLDİR — ilk davet edilen kullanıcı bugün
zaten var olan `role='admin'` ile oluşturulur (kurucunun "olur" dediği
karar, yeni bir rol adı icat etmiyoruz). "TENANT_ADMIN" bu belgede yalnız
kavramsal isimdir.

`profiles.tenant_id` bugün `NOT NULL` — `platform_operator` için bu alan
NULL olabilmeli (bir platform operatörünün kendi iş-verisi tenant'ı yoktur).
Forward-fix: `tenant_id` nullable'a çevrilir + CHECK: `role = 'platform_
operator' ⟺ tenant_id IS NULL` (rol/tenant_id tutarlılığı DB'de zorunlu,
biri diğerini gizlice yalanlayamaz).

## 4. Tek-tenant sınırı — AÇIKÇA beyan edilir, gizlenmez

`profiles.id references auth.users(id)` (PK, 1:1) + `tenant_id` tekil alan
— bugünkü şema bir kullanıcının BİRDEN FAZLA tenant'a ait olmasını yapısal
olarak desteklemiyor (gerçek bir `tenant_memberships` join tablosu gerekir,
bu G1'in kapsamı dışındaki büyük bir mimari değişikliktir). Kurucunun şartı
("tek tenant varsayımı gizlice dayatılmamalı") bu dilimde şöyle karşılanır:
davet rotası, hedef e-posta **BAŞKA bir tenant'ta zaten bir profile
sahipse** işlemi **AÇIKÇA reddeder** (409, `EMAIL_BASKA_TENANTA_BAGLI`) —
sessizce üzerine yazmaz, sessizce göz ardı etmez. Gerçek çoklu-tenant
üyeliği G2+ kapsamına not düşüldü.

## 5. Yeni veri modeli (migration `20260722000000` → `20260722050000`)

**A) Rol + tenant_id nullable** (`20260722000000`, yukarıdaki §2 kapatmasıyla
aynı migration'da): `platform_operator` rolü, `tenant_id` nullable + tutarlılık
CHECK'i, self-servis bootstrap politikalarının kapatılması.

**B) `tenant_provisioning`** (`20260722010000`) — append-only, bir pilot
tenant'ın YAŞAM DÖNGÜSÜNÜ izler (billing/entitlement DEĞİL — bkz. §6):

```sql
create table public.tenant_provisioning (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  durum text not null default 'HAZIRLIK' check (durum in (
    'HAZIRLIK', 'DAVET_GONDERILDI', 'ILK_GIRIS_TAMAMLANDI',
    'KURULUM_DEVAM_EDIYOR', 'KURULUM_INCELEMEDE', 'PILOT_AKTIF',
    'PILOT_DONDURULDU', 'PILOT_SONA_ERDI'
  )),
  olusturan uuid not null references public.profiles (id) on delete restrict,
  davet_edilen_eposta text,
  davet_edilen_kullanici_id uuid references auth.users (id) on delete set null,
  pilot_baslangic date,
  pilot_bitis date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Durum geçişleri **DB guard'lı** (kural 14 disiplini — sunucu, keyfi atlama
yok): yalnız ADR §7'de tanımlı sıralı geçişlere izin veren bir trigger.
`olusturan` HER ZAMAN `platform_operator` — DB guard bunu zorlar (kimlik
atfı sabit, F1'in "hazirlayanBelirtildi" deseni: ham kimlik dışarı sızmaz,
Proof Room'a hiç girmez zaten — bu tablo Proof Room'a bağlanmaz).

**C) `tenant_provisioning_audit`** (aynı migration) — append-only, her durum
geçişini + kim/ne zaman'ı kaydeder (immutable, `impact_graph_snapshots`
deseniyle aynı: UPDATE/DELETE service_role dahil kapalı).

**D) KVKK/kullanım şartları kabulü** (`20260722020000`) —
`tenant_onboarding_acceptances`: `tenant_id`, `profile_id`, `kabul_edilen_
belge` (`'KVKK' | 'PILOT_KULLANIM_SARTLARI'`), `belge_surumu`, `kabul_
zamani`. Append-only — bir kabul kaydı asla silinmez/değiştirilmez (hukuki
delil niteliği).

**E) İçe aktarma STAGING** (`20260722030000`) — SoD'nin PR-3A/3B deseninin
AYNENİ tekrarı (kural: üçüncü bir import motoru icat etme): kritik hizmet/
kontrol/tedarikçi CSV'leri için `onboarding_import_previews` (dry-run,
append-only, hash'li) + `onboarding_import_uygula` (tek transaction apply,
maker-checker: talep eden ≠ onaylayan zorunlu — SoD'nin import rollback'inde
zaten kurulu guard aynen kopyalanır). Bu, "içe aktarım doğrudan canlı kayıt
üretmemeli, önce staging/batch, sonra tenant admin onayı" şartını SoD'nin
KENDİ kanıtlanmış makine­sini yeniden kullanarak karşılar.

**F) Regülasyon paketi seçimi** (`20260722040000`) — `tenant_regulation_scope`:
tenant başına hangi mevzuat paketinin (yalnız `hukuk_dogrulama_durumu=
'VERIFIED'` olan paketler seçilebilir — bkz. §8) etkin olduğunu kaydeder;
append-only + audit. Seçilmeyen mevzuat asla "uygulanabilir" sayılmaz
(applicability motoru zaten bunu UNKNOWN'a düşürür — yeni bir kural icat
edilmiyor, mevcut `applicability.ts` sözleşmesi aynen kullanılıyor).

**G) MFA politikası** (aynı migration `20260722000000`'a eklenir):
`tenant_provisioning.mfa_zorunlu boolean not null default true` — pilot
tenant'lar varsayılan olarak zorunlu MFA ile açılır (kurucu farklı karar
almadıkça).

## 6. `tenant_provisioning` neden `tenant_subscriptions`'ın YERİNE geçmiyor

Kurucunun istediği "pilot planı ve süresi" **mevcut** `tenant_subscriptions`
+ `subscription_events` (V2 PR-2c, zaten kurulu, sürümlü/append-only) ile
KARŞILANIR — yeni bir plan/billing kavramı icat edilmiyor. Provisioning
rotası, tenant oluşturduğunda `tenant_subscriptions` satırını da açar
(`trial_bitis` = pilot bitiş tarihi, `subscription_events` 'TRIAL_STARTED'
kaydı). `tenant_provisioning` YALNIZ onboarding SÜRECİNİN durumunu izler
(davet gönderildi mi, sihirbaz bitti mi) — bu, "abonelik durumu" ile "kurulum
süreci durumu" AYRI eksenlerdir (bir tenant PILOT_AKTIF olabilir ama
aboneliği `aktif` durumundadır zaten; ikisini tek tabloya sıkıştırmak farklı
anlamları karıştırırdı).

## 7. Onboarding durum makinesi geçişleri (guard'lı)

```
HAZIRLIK → DAVET_GONDERILDI              (davet API'si)
DAVET_GONDERILDI → ILK_GIRIS_TAMAMLANDI  (ilk giriş tamamlama API'si)
ILK_GIRIS_TAMAMLANDI → KURULUM_DEVAM_EDIYOR   (sihirbaz ilk adım kaydı)
KURULUM_DEVAM_EDIYOR → KURULUM_INCELEMEDE     (sihirbaz "tamamla")
KURULUM_INCELEMEDE → PILOT_AKTIF              (platform_operator onayı)
PILOT_AKTIF → PILOT_DONDURULDU → PILOT_AKTIF  (iki yönlü, yalnız operatör)
PILOT_AKTIF | PILOT_DONDURULDU → PILOT_SONA_ERDI  (tek yönlü, geri dönüşsüz)
```

Başka hiçbir geçişe izin verilmez (trigger reddeder). `PILOT_SONA_ERDI`
TERMİNAL'dir — kurucunun "billing/downgrade veri silmez" ilkesiyle tutarlı:
sona erme veri SİLMEZ, yalnız erişimi kapatır (route katmanında, ayrı bir
rota gerekmez — mevcut `entitlement-server.ts` deseni: `tenant_subscriptions.
durum` zaten bunu yapıyor, provisioning bunu TEKRAR icat etmez, yalnız
PILOT_SONA_ERDI geçişinde `tenant_subscriptions.durum='iptal'`i de tetikler).

## 8. Regülasyon paketi — "pilota hazır" tanımı DB'de zorlanır

`data/controls/*.yaml` seed'ine YENİ zorunlu alanlar EKLENMEZ (kural 3:
mevzuat içeriği yalnız YAML'dan gelir, motor uydurmaz) — bunun yerine
YENİ bir `regulation_packages` kataloğu (kod, ad, `hukuk_dogrulama_durumu`,
`dogrulayan`, `dogrulama_zamani`, `kaynak_url`, `yayim_tarihi`, `surum`)
seed edilir ve HER paket kaydı kendi `madde_ref` kümesine işaret eder.
`tenant_regulation_scope` YALNIZ `hukuk_dogrulama_durumu='VERIFIED'` olan
paket kod'larını kabul eder (DB CHECK + trigger, UI değil — "taslak paket
varsayılan seçim olamaz" kuralı sunucu tarafında). Bugün repo'daki 7545/
vii-128-10 içeriğinin BÜYÜK kısmı `TODO_DOGRULA` — bu ADR bunu DOĞRULAMAZ,
yalnız doğrulanmamış içeriğin pilot kapsamına asla sessizce giremeyeceği
mekanizmayı kurar. Kurucunun BDDK/SPK paket eşlemesi hukuk uzmanınca
doğrulanana kadar `regulation_packages` boş veya tamamı `DRAFT` kalır —
bu ADR'nin kapsamı DEĞİL (ayrı, hukuki bir iştir).

## 9. API yüzeyi (özet — route bazlı, service_role rotanın İÇİNDE kalır)

- `POST /api/platform/tenants` (yalnız `platform_operator`): tenant + org
  profili + subscription + provisioning satırı + davet — TEK transaction
  (RPC, `sod_import_uygula` deseniyle aynı atomiklik disiplini).
- `POST /api/platform/tenants/[id]/davet`: mevcut tenant'a ek davet.
- `GET/POST /api/onboarding/*`: `TENANT_ADMIN` oturumuyla, kendi tenant'ının
  sihirbaz adımlarını okur/yazar (RLS zaten tenant'a kilitli).
- `POST /api/onboarding/import/{kritik-hizmet,kontrol,tedarikci}/onizle` +
  `/uygula`: SoD import rotalarının BİREBİR aynı iskeleti (kopyala-uyarla,
  yeni motor değil).
- İlk giriş: Supabase'in KENDİ `inviteUserByEmail` + `verifyOtp`/parola
  belirleme akışı kullanılır (özel bir token tablosu YAZILMAZ — Supabase
  Auth'un tek-kullanımlık/süreli/e-postaya-kilitli davet linki zaten bu
  şartları karşılıyor; tekerleği yeniden icat etmiyoruz). Uygulama yalnız
  "ilk giriş tamamlandı" olayını (`auth.users.last_sign_in_at` İLK kez
  dolduğunda, ya da parola belirleme sonrası tetiklenen bir sunucu callback'i)
  `tenant_provisioning`'e yansıtır.

## 10. Kapsam dışı (kurucu kararı — bu ADR'de KOD YOK)

Açık self-servis kayıt · Stripe/iyzico/PayTR/otomatik tahsilat · gerçek
üretim connector'ları (AWS/Azure/M365/IAM) · tüm mevzuat kütüphanesinin
doğrulanması · otomatik kontrol eşlemesi · AI ile uygulanabilirlik kararı ·
platform operatörünün müşteri verisini düzenlemesi · çok bölgeli dağıtım ·
white-label · partner portalı · tam abonelik yükseltme/düşürme sistemi ·
gerçek çoklu-tenant kullanıcı üyeliği (bkz. §4) · MFA'nın TAM politika
motoru (bu dilimde yalnız zorunlu/opsiyonel bayrağı + enrollment akışı).

## 11. K1/K2

K1 (staging + gerçek restore provası) bu dikeyin **bloklayıcı çıkış
kapısıdır** — kod DEĞİL, operasyonel bir provadır; bu ADR onun runbook'unu
(`docs/operasyon/YEDEKLEME_GERI_YUKLEME.md`) referans alır, YENİDEN yazmaz.
K1'in fiilen YAPILMASI (staging ortamı + gerçek restore) kurucunun/ekibin
altyapı erişimi gerektirir — bu belge bunu bir uygulama görevi olarak
listelemez, kabul kriteri olarak işaretler.

K2 (harici cron güvenilirliği) paralel iş; bu dilim yalnız KRİTİK job
envanterini çıkarır (aşağıda, uygulama sırasında) ve mevcut pg_cron
işlerinin (M16 süre-dolumu, kanıt süre-dolumu vb.) harici sağlık kontrolüne
bağlanıp bağlanmadığını RAPORLAR — yeni bir izleme altyapısı kurmaz (bu G1'in
kapsamı dışına taşan ayrı bir operasyonel iştir, ADR §10'a eklenir).

## 12. Test disiplini

PGlite/RLS: `platform_operator`'ın tenant-scoped hiçbir tabloyu GÖREMEDİĞİ +
self-servis bootstrap politikalarının GERÇEKTEN kapandığı (saldırgan testi:
authenticated ama profilsiz bir kullanıcı `tenants`'a INSERT denemeli, RED
almalı) + email-çakışması reddi + durum makinesi guard'ı (izinsiz geçiş RED).
Chromium e2e: platform operatör tenant açar → davet → (gerçek email
gönderilemeyeceği için) test ortamında `generateLink`'in döndürdüğü action
link'i doğrudan ziyaret ederek ilk girişi simüle eder → sihirbazın en az bir
adımı → import dry-run → apply. Tam regresyon + typecheck/lint/build.
