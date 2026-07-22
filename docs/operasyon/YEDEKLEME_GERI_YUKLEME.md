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

**Durum: HENÜZ YAPILMADI** (22 Temmuz 2026 itibarıyla). Dikey G2'ye
geçmeden önce ve gerçek müşteri (pilot) verisi sisteme girmeden önce
zorunlu.
