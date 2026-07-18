# PR-0 — Master Talimat Keşfi, Baseline ve Plan (18 Temmuz 2026)

**Kaynak belge:** `docs/arastirma/KALKAN_OS_Master_Talimat_UI_Regulasyon_2026.md`
(kurucunun altıncı vizyon belgesi, birebir kopya `diff` ile doğrulandı).
Belgenin §35 "İlk komut" talimatı gereği bu turda **kod yazılmadı** — yalnız
keşif, baseline, envanterler, ADR taslakları ve dosya bazlı plan üretildi.

---

## 1. Repository keşfi (ölçülmüş, tahmin değil)

### Stack (package.json'dan)

| Katman | Gerçek | Belgeyle uyum |
|---|---|---|
| Framework | **Next.js 16.2.10** (App Router) + React 19.2.4 | ✓ SSR var → tema hydration-flash kuralı geçerli |
| CSS | **Tailwind v4** (CSS-first `@theme inline`, `globals.css`) | ✓ belge "Tailwind varsa CSS variables + semantic tokens" diyor — zemin hazır |
| Component | **shadcn v4 + @base-ui/react** + CVA + lucide-react | ✓ "mevcut library'yi genişlet, paralel sistem kurma" → shadcn üzerine inşa |
| DB | Supabase JS 2.110 + @supabase/ssr 0.12 (getAll/setAll cookie deseni) | ✓ belge §22 ile uyumlu |
| Test | Vitest 4 + PGlite (RLS) + Playwright 1.61 gerçek Chromium | ✓ |
| i18n | **YOK** — metinler component içinde Türkçe sabit; `ui-labels.ts` kısmi merkez | ✗ belge §11 i18n anahtarı istiyor → PR-1/PR-2'de kademeli |

### Tema mevcut durumu

- `globals.css`'te `.dark` custom variant ve tam dark token seti **TANIMLI ama
  HİÇ KULLANILMIYOR** — `layout.tsx`'te ThemeProvider/`.dark` class yok.
  Bugünkü ürün yalnız light (düz beyaz, nötr oklch shadcn varsayılanları).
- Sonuç: tema altyapısının yarısı bedava; eksik olan switcher + persistence +
  no-flash inline script + semantic token değerlerinin markaya çekilmesi.

### Uygulama kabuğu mevcut durumu

- Tek üst header (`(app)/layout.tsx`): 7 nav linki, `max-w-6xl` içerik.
- **Sol rail yok, mobil nav yok, komut paleti yok, inspector yok** — belge §7
  kabuğunun tamamı yeni iş.
