# KALKAN_OS Tehdit Modeli (M16 üretim kapanışı)

**Tarih:** 18 Temmuz 2026 · **Kapsam:** bugün canlıda olan yüzeyler (auth,
RLS, kanıt/SoD import zinciri, storage, cron/outbox). M19+ regülasyon
connector'ları ayrı bir güncellemede eklenecek (SSRF/parser yüzeyleri).

Yöntem: STRIDE'ı yüzey yüzey uyguluyoruz. Her yüzeyde **tehdit → bugünkü
kontrol → kanıt**. "Kontrol yok" olan satır bilinçli açık/borçtur.

---

## 1. Güven sınırları

- **Tarayıcı** (anon key + kullanıcı oturumu): güvenilmez. Anon key gizli
  değildir (RLS ile güvenli — kural 1).
- **Next.js sunucu** (route handler'ları, proxy.ts): service_role BURADA;
  tarayıcıya asla verilmez (`env.ts` bunu belgeliyor, `.env` sınırı).
- **Supabase Postgres** (RLS + SECURITY DEFINER guard'lar): asıl güvenlik
  sınırı. Uygulama kodu bir DB invariant'ının yerine geçmez (kural).
- **pg_cron / outbox drenajı**: `auth.uid()` NULL bağlamı; kimlik-atfı
  guard'ları bu bağlamı bilinçli muaf tutar.

## 2. Yüzey yüzey tehditler

### 2.1 Kimlik & oturum (Spoofing)
- **Tehdit:** çalıntı/taklit oturumla başka kullanıcı gibi davranmak.
- **Kontrol:** Supabase Auth; sunucu tarafında `getUser()` (cookie'ye güvenen
  `getSession()` DEĞİL — proxy.ts). Rol/tenant JWT'ye gömülmez, her istekte
  `profiles`'tan RLS altında okunur (eski token eski yetkiyle dolaşamaz).
- **Kanıt:** `src/lib/auth.tsx`, `src/proxy.ts` yorumları; canlıda gerçek giriş.

### 2.2 Tenant izolasyonu (Information disclosure / IDOR)
- **Tehdit:** A kiracısının B'nin verisini okuması/yazması (URL'de id
  değiştirme dahil).
- **Kontrol:** her tenant tablosunda `tenant_id` + RLS (`current_tenant_id()`).
  Rotalar RLS altında okur → başka kiracının satırı zaten görünmez; UPDATE
  denemesi 0 satır etkiler.
- **Kanıt:** `rls-*.test.ts` külliyatı (PGlite, gerçek migration'lar);
  `rls-guvenlik-sod.test.ts` cross-tenant IDOR denemeleri.

### 2.3 Yetki yükseltme (Elevation)
- **Tehdit:** kullanıcının kendini admin yapması / rol-tenant değiştirmesi.
- **Kontrol:** `prevent_profile_privilege_change` trigger'ı role/tenant_id'yi
  dondurur; `profiles_insert_self` yalnız boş tenant'a admin bootstrap'ı verir.
- **Kanıt:** `20260716120003`; `rls-guvenlik.test.ts`.

### 2.4 SoD import zinciri (Tampering / repudiation)
- **Tehdit:** dry-run ile apply arası veri değişip yanlış apply; sahte
  idempotency; rollback'i talep edenin kendisinin onaylaması; ters-set
  sahteleme.
- **Kontrol:** apply tek transaction + `for update` önizleme kilidi + kilit-altı
  stale re-check (409); 3 katman idempotency (durum kilidi / unique / ON
  CONFLICT); manifest append-only + `manifestHash`; **maker-checker DB guard'ı
  service_role'de bile** (rollback + istisna); ters-set apply ANINDA yakalanır.
- **Kanıt:** `20260718040000/060000`; canlı smoke (çift-apply + self-onay reddi);
  `rls-sod-import-apply/rollback.test.ts`.

### 2.5 Dolaylı özdeşlik (Spoofing — bu turda kapatıldı)
- **Tehdit:** istisnayı başkası adına talep edip kendisi "farklı kişi" olarak
  onaylamak; onay/kapanış atfını (onaylayan_id/resolved_by) sahtelemek.
- **Kontrol:** kimlik atfı alanları oturum sahibine sabit (`auth.uid()`);
  service bağlamı muaf.
- **Kanıt:** `20260718070001`; `rls-guvenlik-sod.test.ts` (migration'suz KIRMIZI
  koşularak 3 açık kanıtlanıp kapatıldı).

### 2.6 CSV/dosya girişi (Tampering / injection)
- **Tehdit:** formula injection (`=cmd`), null-byte, aşırı boyut, sahte MIME,
  çift uzantı.
- **Kontrol:** `csvAyristir` (null-byte/boyut/kolon/satır/hücre + formula-önek
  reddi) + `csvDosyasiKabulEdilebilirMi` (uzantı+MIME allowlist).
- **Kanıt:** `sod-import.test.ts` (35).

### 2.7 Storage / kanıt (Information disclosure)
- **Tehdit:** başka kiracının kanıtını indirmek; kalıcı sızıntı linki.
- **Kontrol:** private `evidence` bucket, içerik-adresli `{tenant}/{sha256}`,
  storage.objects RLS; indirme kısa ömürlü (60 sn) imzalı URL.
- **Kanıt:** M11 canlı script (başka tenant yoluna yükleme reddi, bucket private).

### 2.8 Cron / outbox (Tampering / DoS)
- **Tehdit:** istemcinin outbox/manifest'i değiştirmesi; drenajın çift değerlendirme
  yapması; cron duplicate.
- **Kontrol:** outbox/manifest istemci UPDATE/DELETE revoke; drenaj olayları
  `.eq('durum','PENDING')` ile idempotent DONE; tetikte tenant-başına debounce;
  cron tek kayıt (`sod_cron_durumu()` → 1).
- **Kanıt:** `rls-sod-import-apply.test.ts` append-only; `rls-sod-tetikler.test.ts`.

### 2.9 XSS / secret sızıntısı
- **Tehdit:** kullanıcı metninin script olarak çalışması; secret'ın loga/bundle'a
  düşmesi.
- **Kontrol:** React default escaping; tek `dangerouslySetInnerHTML` = tema
  no-flash script'i (statik, kullanıcı girdisi yok); CSP report-only; loglara
  PII/kanıt yazılmaz (kural 7); service_role bundle'da yok.
- **Kanıt:** `next.config.ts` CSP; `env.ts`; kod incelemesi.

## 3. Bilinen açık kalanlar (kabul edilen borç)
- **Rate limiting / brute-force:** uygulama katmanında yok (Supabase Auth kendi
  sınırlarını uygular). Hostinger/proxy seviyesinde rate limit → operasyon borcu.
- **CSP enforce:** bugün report-only (ihlal envanteri toplanıyor).
- **HSTS:** kontrollü rollout bekliyor.
- **Staging yok:** migration'lar tek ortamda deneniyor (PGlite + canlı smoke ile
  yönetiliyor) — kurucu kararı K1.
- **Dış cron:** servis-token'lı drenaj ucu ADR'lik (K2).

## 4. Güncelleme tetikleyicileri
Yeni tablo/rota/connector, yeni rol, dış gönderim veya credential bağlama —
her biri bu belgeye yeni bir yüzey satırı ekler.
