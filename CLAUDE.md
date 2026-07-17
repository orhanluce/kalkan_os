# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Canlı Supabase projesi (`jgunbctnoprklseusaee`) **kullanımda**. Session Pooler
üzerinden bağlanıyoruz — direct connection IPv6-only. 25 migration uygulandı
(`pnpm db:push`); `pnpm db:verify` çekirdek tabloları fiilen doğrular. Kontrol
kütüphanesi seed edildi (2 çerçeve, 17 kontrol) ve ilk kuruma atandı.

**Uygulama artık gerçek Supabase'e bağlı**: kimlik Supabase Auth'tan, yetki
bağlamı `profiles`'tan, veri gerçek tablolardan. `src/lib/mock-data.ts`
uygulama kodunda kullanılmıyor (yalnızca `scripts/generate-yk-beyani.ts`
hâlâ okuyor). Deploy yok.

M1-M5 mock store üzerinde tamamlanmıştı. M5.5'in **mantık ve şema katmanı
bitti**: audit_log hash zinciri, dört-göz onayı (`evidence_reviews`), RFC 6962
Merkle + proof, `EvidenceAnchorProvider`, kanıt zarfı (canonical JSON) ve
bağımsız doğrulama — hepsi testli. M5.5'in **UI'ı yok**; bu katmanlar henüz
hiçbir ekrana bağlı değil.

**Geçişin açtığı borçlar, çoğu kapandı** (docs/ROADMAP.md "Supabase geçişi" altında
tam liste): audit_log yazması artık trigger'da (atomik); denetçi paylaşımı
`paylasim_goruntule` RPC'siyle çalışıyor; Playwright akışları ayrı bir e2e
kiracısına karşı yeniden yazıldı ve 10/10 yeşil (`pnpm e2e`, 1 bilinçli skip).
Kalan gerçek açık:
kanıt süresi dolması yalnızca yükleme anında hesaplanıyor, DB'de otomatik
yeniden değerlendirilmiyor (bir test bunun için bilinçli `skip`).

**RLS gerçekten test ediliyor** (kural 1 için mazeret yok): PGlite
(Postgres'in WASM derlemesi, kurulum gerektirmez) ile gerçek migration
dosyalarına karşı Vitest'te koşuyoruz — bkz. `src/lib/__tests__/helpers/pg.ts`
ve `rls-*.test.ts`. Yeni bir tablo/politika eklerken RLS testi de yaz.
Bu aynı zamanda kural 4'ü fiilen kanıtlar: şema düz Postgres'te koşuyor.

**Ama PGlite testleri Supabase'i tam taklit etmez — ve bu bir kez canlıyı
bozdu.** Supabase eklentileri `extensions` şemasına kurar, PGlite `public`'e;
`set search_path = public` ile kilitli fonksiyonlar canlıda `digest()`'i
bulamadığı için her `tenant_controls` güncellemesi sessizce patlıyordu ve hash
zinciri hiç çalışmıyordu — 193 test yeşilken. Bu yüzden: **şemaya dokunan her
migration'dan sonra canlıya karşı gerçek bir yazma dene.** `pnpm db:verify`
tabloların var olduğunu gösterir, çalıştıklarını değil.

Hâlâ **doğrulanamayan** ve "yazıldı ama doğrulanmadı" diye işaretlenmesi
gerekenler: Storage'a gerçek dosya yükleme ve deploy. Bunlar için "çalışıyor"
deme. (Supabase Auth artık doğrulandı: gerçek kullanıcı canlıda giriş yaptı,
profil RLS altında okundu.)

**Simülasyon** (docs/ROADMAP.md §1.2, M7-M9): M7 ve M8 bitti. 5 senaryo canlıda
yayınlı, 18 aksiyon→kontrol bağı, yayınlanmış şablon immutable. Yürütme ekranı
(`/simulasyonlar/[id]`) canlıda: tatbikat başlat/yürüt/puanla/öneri kabul et
akışı `e2e/simulasyon.spec.ts` ile gerçek Chromium + gerçek Supabase'e karşı
doğrulandı.

**2026 ürünleşme planı kabul edildi (17 Temmuz 2026 akşamı).** Kurucunun
araştırma belgesi `docs/arastirma/KALKAN_OS_Urun_Gelistirme_Yol_Haritasi_2026.md`
kopyalandı; karar kaydı ROADMAP §1.5, yeni taş sırası ROADMAP "2026 ürünleşme
planı" bölümünde: **M11** kanıt çekirdeği v2 (Storage'a gerçek yükleme, JWS
imza, redaction, verify CLI, ZIP paketi) → **M12** kontrol test motoru +
`Failed≠Unknown≠Stale` durum makinesi + S01 dikey → **M13** kurum profili +
kritik hizmet + RTO/RPO toleransları + ana pano + YK çıktıları → **M14**
kapsam motoru → **M15** olay saati + kurtarma kanıtı. Belgenin yığın varsayımı
(NestJS/Prisma/Keycloak/MinIO/BullMQ) ÜÇÜNCÜ kez reddedildi — package.json'da
hiçbiri yok, karşılık tablosu §1.5'te.

