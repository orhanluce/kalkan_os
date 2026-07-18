# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

**SPK belgesi (18 Temmuz 2026) DEĞERLENDİRİLDİ ve önceliklendirildi.** Beşinci
vizyon belgesi (`docs/arastirma/KALKAN_OS_SPK_Notlari_Urunlestirme_Eki_2026.md`)
ROADMAP §1.6'ya işlendi; üç yeni alan ayrı taş oldu: **M16 SoD** (kodlandı,
aşağıda), **M17 denetim örnekleme** (yalnız ADR/tasarım, kod yok), **M18 eğitim/
yetkinlik** (yalnız sınır dokümanı). Kurucunun "M15/M16/M17" taslak numaraları
repo'da M15 dolu olduğu için bir kaydırıldı.

**M16 — Görevler Ayrılığı (SoD) motoru: ilk dikey dilim BİTTİ ve canlıda e2e ile
doğrulandı** (migration `20260718000000`). Şema (7 tablo), saf deterministik
motor (`src/lib/sod.ts`, kural 11), üç rota (`/api/sod/degerlendir` + istisna
kararı + mevzuat_durumu geçişi), UI (`/sod` + `/sod/[id]`), audit trigger'ları.
Kural 3'ün genişlemesi: SPK notundan türetilen kural ASLA doğrudan `VERIFIED`
doğmaz (`INTERNAL/TODO_DOGRULA/VERIFIED`; geçiş ayrı yetki ister). DB guard'ları
(kural 14 disiplini): talep eden kendi istisnasını onaylayamaz, `MITIGATED`
ancak PASSED telafi edici test ile, `RESOLVED` ancak bağımsız kapanışla. Telafi
edici kontrol M12'nin test motorunu YENİDEN KULLANIR (yeni test altyapısı yok).
569 birim (534 + 35 yeni SoD) + 15 e2e yeşil; mevcut davranış bozulmadı.

**M16 süre-dolumu otomasyonu (18 Temmuz, migration `20260718010000`):** kurucunun
işaret ettiği gerçek boşluk kapatıldı. İki idempotent pg_cron işi (BullMQ DEĞİL
— kural 4): `sod_istisna_suresi_dolanlari_isle` (dolan istisna → çatışma
REOPENED, yalnız EXCEPTION_APPROVED'da; MITIGATED'e dokunmaz) ve
`kanit_suresi_dolanlari_isle` (eski M2 borcu — dolan kanıt → kontrol 'kismi' +
"Sistem" audit'i). `e2e/kanit-motoru`'daki `test.skip` GERÇEK teste döndü →
**17/17 e2e, SIFIR skip, 581 birim.** pg_cron canlıda mevcut ve zamanlandı
(`kalkan-sure-dolumu`, günlük 02:00 UTC); zamanlama defansif DO bloğunda
(PGlite'ta no-op). **KALAN (kurucunun 12 maddesinden):** #3 istisna uzatma,
#4 CSV atama import, #5 değerlendirme tetikleri, #6 atama UI, #7 domain event,
#8 dashboard, #9 güvenlik testleri, #10 e2e B/C, #12 M17 ADR (M16 üretim kapısı
geçmeden M17 kodu yok). Tam liste ROADMAP M16 "Üretim kapatma" altında.

**PR-3 ön koruma (18 Temmuz, `20260718020000/020001`):** kurucu kararı, CSV
import'tan ÖNCE iki korkuluk. (1) Onaylı/dolmuş istisnanın süre-kimlik alanları
(`bitis/talep_eden/onaylayan/conflict/tenant`) UPDATE ile kilitlendi
(`sod_istisna_kilit_guard`) — uzatma için düzenleme yolu kapalı; ama `durum`
frozen değil, süre-dolumu işi çalışmaya devam ediyor (regresyon testli).
(2) pg_cron `*/5`'e indirildi (dolan istisna ~5 dk'da açılır); canlıda tek iş
doğrulandı (`sod_cron_durumu()` → 1 kayıt, `*/5`, active — duplicate yok).
586 birim + 17 e2e.