- Client-side auth yönlendirme (UX katmanı; gerçek kontrol RLS'te — doğru desen).

---

## 2. Test baseline (bu oturumda ölçüldü — belgedeki sayı bayat)

| Belgenin bildiği (§1.1) | Gerçek (18 Temmuz, `pnpm check` + e2e) |
|---|---|
| 581 birim + 17 e2e | **631 birim (37 dosya) + 17 e2e** |
| M16 CSV import "sıradaki iş" | **PR-3A VE PR-3B BİTTİ** (aşağıda §7) |

- Birim: 631 geçti / 0 başarısız / **0 skip**.
- e2e: 17 geçti / 0 başarısız / **0 skip** (`sod.spec.ts` bu oturumda ayrıca koşuldu: 2/2).
- Typecheck + lint temiz.
- Flaky gözlenmedi.

---

## 3. Hostinger deploy tipi — DOĞRULANDI: Seçenek A (managed Node.js app)

`OPEN-DECISION` değil; 17 Temmuz'da kanıtla kapatıldı (ROADMAP "Deploy artık
DOĞRULANDI"):

- Hostinger Business, **Node.js otomatik dağıtım**; GitHub `orhanluce/kalkan_os`
  `main` branch'inden otomatik çeker; build `pnpm run build`; Node **22.x**.
- Geçici alan adı `blue-yak-865668.hostingersite.com`; kurucu ekran görüntüsü
  (giriş yapılmış pano, gerçek kiracı verisi) + curl (`/` → 307 → `/giris`,
  `/dogrula/[hash]` → 200) ile doğrulandı.
- **Bilinen sınır:** Playwright/Chromium isteyen PDF/ZIP rotaları bu paylaşımlı
  hostta çalışmaz → bilinçli 503 ("Chromium destekli ortam gerekiyor").
- Belge Seçenek B'yi (VPS+Docker) M25 worker ihtiyacı ölçülürse yeniden açar;
  bugün gerek yok (ADR-T4 aşağıda).
- **Eksik (belge §26'dan):** `/health/live`–`/health/ready` endpoint'i yok;
  CSP/HSTS başlıkları yapılandırılmadı; rollback prosedürü yazılı değil → PR-1
  kapsamına alındı (aşağıda §6 planı).

---

## 4. Supabase mimari envanteri

- **39 migration** (son: `20260718040000_sod_import_apply` — bu oturumda canlıya
  uygulandı, `pnpm db:push`). Migration akışı: PGlite testler → `db:push`
  (session pooler; direct connection IPv6-only) → canlıda gerçek yazma denemesi
  → `db:types` ile tip regen (commit edilir).
- **RLS:** her tenant tablosunda `tenant_id` + policy; PGlite harness
  (`__tests__/helpers/pg.ts`) gerçek migration dosyalarına karşı koşar; revoke
  ifadeleri migration'lardan otomatik toplanır (append-only testleri sessizce
  yeşil kalamaz).
- **Storage:** private `evidence` bucket, içerik-adresli `{tenant_id}/{sha256}`,
  imzalı URL; RLS canlıda doğrulandı (PGlite storage'ı taklit edemez — bilinen
  sınır, canlı script kanıtı var).
- **Cron (pg_cron, canlıda zamanlı):** `kalkan-sure-dolumu` `*/5` — idempotent
  iki iş: `sod_istisna_suresi_dolanlari_isle` + `kanit_suresi_dolanlari_isle`.
  Tek kayıt, duplicate yok (`sod_cron_durumu()` ile doğrulanmış).
- **Outbox (bugün itibarıyla):** `sod_outbox` — apply ile aynı transaction'da
  yazılır, drenaj `POST /api/sod/outbox/isle` (belge §24 "outbox dispatch
  tetikleme" deseninin ilk örneği repo'da mevcut).
- **service_role:** yalnız route handler/script'lerde; browser bundle'da yok
  (env.ts bunu açıkça belgeliyor). Anon key RLS'e güvenir.
- **Bağlantı:** uygulama @supabase/ssr (cookie); script'ler session pooler
  (IPv4). Belge §24'ün önerdiği modelle uyumlu.

---

## 5. UI ekran/route envanteri (14 sayfa)

| Route | İçerik | Yeni IA'daki yeri (belge §7.4) |
|---|---|---|
| `/` (app) | Pano | Genel Bakış |
| `/controls`, `/controls/[id]` | Kontrol kütüphanesi + detay (M12 test bölümü dahil) | Güvence → Kontroller |
| `/findings`, `/findings/[id]` | Bulgular | Güvence → Bulgular |
| `/sod`, `/sod/[id]` | SoD özet + çatışma detay | Yönetişim → SoD |
| `/simulasyonlar`, `/simulasyonlar/[id]` | Tatbikat listesi + yürütme | (mevcut; IA'da Güvence altına) |
| `/paylasim` | Denetçi paylaşım yönetimi | Yönetim → Entegrasyonlar/Paylaşım |
| `/denetim-izi` | Audit log | Güvence → Denetim İzi |
| `/giris` | Oturum açma (public) | — |
| `/paylasim/[token]` | Oturumsuz denetçi görünümü (public) | — |
| `/dogrula/[hash]` | Oturumsuz QR doğrulama (public) | — |

API rotaları: sod (degerlendir, istisna karar, mevzuat-durumu, import önizle +
uygula, outbox isle), kontrol-test (calistir, oneri), simulasyon (puanla, oneri,
paket, pdf). Component seti: 9 shadcn primitive + `empty-state`,
`audit-log-list`, `kontrol-test-bolumu`, `store-provider`.

**Ekran görüntüsü baseline:** bu turda alınmadı (belge §3.8). Gerekçe: görsel
regresyon aracı henüz seçilmedi (ADR-T1'in parçası); baseline'ı araç kararıyla
BİRLİKTE almak tekrar işi önler. PR-1'in ilk adımı olarak plana kondu —
Playwright zaten gerçek Chromium sürüyor, `expect(page).toHaveScreenshot()`
ile ek bağımlılıksız alınabilir.

---

## 6. PR-0 ADR taslakları (kurucu onayına sunulur)

### ADR-T1 — Design token sistemi: Tailwind v4 `@theme` + semantic katman

**Karar (taslak):** Belgenin §5 token tablosu, mevcut `globals.css` shadcn
değişkenlerinin ÜZERİNE değer güncellemesi olarak uygulanır — değişken ADLARI
(shadcn sözleşmesi: `--background/--card/--accent/...`) korunur, belgeye özgü
ekstra tokenlar (`--art-copper`, `unknown`, `legal-review` durum renkleri)
eklenir. Sebep: 14 sayfa + 9 primitive zaten shadcn adlarını kullanıyor; adları
değiştirmek toplu rename olur (belge §0 "klasörleri topluca yeniden düzenleme"
yasağının ruhu). oklch'e çevrilmiş belge renkleriyle light/dark iki tam palet.
Görsel regresyon: Playwright `toHaveScreenshot` (ek bağımlılık yok) — kritik
ekranlar, light+dark, 390×844 / 768×1024 / 1440×900.

### ADR-T2 — Tema mimarisi: class-tabanlı, cookie + profil, inline no-flash script

**Karar (taslak):** `light/dark/system`; SSR flash'ı önlemek için `<head>`
inline script cookie okur ve `<html>`'e `.dark` basar (paket eklenmez;
`next-themes` YERİNE ~20 satır kendi kodumuz — kural 4 ruhu: taşınamaz bağımlılık
ekleme, davranışı anladığımız kod). Tercih: önce cookie/localStorage, oturum
sonrası `profiles.tema_tercihi` (yeni kolon, migration + RLS testi) üstün gelir.
`color-scheme` bildirilir; `prefers-reduced-motion` animasyonları kapatır.

### ADR-T3 — Ortak hukuk verisi ↔ tenant verisi ayrımı (M19+ zemini)

**Karar (taslak):** Resmî kaynak/artifact/hüküm tabloları (`regulatory_sources`,
`source_artifacts`, provision korpusu) **tenant'sız ortak referans verisi**
olarak `public` şemada ayrı bir tablo ailesinde tutulur; RLS'leri "authenticated
SELECT, yazma yalnız service/ingest yolu" biçimindedir (tenant_id UYDURULMAZ —
belge §13 "ortak tabloya tenant RLS uydurma"). Tenant'a özgü olan her karar
(applicability, mapping onayı, snapshot) tenant tablolarında `tenant_id`+RLS ile
yaşar. Kural 1'in kapsamı netleşir: "her TENANT tablosunda tenant_id" — ortak
hukuk referansı tenant tablosu değildir; bu ayrım bu ADR ile kayda girer.

### ADR-T4 — Kaynak erişim politikası + worker kararı

**Karar (taslak):** Hiçbir connector, `SourceAccessPolicy` kaydı (lisans,
robots/rate limit, arşiv hakkı, fallback) onaylanmadan üretime çıkmaz (belge
§13). Türkiye kaynakları için "kapsamlı açık API var" VARSAYILMAZ; ilk iterasyon
**manuel/yarı-manuel ingest** (dosya yükle + künye) ile başlar, EUR-Lex düşük
hacim connector'ı ilk otomatik örnektir. Uzun işler için worker: bugün YOK;
M25'te ölçümle (Edge Function süre sınırı aşılırsa) Hostinger VPS worker ayrı
ADR ile açılır.

**Açık kurucu kararları (bu turda uydurulmadı):**
1. JWS anahtar saklama (KMS/HSM seçimi) — ADR-M11-01'den beri açık.
2. RFC 3161 TSA / Kamu SM — test endpoint'i yok, bilinçli ertelenmiş.
3. Hukuk doğrulama rolü: `VERIFIED` geçişi bugün admin'de; belge ayrı hukuk
   yetkisi istiyor (M21'de rol mü, profil bayrağı mı?).
4. Dış regülatöre gerçek gönderim (M32) — connector + hukuki onay olmadan kapalı.
5. Display font kullanılacak mı (Türkçe karakter + performans doğrulaması şart).

---

## 7. Mimari sapmalar — belge ↔ repo gerçekliği

| Belge | Gerçek | Kayıt |
|---|---|---|
| §1.1 "581 birim + 17 e2e" | 631 + 17 (ölçüldü) | Bu belge §2 |
| §28 PR-3A/3B "yapılacak" | **İKİSİ DE BİTTİ** (migration `20260718030000`, `20260718040000`; ROADMAP M16) | Aynı iş TEKRAR yapılmayacak (belge §28'in kendi talimatı) |
| §28 PR-3A "kimlik çözümleme + dry-run UI" içerir | Kimlik çözümleme bilinçli minimal (`kaynak:externalSubjectId`); TÜM import UI'ı kurucunun önceki split'iyle PR-3D'de | ROADMAP M16 "bilinçli borç" |
| §28 PR-3B "MIME güvenliği" (3A maddesi) | MIME sniffing yok; null-byte/boyut/formula-injection var | PR-3D'ye eklendi (aşağıda) |
| §7.4 IA'da "Simülasyonlar" yok | Repo'da canlı modül | IA'ya "Güvence → Tatbikatlar" olarak eklenecek (silinmez) |
| §24 "outbox dispatch cron tetiği" | Outbox var, cron tetiği yok (drenaj manuel rota) | M16 #5 kapsamında |

---

## 8. Dosya bazlı uygulama planı

### PR-1 — UI Foundation (kod yazmadan önce kurucu ADR-T1/T2 onayı)

| İş | Dosyalar |
|---|---|
| Screenshot baseline (light, 3 viewport) | `e2e/gorsel-baseline.spec.ts` (yeni) |
| Semantic tokenlar (light+dark değerleri, durum renkleri, `--art-copper`) | `src/app/globals.css` |
| Tema: no-flash inline script + cookie | `src/app/layout.tsx` |
| `ThemeSwitcher` + tercih persistence | `src/components/theme-switcher.tsx` (yeni), `profiles` migration `2026...` + `rls-*.test.ts` |
| AppShell: sol rail (272/72px) + üst context bar + mobil alt nav | `src/components/app-shell/{nav-rail,context-header,mobile-nav}.tsx` (yeni), `src/app/(app)/layout.tsx` |
| Durum bileşenleri: `StatusBadge` (renk+ikon+metin), `EvidenceFreshnessBadge`, `LegalStatusBadge` | `src/components/durum/*.tsx` (yeni) |
| `EvidenceTraceRail` iskeleti (imza öğesi; veri bağlamadan) | `src/components/evidence-trace-rail.tsx` (yeni) |
| Health endpoint (`/health/live`, `/health/ready`) | `src/app/health/{live,ready}/route.ts` (yeni) |
| Güvenlik başlıkları (CSP raporlama modunda başlar, nosniff, frame-ancestors) | `next.config.ts` |
| Tema e2e (belge §6 senaryosu) + responsive smoke | `e2e/tema.spec.ts` (yeni) |

Kapı: mevcut 631+17 yeşil kalır; route davranışı değişmez; light görünüm mevcut
ekranlarla piksel-yakın (kabuk hariç).

### PR-2 — Mevcut ekran taşıma

Pano → kontrol listesi/detay (M12 akışı davranış aynen) → bulgular → SoD →
simülasyonlar → denetim izi. Her ekran: masaüstü/tablet/mobil + light/dark
screenshot + mevcut e2e yeşil. Dosyalar: `src/app/(app)/**/page.tsx` (taşıma),
`kontrol-test-bolumu.tsx` (yeni componentlere geçiş, davranış birebir).

### M16 kalanları (belge §28 ↔ kurucunun 12 maddesi eşlemesi)

| PR | İçerik | Ana dosyalar |
|---|---|---|
| **PR-3C** | Rollback sözleşmesi (ters değişiklik seti; sona-erdirme geri alınır, fiziksel silme yok) + maker-checker (uygulayan ≠ onaylayan, DB guard) + concurrency/tenant güvenlik testleri | migration `2026...` (rollback tablosu + guard + RPC), `src/app/api/sod/import/[onizlemeId]/rollback/route.ts`, `rls-sod-import-rollback.test.ts` |
| **PR-3D** | Dar import UI (yükleme/kaynak/mod/dry-run/diff/apply/geçmiş/rollback) + **MIME kontrolü** (§7 sapması) + gerçek Chromium e2e: A import, B idempotency, C stale 409, D rollback, E apply→outbox→değerlendirme | `src/app/(app)/sod/import/page.tsx`, `e2e/sod-import.spec.ts` |
| Sonra | #5 değerlendirme tetiği (outbox drenajına cron), #6 atama UI, #8 dashboard, #9 güvenlik testleri | ROADMAP M16 listesi |

M16 üretim kapısı (belge §32 kriterleri) PR-3D sonunda; **M17/M18 kodu o kapıdan
önce yazılmaz.** M19+ (PR-4 kaynak sicili) ancak M16 kapısı + ADR-T3/T4 onayı
sonrası.
