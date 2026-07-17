# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Canlı Supabase projesi (`jgunbctnoprklseusaee`) **kullanımda**. Session Pooler
üzerinden bağlanıyoruz — direct connection IPv6-only. 33 migration uygulandı
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

**M11 ilerliyor — Storage + JWS imza DOĞRULANDI** (17 Temmuz 2026). Kurucunun
üç ADR'si (ADR-M11-01 imza, -02 TSA, -03 dayanıklılık) ROADMAP M11'de kayıtlı.

**Storage:** kanıt dosyaları private `evidence` bucket'ına içerik-adresli
(`{tenant_id}/{sha256}`) yükleniyor, imzalı URL ile geri indiriliyor. Canlı
script + tarayıcı e2e: round-trip baytları aynı, başka tenant klasörüne yükleme
RLS ile reddedildi, bucket private. PGlite storage şemasını taklit edemez —
`storage.objects` RLS'i canlıda doğrulanır (pg.ts stub'ı yalnız migration APPLY
için).

**JWS imza (ADR-M11-01):** çekirdek manifest, mühürle aynı INSERT'te ES256
detached JWS ile imzalanıyor (`manifest-signature.ts`); `signature_jws/kid/
public_jwk/signer_ad` immutable donuyor. Canlı script: saklanan public JWK ile
BAĞIMSIZ doğrulama geçti, manifest kurcalanınca reddedildi, `kanit_imzalandi`
audit kaydı düştü. `ManifestSigner` soyutlaması private key'i dışarıda tutuyor
(kural: DB'ye/env'e private key yazılmaz) — bugünkü `LocalDevSigner` GEÇİCİ
bellek anahtarı; production'da KMS/HSM imzalayıcı takılacak (kod değil altyapı).
`signer_ad=local-dev-*` olduğu için rapor "geliştirme anahtarı, nitelikli
e-imza değil" uyarısını taşıyor.

**ZIP denetim paketi + BAĞIMSIZ verify CLI (M11):** `/api/simulasyon/[id]/paket`
çekirdek manifest + rapor verisi + imza + PDF + paket manifesti içeren ZIP
üretiyor; `scripts/verify-paket.ts` bir klasörü okuyup hash zincirini ve JWS'i
DB'siz doğruluyor (`audit-package.ts`). CLI runtime'da dış bağımlılık taşımıyor
— denetçi repo dışında `npx tsx scripts/verify-paket.ts <klasor>` koşabilir.
Canlıda kanıtlandı (e2e): gerçek Chromium ZIP indirdi, açtı, CLI AYRI PROCESS
olarak VERIFIED verdi (çıkış 0), core-manifest kurcalanınca FAILED (çıkış 1).
`canonicalize`'ı runtime'dan çıkarmanın asıl ödülü buydu — tsx CLI her şeyi
çözebiliyor.

**Doğrulanmayan tek şey deploy.** Onun için "çalışıyor" deme.

**Redaction soy bağı (M11, `20260717220000`):** redakte kanıt ayrı bir kanıttır
(append-only yeni satır, orijinal durur), farklı hash + orijinalle soy bağı.
Zarf guard'ı zorluyor (kaynak aynı kiracı, not zorunlu, aynı hash reddi, soy
uydurulamaz, on-delete-restrict). Zarf `redactionOf`+`redactionNote` taşıyor →
soy iddiası hash'in parçası. Canlıda + PGlite'ta doğrulandı. UI (yükleme formu)
henüz yok — yetenek şemada/mantıkta hazır, ekran bağlanmadı.

M11'de KALAN (ROADMAP M11): gerçek KMS bağlayıcı (altyapı), RFC 3161/Kamu SM
(Kamu SM test endpoint'i olmadan ASN.1 kör yazılamaz — bilinçli ertelendi),
redaction UI, legal-hold ihlal kaydı.

**M12 başladı — kontrol test motoru + kural 13 durum sözlüğü** (`control-test.ts`,
`20260717230000/230001`). `control_test_definitions` + `test_runs` (append-only +
immutable trigger). Sonuç beş AYRI durum: `PASSED/FAILED/UNKNOWN/STALE/EXCEPTION`,
birleştirilemez. **Kural 13'ün kalbi kanıtlandı:** toplama/connector arızası ASLA
FAILED üretmez, UNKNOWN üretir. Motor deterministik (kural 11). Durum türetimi
(`kontrolGuvenceDurumu`) birleştirmez, en kötüyü seçer; öncelik mantığı tek yerde
(TS), SQL yalnız ham malzeme. Canlı doğrulama bir açık yakaladı: append-only önce
yalnız revoke'la kuruluydu, service_role UPDATE geçiyordu — manifest deseniyle
immutability trigger eklendi, canlıda service_role UPDATE reddi doğrulandı.
**Bulgu üretimi + verified closure (M12, `20260717240000/240001`, kural 11+14):**
başarısız test → bulgu ÖNERİSİ (`bulguOnerisiUret`, PROPOSED); yalnız FAILED
üretir, UNKNOWN/STALE ÜRETMEZ ("ölçemedik" ihlal değil). Verified closure guard
DB invariant'ı: retest_gerekli bulgu, başarılı+aynı-tanım+bulgudan-sonra retest
koşusu + onaylayan olmadan `kapali`'ya GEÇEMEZ; ticket/aksiyon düzenlemek durumu
değiştirmediğinden kapatmaz. Trigger'da (service_role bile atlayamaz), canlıda
doğrulandı (retestsiz red, FAILED retest red, başarılı retest+onay kapatır).
Yol boyunca bir PGlite≠Postgres farkı düzeltildi: `audit_findings` `text[] ||
'literal'` (canlıda OK, PGlite'ta "malformed array literal") → `array_append`.

M12'de KALAN (ROADMAP M12): test çalıştırma rotası/UI (motor+öneri hazır, ekran
yok), öneri→kabul rotası, freshness otomasyonu, tenant_controls'a bağlama + pano,
S01 dikey akışı.

Hâlâ **doğrulanamayan** tek şey **deploy**. Bunun için "çalışıyor" deme.
(Supabase Auth çok önce doğrulandı: gerçek kullanıcı canlıda giriş yaptı.)

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