**PR-3 dörde bölündü** (kurucu kararı): 3A güvenlik+sözleşme+dry-run (SALT OKUR),
3B apply+idempotency+outbox, 3C rollback+bağımsız onay, 3D UI+e2e. **PR-3A BİTTİ**
(`20260718030000`): `SodAssignmentImportRecord` sözleşmesi + güvenli CSV parser
(`src/lib/sod-import.ts`: RFC4180 tırnak, BOM, null-byte/boyut/formula-injection
reddi) + deterministik normalize (sıra-bağımsız) + diff (DELTA/SNAPSHOT, sona-
erdir, başka kaynağa dokunmaz) + bütünlük hash'leri (fileHash/normalizedRecords/
assignmentSnapshot/ruleSetVersion) + `onizlemeBayatMi` stale mantığı. Şema:
`sod_atamalari` import alanları + idempotency partial unique index; `sod_import_
onizlemeleri` (append-only, RLS, audit). Rota `POST /api/sod/import/onizle`
(admin/uyum) — İNŞA YOLUYLA atama yazmaz (sod_atamalari yalnız okunuyor, tek
insert önizlemeye). 621 birim + 17 e2e, 0 skip. Bilinçli borç: kimlik çözümleme
minimal (harici=`kaynak:externalSubjectId`); route e2e'si 3D'de.