**M9/M10 kapanmadı, kalanları M11-M13'e devredildi** — adım adım eşleme
ROADMAP M9 bölümünde. Bugün biten: bütünlük modeli (dört ayrı hash:
`reportDataHash`/`coreManifestHash`/`pdfFileHash`/`packageManifestHash`, §1.4),
mühür zinciri (`simulation_result_manifests`, immutable trigger canlıda
service_role UPDATE'ini reddetti), tatbikat PDF + QR + oturumsuz `/dogrula`
(canlıda sızdırmadığı doğrulandı) ve **kanıt zarfı şema göçü**
(`20260717190000`): guard yeni satırda tam zarf zoruyor, eski kayıtlar
`LEGACY_FILE_HASH_ONLY` (dosya bütünlüğü ✓, köken zinciri ✗ — uydurmuyoruz),
manifest artık `fileHash` + `envelopeHash` mühürlüyor.

**RFC 8785 kendi uygulamamız** (`src/lib/canonical.ts`): `canonicalize` paketi
runtime'dan ÇIKARILDI (yalnız `import` koşulu tanımlıyor, tsx script'leri
çözemiyor — bağımsız verify CLI'yi imkânsız kılıyordu); referans implementasyon
devDependency olarak testte hakem (`canonical.test.ts` uygunluk külliyatı).

**Doğrulama durumu (17 Temmuz 2026 akşamı, ölçülmüş):** JCS yeniden yazımı
sonrası tam takım yeşil — **450 birim (27 dosya) + 11 e2e (1 bilinçli skip)**.
Canlıda doğrulandı: yeni kanıtlar `FULL_ENVELOPE`, zarf hash'i tsx script'inden
hesaplanabiliyor (kendi RFC 8785 uygulamamızın varlık sebebi), zarf guard'ı
canlıda zarfsız INSERT'i reddetti. `docs/arastirma/` kopyası `diff` ile kaynağa
karşı birebir çıktı. **Tek kalan: çalışma alanı commit'lenmemiş** — M9 adım 1-3
+ 2026 planı tek oturumun işi, kurucu onayıyla commit'lenmeli.

M10 (YK Beyanı, ROADMAP M10) şema+motor bitti; UI'ı M13'te.

**Açık borçlar** (docs/ROADMAP.md'de tam liste): `evidences.kaynak_kontrol_id`
kolonu yok (yansıtılan kanıt doğrudan yüklenmiş gibi görünür). Kanıt süresi
yalnızca okuma/yükleme anında hesaplanıyor, DB'de otomatik yeniden
değerlendirilmiyor. `generate-yk-beyani.ts` hâlâ mock-data okuyor — M10'un
Yönetim Kurulu Beyanı modülü onun yerini almalı ama henüz bağlanmadı.

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
9. Simülasyon ASLA gerçek bir üretim saldırısı başlatmaz; her tatbikat bildirimi/ekranı
   açıkça TATBİKAT etiketi taşır (gerçek olayla karışması bir uyum ürününde felakettir).
10. Yayınlanmış senaryo şablonu ve başlatılmış simülasyon snapshot'ı immutable: şablon
   değişirse geçmiş simülasyon değişmez, yeni sürüm doğar.
11. Puanlama deterministik ve açıklanabilir: aynı girdi aynı sonucu verir, her puan satırı
   gerekçesini taşır. AI yalnızca gözlem notu özetleyebilir — puanı veya uyum durumunu
   belirleyemez. Simülasyon bulgusu PROPOSED doğar, insan onaylamadan gerçek bulgu olmaz.
12. Senaryo içeriği de mevzuat içeriği gibidir (kural 3): data/scenarios/*.yaml'dan seed
   edilir, uydurulmaz, UNVERIFIED_SAMPLE etiketlenir.
13. Kontrol/test sonuç durumları birleştirilemez: `Failed` ≠ `Unknown` ≠ `Stale` ≠
   `Exception accepted`. Toplama/connector arızası ASLA `Failed` üretmez — `Unknown` üretir.
   (2026 belgesi M02; M12'de şemaya girer, ilke şimdiden geçerli.)
14. Bulgu kapanışı yeniden test ister: başarılı retest kanıtı + yetkili onayı olmadan kritik
   bulgu kapanamaz; ticket/aksiyon kapanışı kontrol kapanışı sayılmaz. (2026 belgesi karar #4.)
15. Bir hash'in NEYİ doğruladığı adında yazar (`reportDataHash` ≠ `pdfFileHash` ≠
   `coreManifestHash` ≠ `packageManifestHash`); kanıt köken güvencesi zarfsız verilemez —
   zarfsız eski kayıt `LEGACY_FILE_HASH_ONLY` kalır, alan uydurulmaz.