**PR-3B BİTTİ (18 Temmuz, `20260718040000`) — atomik apply + idempotency +
transactional-outbox + import manifesti; canlı smoke ile doğrulandı.** Apply tek
plpgsql fonksiyonunda (`sod_import_uygula`): stale yeniden-kontrol → ekle/güncelle/
sona-erdir → manifest → outbox → önizleme APPLIED, hepsi tek transaction (yarı
uygulanmış import olamaz — STALE reddinde hiçbir şey yazılmıyor). Stale 409
`IMPORT_PREVIEW_STALE` (apply-öncesi hash yeniden hesap + kilit-altı ikinci
kontrol). Sona-erdirme FİZİKSEL SİLME DEĞİL (`gecerlilik_bitis`). İdempotency üç
katman: önizleme durum kilidi (`for update`), manifest `unique(onizleme_id)`,
atama partial unique + `ON CONFLICT` upsert. Outbox (`sod_outbox`, kural 4 — BullMQ
YOK) apply ile aynı transaction'da yazılır; drenaj rotası (`POST /api/sod/outbox/
isle`) bir değerlendirme koşar (ortak `sod-kosu.ts` — `degerlendir` rotası da buna
indirildi, davranış birebir aynı). Manifest `sod_import_manifestleri` append-only,
`manifestHash` (kural 15) apply kararını mühürler. Rota `POST /api/sod/import/
[onizlemeId]/uygula` RLS altında önizleme okur (IDOR yok), sonra service_role RPC;
fonksiyon execute'u authenticated/anon'dan revoke (tenant atlama yok), service_role
Supabase default-privilege ile çağırabiliyor (canlı smoke kanıtı, PGlite≠Supabase).
**631 birim (+10) + 17 e2e, 0 skip.** Sıradaki: PR-3C (rollback + bağımsız onay).
- **Kapsam dışı (bilinçli):** atama yönetim UI'ı yok (fixture/script ile
  giriliyor), IAM/PAM connector yok.
- Yol boyunca iki bug: (1) `SodTaraf.sistem_kapsami` kuralın kendisine sabit
  kapsam atıyordu, farklı kapsamlı gerçek atamalar hiç eşleşmiyordu — opsiyonel
  yapıldı (birim testi yakaladı); (2) `setup-e2e-fixtures.ts` `control_test_
  definitions`'ı SoD verisinden ÖNCE silmeye çalışıyordu ama `on delete restrict`
  yüzünden sessizce başarısız oluyor, aynı isimli tanım birikip e2e'yi
  patlatıyordu — silme sırası düzeltildi.

## Mevcut aşama (güncellenir)
Canlı Supabase projesi (`jgunbctnoprklseusaee`) **kullanımda**. Session Pooler
üzerinden bağlanıyoruz — direct connection IPv6-only. 38 migration uygulandı
(`pnpm db:push`); `pnpm db:verify` çekirdek tabloları fiilen doğrular. Kontrol
kütüphanesi seed edildi (2 çerçeve, 17 kontrol) ve ilk kuruma atandı.

**Uygulama artık gerçek Supabase'e bağlı**: kimlik Supabase Auth'tan, yetki
bağlamı `profiles`'tan, veri gerçek tablolardan. `src/lib/mock-data.ts`
uygulama kodunda kullanılmıyor (yalnızca `scripts/generate-yk-beyani.ts`
hâlâ okuyor). Deploy VAR (Hostinger, aşağıda ayrıntılı).

M1-M5 mock store üzerinde tamamlanmıştı. M5.5'in **mantık ve şema katmanı
bitti**: audit_log hash zinciri, dört-göz onayı (`evidence_reviews`), RFC 6962
Merkle + proof, `EvidenceAnchorProvider`, kanıt zarfı (canonical JSON) ve
bağımsız doğrulama — hepsi testli. M5.5'in **UI'ı yok**; bu katmanlar henüz
hiçbir ekrana bağlı değil.

**Geçişin açtığı borçlar, çoğu kapandı** (docs/ROADMAP.md "Supabase geçişi" altında
tam liste): audit_log yazması artık trigger'da (atomik); denetçi paylaşımı
`paylasim_goruntule` RPC'siyle çalışıyor; Playwright akışları ayrı bir e2e
kiracısına karşı yeniden yazıldı ve e2e yeşil (`pnpm e2e`). Kanıt süre-dolumu
borcu KAPANDI (18 Temmuz, migration `20260718010000`): artık `kanit_suresi_
dolanlari_isle` pg_cron işi kontrolü otomatik 'kismi'ye düşürüyor, ilgili
`test.skip` gerçek teste döndü (yukarıda M16 süre-dolumu notu).

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

**Deploy artık DOĞRULANDI (17 Temmuz 2026 akşamı) — Hostinger Business, Node.js
otomatik dağıtım.** GitHub'dan otomatik çekiyor (`orhanluce/kalkan_os`, `main`),
build komutu `pnpm run build`, Node 22.x, geçici alan adı
`blue-yak-865668.hostingersite.com`. **Kanıt, tahmin değil:** kurucunun ekran
görüntüsü giriş yapılmış panoyu, gerçek kiracı verisini (17 kontrol, durum
dağılımı) gösterdi; ayrıca curl ile middleware yönlendirmesi (`/` → 307 →
`/giris`) ve `/dogrula/[hash]` rotasının 200 döndüğü doğrulandı.
Bu doğrulama sırasında canlıda gerçek bir bug bulundu ve düzeltildi: header'da
Supabase geçişi bitmeden bırakılmış eski bir "Veriler yerel" rozeti canlı
panoda görünüyordu — geçiş aylar önce bitmişti (`store.tsx` gerçek tabloları
okuyor/yazıyor), rozet silinmeyi unutulmuştu. Kaldırıldı, yerelde giriş
yapılarak doğrulandı, push edildi (`112a6b2`).
**Bilinen sınır:** PDF/ZIP rotaları (Playwright/Chromium ister) bu paylaşımlı
Node.js hostta muhtemelen çalışmaz; Chromium başlatılamazsa artık opak 500
yerine net 503 dönüyorlar ("Chromium destekli ortam gerekiyor") — mühür/imza/
doğrulama etkilenmez, yalnızca PDF render'ı.

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

**Test çalıştırma + öneri kabul rotaları (M12, canlıda e2e):**
`POST /api/kontrol-test/[id]/calistir` (gözlem→motor→test_run, FAILED ise öneri)
ve `POST /api/kontrol-test/oneri/[oneriId]` (KABUL gerçek bulgu, retest_gerekli
tanımdan). `e2e/kontrol-test.spec.ts`: FAILED→öneri, TOPLAMA ARIZASI→UNKNOWN+öneri
YOK (kural 13 uçtan uca), kabul→bulgu, retestsiz kapatma reddi, retest→kapanış.
Sonucu MOTOR belirler (rota değil); test_run/öneri INSERT kullanıcı oturumuyla
(RLS), service_role yalnız öneri kararında.

**Test tanımı + çalıştırma/öneri UI'ı (M12):** kontrol detay sayfasına "Kontrol
Testleri" kartı eklendi (`kontrol-test-bolumu.tsx`) — yeni tanım formu, Gözlem
seçici (4 seçenek → motorun 5 durumuna eşlenir), Çalıştır, sonuç rozeti, öneri
kartı + Kabul/Reddet. `e2e/kontrol-test.spec.ts`'e gerçek Chromium ile UI'ı
tıklayan ikinci bir test eklendi (form→tanım→gözlem→çalıştır→"Kaldı" rozeti→
kabul→findings'te bulgu). MCP Browser aracı bu dropdown'ın koordinatını
hesaplayamadı; Playwright e2e ile doğrulandı — daha güvenilir, kalıcı regresyon.

M12'de KALAN (ROADMAP M12): freshness otomasyonu, tenant_controls'a bağlama +
pano, S01 dikey akışı.

Deploy artık doğrulandı (yukarıda, "Deploy artık DOĞRULANDI" altında).
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
