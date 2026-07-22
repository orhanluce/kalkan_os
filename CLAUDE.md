# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

**Dikey J — Otomatik Kanıt Toplama ve Sürekli Güvence Katmanı roadmap'e
girdi + landing vizyon notu (22 Temmuz 2026, KOD YOK).** Kurucunun "WardProof'un
manuel-kanıt-yükleme aracı olmadığını, otomatik kanıt toplamaya doğru
tasarlandığını gösterelim ama sahte özellik üretmeyelim" talebine karşılık:
tam mimari analiz `docs/adr/PR0-dikeyJ-otomatik-kanit-toplama-2026-07-22.md`'de
(Kurumsal Sistemler → Connector Layer → Evidence Collector → Kontrol
Eşleştirme → Test Motoru → Kriptografik Kanıt Zinciri → Proof Room; son
dört katman BUGÜN ZATEN ÜRETİMDE, eksik yalnız ilk iki katman). ROADMAP.md
§1.71'e işlendi — kurucu bunu "Dikey H" olarak önermişti ama §1.69'daki
AI Yönetişimi vertikaliyle çakışmayı önlemek için **Dikey J** oldu (kavram
birebir aynı, yalnız harf değişti). `/tanitim`e "yakında" demeyen küçük bir
vizyon notu eklendi. Gerçek ön koşul borcu not edildi: `evidences.
kaynak_kontrol_id` yok. **Öncelik sırası DEĞİŞMEDİ (kural 20).**

**Özel SMTP sağlayıcı/gönderici kararı SABİTLENDİ (22 Temmuz 2026) — kod
DEĞİL, kararın kendisi.** Kurucu G1.1'in SMTP kapısı için (yukarı bkz.) somut
kararını verdi: sağlayıcı **Resend**, domain `wardproof.com` (yalnız domain
seviyesinde doğrulanır, `info@` ayrıca doğrulanmaz), gönderici **TÜM** Supabase
Auth e-postaları (davet/ilk-giriş parola belirleme/şifre sıfırlama/güvenlik
bildirimi) için AYNI `WardProof <info@wardproof.com>` kimliği — pilot
aşamasında `no-reply@`/`security@`/`support@` ayrıştırması BİLİNÇLİ
ertelendi. Karar + Resend'in resmi belgelerinden doğrulanmış Supabase SMTP
alan eşlemesi (host `smtp.resend.com`, user sabit `resend`, şifre=API key) +
22 Temmuz DNS temel-çizgisi (SPF şu an yalnız Hostinger için, DKIM yok — ikisi
de beklenen, Resend doğrulaması henüz yapılmadı) `docs/operasyon/
OZEL_SMTP_KURULUMU.md` §0/§1.5/§1.6'ya işlendi. **Kalan iş hâlâ kurucunun
kendisinde:** Resend hesabı açma + domain doğrulama + üretilen SPF/DKIM
kayıtlarını DNS'e ekleme + Supabase paneline bağlama — Claude bunları
YÜRÜTEMEZ.

**Dikey H ve Dikey I roadmap'e girdi + landing sayfası AI/kriptografi kartları
tamamlandı (22 Temmuz 2026, KOD YOK bu turda).** Kurucunun "sitede AI ve chain
teknolojisinden bahsedelim ama abartmadan" talebine karşılık: (1) `/tanitim`
sayfasına gerçek ürün yüzeyini anlatan iki kart eklendi — Modüller bölümüne
"AI Güvence" (risk sınıflı AI envanteri, yazma yetkili ajanlarda insan onayı,
AI karar makbuzlarının SUGGESTED doğması), Güven bölümüne "Kriptografik
Şeffaflık Defteri" (kanonik hash + imza + Merkle tabanlı append-only defter +
bağımsız doğrulama) — "blockchain", "SCITT sertifikalı", "nitelikli imza",
"AI otomatik karar verir" gibi ifadeler KULLANILMADI (kural 16-19). (2)
`src/lib/transparency.ts`'teki eski "RFC 6962" referansı `RFC 9162`e
düzeltildi (RFC 6962 obsolete — RFC Editor kaydı) + "SCITT yaklaşımından
esinlenir, tam standart uyumu iddia edilmez" hedge'i eklendi; DAVRANIŞSAL KOD
DEĞİŞMEDİ. (3) İki yeni PLANLANAN (kod yok) dikey `docs/ROADMAP.md` §1.69
(Dikey H — AI Yönetişimi ve Güvence: H1 AI sistem envanteri → H2 risk/
uygulanabilirlik → H3 kontrol/test manifesti → H4 provenance+insan onayı →
H5 kontrollü yardımcı AI) ve §1.70 (Dikey I — Kriptografik Kanıt ve Şeffaflık
Defteri: I1 KMS/HSM production signer → I2 bağımsız doğrulama servisi → I3
Merkle makbuzu → I4 harici timestamp/anchor → I5 SCITT uyum değerlendirmesi)
olarak kaydedildi — ikisi de yalnız tanım/ADR seviyesinde, migration yok.
**Öncelik sırası DEĞİŞMEDİ ve kural 20'ye yazıldı:** özel SMTP → K1 restore
provası → K2 → hukukça doğrulanmış ilk mevzuat paketi → ilk pilot → pilot
geri bildirimi TAMAMLANMADAN H1/I1 kodsuz analizi bile açılmaz, G2 hiç açılmaz.

**Dikey G1.1 kararlaştırıldı (22 Temmuz 2026) — Pilot Operasyon Hazırlığı:
kod DEĞİL, iki operasyonel kapı.** G1 canlı/kabul edildikten sonra kurucu G2'ye
(self-servis + ödeme) DOĞRUDAN geçilmemesine karar verdi — önce iki bloklayıcı
çıkış kapısı: **(1) özel SMTP** (Supabase'in varsayılan e-posta servisi canlı
G1 testinde hız sınırına gerçekten çarptı — kabul kriterleri + doğrulama
script'i iskeleti `docs/operasyon/OZEL_SMTP_KURULUMU.md`) ve **(2) K1 gerçek
restore provası** (kurucunun tam kanıt zinciri + G1 tablolarına özgü doğrulama
kalemleri `docs/operasyon/YEDEKLEME_GERI_YUKLEME.md` §5'e işlendi). **İkisi de
Claude'un YÜRÜTEMEYECEĞİ işlerdir** (harici sağlayıcı hesabı/DNS/staging ortamı
kurucunun/ekibin erişimi gerektirir) — bu oturumda yalnız runbook/checklist/
doğrulama iskeleti hazırlandı, kod/migration YOK. Doğru sıra (kurucunun kararı):
özel SMTP → K1 restore provası → ilk kontrollü pilot tenant → onboarding
gözlemi → kullanıcı geri bildirimi → G2 kodsuz analiz. **G2 kodsuz analizi
dahi bu ikisi kapanmadan başlamaz.**

**Dikey G1 BİTTİ (22 Temmuz 2026) — Kontrollü Pilot Provisioning ve Kurum
Onboarding.** Dikey F sonrası gap analysis'te bulunan en sert engel kapatıldı:
kod tabanında `signUp`/`inviteUserByEmail`/`createUser` HİÇ çağrılmıyordu —
yeni bir kurumu kendi başımıza sisteme sokmanın tek yolu service_role
script'iydi. G1 bunu değiştirir: `platform_operator` rolü kendi konsolundan
(`/platform`) pilot tenant açar + ilk kurum yöneticisini davet eder; davet
edilen Supabase'in kendi invite/parola-belirleme akışıyla (`/ilk-giris`)
girer; `/onboarding` sayfasında KVKK+şartlar kabulü → kritik hizmet CSV içe
aktarma önizleme → yalnız hukukça VERIFIED mevzuat paketi seçimi → incelemeye
gönderme; platform_operator son onayla `PILOT_AKTIF`e geçirir.

**KEŞİFTE BULUNAN GERÇEK AÇIK (G1'den önce kapatıldı):** `20260716120003`'teki
`tenants_insert_authenticated`/`profiles_insert_self` politikaları, HERHANGİ
bir authenticated kullanıcının (UI hiç gerekmeden) yeni tenant açıp kendini
admin yapabilmesini sağlıyordu — M1'in terk edilmiş self-serve bootstrap planı,
kullanılmayan ama AÇIK bir arka kapıydı. Kapatıldı; yeni yol yalnız
`platform_operator`'ın provisioning rotası.

**Rol modeli:** `profiles.role` check'ine `platform_operator` eklendi;
`tenant_id` nullable oldu + `role='platform_operator' ⟺ tenant_id IS NULL`
CHECK'i. `platform_operator` iş verisini (kontrol/kanıt/bulgu) RLS'ten dolayı
hiç GÖREMEZ — yeni bir "hariç tut" kuralı icat edilmedi, mevcut tenant-scoped
politikalar zaten `current_tenant_id()` NULL için sıfır satır döner.

**Yeni tablolar:** `tenant_provisioning` (guard'lı 8 durumlu makine: HAZIRLIK→
DAVET_GONDERILDI→ILK_GIRIS_TAMAMLANDI→KURULUM_DEVAM_EDIYOR→KURULUM_INCELEMEDE
→PILOT_AKTIF↔PILOT_DONDURULDU→PILOT_SONA_ERDI terminal) + append-only
`tenant_provisioning_audit`; `tenant_onboarding_acceptances` (KVKK/şartlar,
append-only); `onboarding_import_onizlemeleri` + `onboarding_import_uygula`
RPC (SoD PR-3A/3B'nin BİLİNÇLİ sadeleştirilmiş tekrarı — v1'de rollback zinciri
yok, yalnız önizle→uygula, maker-checker: yükleyen ≠ uygulayan zorunlu);
`regulation_packages` + `tenant_regulation_scope` (obligations'ın AYNI beş
durumlu doğrulama sözleşmesi — hiçbir paket VERIFIED DOĞMAZ, yalnız
LEGAL_REVIEW'den + dogrulayan atfıyla). "Pilot planı/süresi" YENİ bir billing
kavramı DEĞİL — mevcut `tenant_subscriptions`/`subscription_events` (V2 PR-2c)
kullanılır.

**Canlı smoke + e2e sırasında bulunup düzeltilen DÖRT gerçek açık:**
1. `tenants_select_platform_operator` eksikti — PostgREST'in `INSERT...
   RETURNING`'i RETURNING'deki satırın SELECT politikasını da sınıyor;
   platform_operator kendi açtığı tenant'ı geri okuyamıyordu.
2. `/ilk-giris` proxy'nin (`src/proxy.ts`) `ACIK_YOLLAR` listesinde yoktu —
   Supabase'in davet linki oturum jetonlarını URL HASH'inde taşır (sunucuya
   hiç gitmez); sunucu proxy'si `user=null` görüp `/giris`'e düşürüyordu,
   istemci hiç çalışma şansı bulamadan.
3. `tenant_provisioning`'de yalnız `platform_operator` için UPDATE politikası
   vardı — tenant admin kendi kurulumunu (ILK_GIRIS_TAMAMLANDI/KURULUM_
   DEVAM_EDIYOR/KURULUM_INCELEMEDE) hiç ilerletemiyordu. Yeni politika bu üç
   hedefle SINIRLI (PILOT_AKTIF/DONDURULDU/SONA_ERDI hâlâ yalnız operatör —
   RLS'te de, yalnız route'ta değil).
4. `src/lib/auth.tsx`'in giriş fonksiyonu, `platform_operator`'ın (tenant_id
   NULL) `profiliYukle()`'den `null` dönmesini "profili yok, hesap geçersiz"
   ile karıştırıp oturumu kapatıyordu — rol AYRICA kontrol edilip `/platform`e
   yönlendirildi.

**Operasyonel bulgu (kod değil, altyapı):** Supabase projesinin varsayılan
e-posta servisi ÇOK DÜŞÜK bir hız sınırına sahip (canlıda gerçekten
doğrulandı — birkaç `inviteUserByEmail` denemesi "rate limit exceeded"
döndürdü). **Gerçek pilot davetinden önce özel SMTP sağlayıcı (Supabase
panelinden) yapılandırılmalı** — aksi halde ilk birkaç davetten sonra
sistem davet gönderemez hâle gelir. e2e bunu `createUser` (mevcut fixture
deseni) + `generateLink` (e-posta göndermez) kombinasyonuyla atlatır.

**Kapsam dışı (bilinçli, kurucu G1 kararı):** açık self-servis kayıt ·
Stripe/iyzico/PayTR/otomatik tahsilat · gerçek üretim connector'ları ·
tüm mevzuat kütüphanesinin doğrulanması · gerçek çoklu-tenant kullanıcı
üyeliği (bugün 1 kullanıcı = 1 tenant sabit; aynı e-posta başka tenant'ta
zaten profili varsa rota AÇIKÇA reddeder, sessizce göz ardı etmez) · K1
(staging + gerçek restore provası — bloklayıcı çıkış kapısı, OPERASYONEL bir
prova, bu dilimde YAPILMADI) · K2 (harici cron envanteri — ayrı iş).

**Basitleştirme kararı (raporlandı, gizlenmedi):** ADR'nin 9 adımlı sihirbaz
taslağı TEK bir `/onboarding` sayfasında (ayrı stepper ekranları değil)
uygulandı — aynı işlevsellik, daha az UI iskeleti. İçe aktarma yalnız
KRİTİK_HİZMET için UI'a bağlandı (KONTROL/TEDARIKÇI motor+RPC'de hazır,
UI'a bağlanmadı — fast-follow).

**1658 birim + genişletilmiş RLS testleri (self-servis kapanışı saldırgan
testiyle) + 1 yeni Chromium e2e (platform davet→ilk giriş→kurulum→mevzuat
kapsamı→pilot aktif uçtan uca) + 19/19 hedefli regresyon grubu (iki temiz
koşu); typecheck/lint/build yeşil.** **Sıradaki (G1'in KENDİSİNDE bilinçli
kapsam dışı):** Dikey G2 — Commercial Provisioning (self-servis + ödeme),
yalnız gerçek pilot deneyimi doğrulandıktan SONRA.

**Dikey F, F5.1 BİTTİ (21 Temmuz 2026) — Kurtarma Karşılaştırmasının Kritik
Hizmet Test Paketine Projeksiyonu.** F5'in bitiminde kurucunun bilinçli
kapsam-dışı bıraktığı entegrasyon tamamlandı: `test_run_recovery_comparisons`
artık F2/F3'ün Kritik Hizmet Test Paketi'ne İLİŞKİSEL projekte ediliyor.
**Yeni karşılaştırma motoru YOK** — `kritik-hizmet-test-paketi.ts` yalnız
F5'in ZATEN VAR olan merkezi sözleşmelerini (`test_run_kurtarma_olcumu_guncel`
+ `test_run_kurtarma_karsilastirmasi_guncel`) test başına İLİŞKİSEL okur.
**Kurucunun kesin kararları tam uygulandı:**
- OTOMATIK_OLCUM + RTO/RPO'dan biri ASTI → paket **ENGELLENDI** (worst-of'un
  yeni objektif tabanı, mevcut ENGELLENDI'yi iyileştirmez).
- MANUEL_BEYAN + ASTI → paket **en fazla INCELEME_GEREKLI** (ENGELLENDI
  DEĞİL — daha zayıf güvenilirlik sinyali).
- KARSILADI genelDurum'u ASLA yükseltmez.
- OLCUM_YOK/TOLERANS_YOK/KARSILASTIRILAMAZ yalnız bağlamsal bilgi.
- **Kurucunun kesin kararı (madde 3):** güncel ölçüm var ama güncel
  karşılaştırma YOKSA bu NÖTR bir bilgidir — "Kurtarma ölçümü mevcut; tolerans
  karşılaştırması oluşturulmamış." metniyle taşınır, ne `INCELEME_GEREKLI` ne
  `VERI_EKSIK` üretir, paket durumunu DÜŞÜRMEZ (F4'ün "karşılaştırma
  opsiyoneldir" tasarım ilkesiyle tutarlı — opsiyonel adımı fiilen zorunlu
  kılan bir ceza icat edilmedi).
- Paket kendi sonuç cümlesini üretmez — F5'in mühürlü `aciklama` metni (MANUEL_
  BEYAN/OTOMATIK_OLCUM diliyle) AYNEN taşınır.

**Şema V2 additive** (kurucu onaylı): `kurtarmaKarsilastirmaOzeti?` yeni alanı
PER-TEST (`KritikHizmetTestDurumu` içinde — F5'in kurtarma karşılaştırmasının
kritik-hizmet-genelinde değil, TEST TANIMI/KOŞUSU bazında var olması nedeniyle;
kurucunun taslak örneği paket-seviyesi gibi görünüyordu, bu yerleşim kararı
açıkça raporlandı) eklendi; V1/eski-V2 kayıtlar okunabilir kalır, yeniden
hash'lenmez, backfill yapılmaz. **Migration YOK** — paket zaten opak JSONB
(`kritik_hizmet_test_paketi_snapshots.paket`), yeni alan otomatik akar; Proof
Room'un `'paket', v_paket.paket` pass-through'u da hiç değişmedi.

**İki geçişli route çözümleme** (`test-paketi/route.ts`): saf motorun kendi
"güncel koşu" seçimini YENİDEN YAZMAMAK için — birinci geçiş recoveryComparisons
OLMADAN çalışır (motorun `enGuncelKosu.testRunId`'lerini okur), yalnız O id'ler
için F5 RPC'leri çağrılır, ikinci geçişte nihai paket üretilir. Üçüncü bir
"güncel kayıt" kopyası YAZILMADI (F5 Karar B'nin devamı).

**Yol boyunca bulunup düzeltilen GERÇEK açık (F5'in kendisinde, F5.1 sırasında
yakalandı):** `/api/kontrol-test/run/[runId]/kurtarma-karsilastirmasi` GET
rotası merkezi RPC'nin düz özet satırını (`rto_sonucu` gibi skaler kolonlar)
doğrudan `karsilastirma` olarak dönüyordu — UI bileşeni iç içe `rto.aciklama`
BEKLİYORDU (ilk karşılaştırmada crash riski). Proof Room'un zaten kullandığı
"ikinci select ile mühürlü JSONB'yi çek" deseni bu GET rotasına da uygulandı.

**13 yeni saf motor testi (F5.1-1..13) + genişletilmiş e2e** (`e2e/kritik-
hizmet-test-paketi.spec.ts`'e üçüncü test): iki test tanımlı adanmış kritik
hizmet — biri MANUEL_BEYAN ASTI (paket İNCELEME_GEREKLI, ENGELLENDI DEĞİL),
biri yalnız ölçüm (NÖTR bilgi metni tam olarak görünür, paket durumu
düşmez) — mühürleme + anonim Proof Room'da AYNI özet minimize görünür. **1623
birim + 19/19 hedefli Dikey F/paylaşılan-fixture e2e (iki temiz koşu);
typecheck/lint/build yeşil.**

**Dikey F (F1→F5.1) şu an açık bekleyen bir karar taşımıyor** — kurucunun
F5.1 kapanış mesajında yeni bir sonraki dilim işaret edilmedi.

**Dikey F, F5 BİTTİ (21 Temmuz 2026) — Kurtarma Ölçümü ile Onaylı Etki
Toleransının Güvenli Karşılaştırılması.** Kurucunun A-D dört mimari kararı +
F5 artefakt kararlarıyla (ADR `docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-
2026-07-21.md`) tam uygulandı. **F2/F3 paketine BİLİNÇLİ SIZMADI** — entegrasyon
ayrı bir gelecek dilim "Dikey F5.1"e bırakıldı (kurucunun açık kararı).

**A) `impact_tolerances.superseded_at` forward-fix** (`20260721050000`): NULL→
timestamp tek yönlü, kronoloji guard'lı, sunucu aktivasyonda otomatik doldurur.
Bitemporal `impact_tolerance_asof(critical_service_id, as_of)`: `onay_zamani <=
as_of AND (superseded_at IS NULL OR as_of < superseded_at)` (onay dahil,
supersede hariç). Canlı backfill NO-OP (tek satır, hiç supersede edilmemiş).

**D) `measured_at` yaşam döngüsü** (`20260721060000`): iki `NOT VALID` CHECK
(gelecek-zaman reddi + olay-zamanı-tutarlılığı). Canlı veri GERÇEK bir açığı
doğruladı: bir satırda UI `measuredAt` hiç göndermiyordu, rota sessizce
`recordedAt`'e düşüyordu. Rota + `KurtarmaOlcumuBolumu` düzeltildi: olay
zamanları modunda `measured_at` OTOMATİK `hizmetGeriGeldiAt`'ten türetilir
(alan gizlenir); süre-beyanı modunda AÇIK VE ZORUNLU. Tek debris satırı `NOT
VALID` ile istisna edildi (immutable tablo, silinmedi).

**B) Merkezi "güncel kayıt" sözleşmesi** — `ORDER BY...LIMIT 1` KULLANILMADI
("en yeni" ≠ "geçerli supersede yaprağı"). Dört-durumlu (`GUNCEL_KAYIT_VAR/
KAYIT_YOK/BIRDEN_FAZLA_GUNCEL_KAYIT/ZINCIR_HATASI`) SQL fonksiyonu İKİ kez
kullanıldı (`test_run_kurtarma_olcumu_guncel` `20260721070000`; `test_run_
kurtarma_karsilastirmasi_guncel` `20260721080000`) — üçüncü bir kopya YOK.

**F5 artefaktı** — yeni immutable `test_run_recovery_comparisons`
(`20260721080000`): tolerans eşikleri MÜHÜRLENİR (sonraki tolerans revizyonu
geçmiş sonucu DEĞİŞTİRMEZ — canlı smoke'ta uçtan uca kanıtlandı). RTO/RPO
BAĞIMSIZ beş durum (`KARSILADI/ASTI/OLCUM_YOK/TOLERANS_YOK/KARSILASTIRILAMAZ`).
Güvenilirlik dili motor içinde mühürlü `aciklama` metniyle taşınır (MANUEL_
BEYAN: "beyan edilen değer..."; OTOMATIK_OLCUM: "ölçülen değer..." — asla çıplak
"RTO/RPO karşılandı"). Ledger/JWS durumu MATEMATİK SONUÇTAN AYRI boyut. Cross-
tenant + kritik-hizmet-bağlantısı guard'ı (`trrc_tenant_guard`) YENİ sınıf: test_
run'ın tanımının, karşılaştırılan kritik hizmete GERÇEKTEN (DIRECT/VIA) bağlı
olduğunu doğrular. Proof Room mevcut test_run dalına ilişkisel genişledi
(`20260721090000`, minimize; altıncı hedef AÇILMADI).

**Uygulama sırasında bulunup düzeltilen GERÇEK mantık açığı:** ilk motor
`tolerance.durum !== 'YURURLUKTE' → KARSILASTIRILAMAZ` kontrolü yapıyordu — bu
YANLIŞTI (bitemporal as-of eşleşmesi geçmişte geçerli ama ŞU AN SUPERSEDED bir
sürümü doğru döndürebilir). Düzeltme: `!yonetimOnayi || onayZamani === null`
("gerçekten onaylanmış mıydı", "şu an yürürlükte mi" değil) — kurucuya açıkça
bildirildi, motor+testler düzeltildi.

**DÖRDÜNCÜ+BEŞİNCİ "AYNI SINIF" fixture açığı** (tam regresyon sırasında
yakalandı): `test_run_recovery_comparisons` (yeni) ve `kritik_hizmet_test_
paketi_snapshots` (F2 borcu) RESTRICT FK'leri temizlik listesinde yoktu →
"E2E: MFA..."+"E2E Kritik Hizmet" birikmesi (kontrol-test/legal-basis/proof-
room/sod patladı). İkisi de doğru sırayla eklendi, iki temiz koşuyla
doğrulandı. F5'ten TAMAMEN BAĞIMSIZ, önceden var olan 5 e2e hatası (bulut-pak/
dikey-e1/dikey-e2/tedarikci-anket-sablonu/tedarikci-degerlendirme) ayrı bir
göreve işaretlendi, F5 kapsamına dahil edilmedi.

**18/18 hedefli Dikey F + paylaşılan-fixture regresyon grubu (iki temiz koşu)
+ 1610 birim + typecheck/lint/build yeşil.** Yeni `e2e/kurtarma-karsilastirmasi.
spec.ts`. Yol boyunca GET rotası hatası bulundu: `/api/kontrol-test/run/[runId]/
kurtarma-karsilastirmasi` GET merkezi RPC'nin düz özet satırını doğrudan
`karsilastirma` olarak dönüyordu — UI iç içe `rto.aciklama` bekliyordu (ilk
tıklamada crash). Proof Room'un "ikinci select ile mühürlü JSONB'yi çek"
deseni GET rotasına da uygulandı. **Sıradaki (F5'in KENDİSİNDE bilinçli
kapsam dışı, kurucu kararı bekliyor):** Dikey F5.1 — F2/F3 paketine ilişkisel
bağlanma.

**Dikey F, F4 BİTTİ (21 Temmuz 2026) — Kurtarma Ölçümü Yakalama ve Provenance
Katmanı.** F3'ün açtığı sıradaki karar: gerçek nicel karşılaştırmadan ÖNCE,
ölçülen kesinti/veri-kaybı verisi güvenilir/immutable/kanıtlı biçimde
KAYDEDİLMELİ. Kurucunun "Kararlarım"ıyla (ADR
`docs/adr/PR0-dikeyF-f4-kurtarma-olcumu-yakalama-2026-07-21.md`) yeni AYRI
immutable tablo `test_run_recovery_measurements` (migration `20260721030000`):
koşuya FK + ham olay zamanları (`kesinti_baslangic_at`/`hizmet_geri_geldi_at`/
`son_tutarli_veri_at`/`kurtarma_noktasi_at`) + SUNUCU-türetilmiş süreler
(`olculen_*_saat` Postgres `generated always as stored` — istemci yazamaz) +
süre-yalnız beyan (`beyan_*_saat`, AÇIKÇA beyan) + provenance + supersede soyu.
**KARŞILAŞTIRMA MOTORU YOK, `impact_tolerances` TÜKETİLMEZ** — hiçbir "RTO/RPO
karşılandı/aşıldı/tolerans içinde/hedef sağlandı" ifadesi üretilmez; mühürlü
payload'da `comparisonPerformed: false`.

Güvenilirlik katmanı iki değer: `MANUEL_BEYAN` (kullanıcı formu; beyan_eden
`auth.uid()`'e sabitlenir) ve `OTOMATIK_OLCUM` (yalnız service_role INSERT
edebilir — DB guard `auth.role() <> 'service_role'` iken reddeder, "sahte
yükseltme" imkansız; zorunlu source_system+source_event_id+evidence_id). Bu
dilimde gerçek connector YOK → fiilen üretilenler MANUEL_BEYAN, ama otomatik
katmanın güvenlik sözleşmesi şimdiden kurulu. UI/Proof Room AÇIKÇA "bu kayıt
kullanıcı beyanıdır; otomatik sistem ölçümü değildir" der; kanıt eklenmesi
beyanı ölçüme DÖNÜŞTÜRMEZ. İmmutable (UPDATE service_role dahil reddedilir);
düzeltme = yeni INSERT + `supersedes_measurement_id` (LİNEER zincir, partial
unique; "güncel" TÜRETİLİR). Cross-tenant test_run/evidence/supersede DB'de
reddedilir; kendini supersede + farklı-koşu supersede reddedilir. Kanıt zinciri
mevcut makineyle: RFC 8785 `canonicalHash` → JWS → generic ledger outbox
(`RECOVERY_MEASUREMENT` kind) → SCITT anchor. **Ledger durumu ile ölçüm kaynağı
AYRI olgular:** imza/ledger başarısızlığı bir kaydı "otomatik ölçüm"e YÜKSELTMEZ.
Proof Room mevcut `test_run_id` dalı İLİŞKİSEL genişletildi (güncel ölçüm
minimize; ham beyan_eden YOK) — altıncı polimorfik hedef AÇILMADI.

**17 saf motor testi + 17 PGlite/RLS testi + 1 yeni Proof Room PGlite testi
(regresyon dahil) + 15/15 canlı Supabase smoke (generated süreler, ANCHORED
ledger, immutable, supersede, minimize Proof Room, cross-tenant, OTOMATIK
provenance) + 1 yeni Chromium e2e; 1554 birim + 79 e2e, 0 skip; typecheck/lint/
build yeşil.** `baslangic_at`/`bitis_at`'ın (testin ÇALIŞMA penceresi, UI ikisine
`now` yazıyor) kurtarma penceresi için SEMANTİK OLARAK YANLIŞ olduğu doğrulandı
— o yüzden ayrı alanlar. Tam suite koşusunda ÜÇÜNCÜ kez aynı sınıf açık
yakalandı+düzeltildi (F4 mantığı değil): yeni `test_run_recovery_measurements.
test_run_id → test_runs ON DELETE RESTRICT`, `setup-e2e-fixtures.ts`'in test_
runs cascade temizliğini blokluyordu (bir koşuya ölçüm bağlanınca) → aynı 4
test (kontrol-test/legal-basis/proof-room/sod) "E2E: MFA..." tanımı
bulunamadığı için patlıyordu; tablo fixture temizlik listesine control_test_
definitions'tan ÖNCE eklendi (policy_exceptions/SoD ile aynı desen). Ayrıca
kurtarma-ölçümü bölümü TEMBEL yüklendi (bölüm kapalıyken fetch yok — havuz
baskısını önler). **Sıradaki (F4 dışı, kurucu kararı bekliyor):** gerçek
nicel karşılaştırma motoru (ölçüm ↔ `impact_tolerances`), tier-farkında —
ancak yeterli ölçüm olgunluğu + kurucu kararıyla.

**Dikey F, F3 BİTTİ (21 Temmuz 2026) — Onaylı Etki Toleransının Test Paketinde
Görünürlüğü.** Kurucunun "Seçenek A: sığ fakat dürüst bağlama" kararı tam
uygulandı: mevcut `impact_tolerances` (M13, o güne dek HİÇ tüketilmiyordu —
altıncı ertelemeydi) F2 Kritik Hizmet Test Paketi + UI + Proof Room görünümüne
BAĞLANDI. **NİCEL KARŞILAŞTIRMA YOK (kural 11 + doğruluk ilkesi):** `test_runs`
şemasında yapılandırılmış bir kesinti/veri-kaybı ÖLÇÜMÜ olmadığı için (RESTORE_
TEST bile jenerik `iddiaKarsilandi` mantığıyla değerlendiriliyor) "RTO
karşılandı"/"RPO karşılandı"/"tolerans içinde"/"tolerans aşıldı"/yüzdesel
başarı/sayısal güven skoru ASLA üretilmez — `karsilastirmaYapildi` alanı HER
ZAMAN `false` (motorun kendi kendini denetleyen dürüstlük bayrağı). Saf motor
(`kritik-hizmet-test-paketi.ts`) geriye dönük genişletildi: OPSİYONEL
`impactTolerances?` girdisi verilmezse (eski F2 çağıranları) sonuç BİREBİR F2
davranışıyla aynı kalır. Beş AYRI durum sınıfı (TOLERANS_TANIMLI_VE_ONAYLI/
TOLERANS_TANIMLI_FAKAT_ONAYSIZ/TOLERANS_BULUNAMADI/TOLERANS_VERISI_EKSIK/
BIRDEN_FAZLA_AKTIF_TOLERANS). `impact_tolerances_tek_yururlukte` partial unique
index birden fazla YURURLUKTE'yi yapısal olarak imkansız kılar; motor yine de
SAVUNMACI ele alır — rastgele seçmez, `BIRDEN_FAZLA_AKTIF_TOLERANS` döner.
`NULL` sıfır değildir (RTO dolu/RPO boş ayrı gösterilir). Genel pakete etki:
onaylı tolerans DOGRULANMIS tetiklemez, yokluğu ENGELLENDI üretmez; yalnız
ONAYSIZ TASLAK veya ÇAKIŞMA gerekçeye eklenir ve mevcut sonuç DOGRULANMIS ise
INCELEME_GEREKLI'ye düşürülür (worst-of'un doğal uzantısı, yeni politika icat
edilmedi; ENGELLENDI asla "iyileştirilmez").

Şema V1→V2 (`KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V2`): V1 sabiti korunur —
eski kayıtlar okunabilir, yeniden hash'lenmez, VERİ MIGRATION'IYLA
ZENGİNLEŞTİRİLMEZ; `etkiToleransiOzeti` TS'te opsiyonel, V1 JSON'da yok, UI/
Proof Room "bu sürümde bilgi yok" ile savunmacı okur. **Proof Room için YENİ
migration GEREKMEDİ:** özet, mühürlü `paket` JSONB'sinin İÇİNE mühürlenir ve
tür gereği zaten Proof-Room-güvenli (`onaylayanBelirtildi` boolean, ham
onaylayan UUID'si YOK; `toleranceId` kullanıcı değil artifact kimliği) — beşinci
dal olduğu gibi döndürür, altıncı dal AÇILMADI. `impact_tolerances`'ta
`valid_from`/`valid_until` YOK (kurucu taslağının düzeltilmesi — o alanlar farklı
bir tabloda; `onay_zamani`/`durum` kullanıldı). Kesinlikle AYRI bir gelecek
dikey: gerçek nicel bağlama — önce `test_runs`'a ölçüm veri sözleşmesi kurulmalı,
karşılaştırma motoru ANCAK ondan sonra.

**17 yeni saf motor testi (F3-1..17) + 5 yeni PGlite/RLS testi (tolerans tenant
izolasyonu, tek-yürürlükte, V1/V2 birlikte-okuma+immutability, Proof Room V2
minimize özet/V1 savunmacı) + 18/18 canlı Supabase smoke + 1 yeni Chromium e2e;
1519 birim + 78 e2e, 0 skip; typecheck/lint/build yeşil.** Yol boyunca bulunup
düzeltilen GERÇEK ön-var regresyon (F3 değil): giriş formuna eklenmiş "Şifreyi
göster" butonu `e2e/helpers.ts`'in `getByLabel("Şifre")`'ini iki elemana
(input + buton) çözüyordu — tam e2e suite'in 17 dört-göz/maker-checker testi
`ikinciKullaniciGirisYap`'ta patladı; `getByRole("textbox", {name:"Şifre"})`
ile daraltıldı (F3 mantığından bağımsız, tam suite koşusu SAYESİNDE yakalandı).

**Dikey F, F2 BİTTİ (21 Temmuz 2026) — Kritik Hizmet Test Paketi.** F1'in
Karar 2'sinin ("test programı/kampanya tablosu F2'ye ertelendi") yanıtı:
`kritik_hizmet_test_paketi_snapshots` (UI adı: "Kritik Hizmet Test Paketi",
manifest şeması `KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1` — kurucunun
`WARDPROOF_` önerisi, repo'nun `KALKAN_*` standardına uyarlandı) — tek bir
kritik hizmet için mevcut M12 zincirinin (test tanımı → koşu → öneri → bulgu
→ retest) mühürlü fotoğrafı. `test_kampanyasi_snapshots`/"kampanya" adı
BİLİNÇLİ kullanılmadı (M8 simülasyon/tatbikat diliyle karışma riski — kurucu
kararı). **Yeni test motoru YOK** — `src/lib/kritik-hizmet-test-paketi.ts`
saf bir projeksiyon: kapsam çözümleme İKİ güvenilir kaynaktan (`control_test_
definitions.critical_service_id` DOĞRUDAN + `critical_service_controls`
DOLAYLI), deterministik birleşim (`BOTH` ile tekilleşir, serbest metinden
otomatik eşleştirme yok). Paket iki katman: güncel görünüm (en son koşu,
worst-of yalnız buradan) + tarihsel iz özeti (yalnız sayaç/kimlik listeleri —
tam geçmiş kopyalanmaz, hiçbir sonuç silinmez/örtülmez). `genelDurum` beş
ayrı sınıf (DOGRULANMIS/INCELEME_GEREKLI/ENGELLENDI/VERI_EKSIK/TEST_YOK),
sayısal güven skoru YOK. Tablo `impact_graph_snapshots`/`cloud_assurance_
profile_snapshots`'ın AYNI deseni: append-only, maker-checker YOK (yeni bir
uyum iddiası değil, fotoğraf), service_role dahil UPDATE koşulsuz reddedilir.
Proof Room BEŞİNCİ polimorfik hedef eklendi (diğer dört dal değişmeden).

**27/27 canlı Supabase smoke (iki gerçek kullanıcı, doğrudan+dolaylı bağ,
çoklu koşu, bulgu/retest, cross-tenant reddi) + 1 yeni Chromium e2e + 17 saf
motor + 12 PGlite/RLS testi; 1495 birim + 77 e2e, 0 skip.** Bu dilimde
bulunan tek e2e hatası KENDİ yeni testimizdeki bir race'ti (ürün kodu değil):
"Mühürlü Paket Oluştur" sonrası `.first()` ile en yeni snapshot varsayılıyordu
— birikmiş eski satırlar varken bu yanlış satırı seçebiliyordu; POST
yanıtının kendi `id`'siyle eşleşen `data-testid`'e scope'lanarak düzeltildi
(Faz B'nin "gerçek POST yanıtını bekle" dersinin aynısı — bkz. AŞAĞIDA F1
notu). **Sıradaki (F1/F2'nin KENDİSİNDE bilinçli kapsam dışı, kurucu kararı
bekliyor):** test-program orkestrasyonu, çoklu kritik hizmet kampanyası, M17
`audit_samples` köprüsü, RTO/RPO/`impact_tolerances` bağlama, impact-graph
genişlemesi.

**Dikey F, F1 BİTTİ (21 Temmuz 2026) — Test Manifesti, Kritik Hizmet Bağı ve
Yeniden Test Görünürlüğü.** Kurucunun beş kararı ile daraltılmış F1 kapsamı
(docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-2026-07-20.md)
tam teslim edildi: `control_test_definitions` → `critical_service_id`/
`scenario_template_id` (opsiyonel, nullable, tenant guard'lı — serbest metin
`kritik_hizmet_adi`/`senaryo_kimligi` SİLİNMEDİ, yanında durur);
`finding_verified_closure_guard` forward-fix (`20260720310000`) — önceki BEŞ
kontrol aynen korunarak ALTINCI eklendi: öneriyi KABUL eden kişi kendi
bulgusunu doğrulanmış biçimde kapatamaz (bağımsızlık/dört göz, `control_test_
finding_proposals.karar_veren`'den türetilir, ilişki yoksa guard sessizce
atlar — sahte kısıtlama icat edilmez). `test_runs.retest_of_finding_id`
(`20260720320000`) — bir koşunun retest NİYETİ, `findings.kapatma_retest_
run_id`'den (tarihsel kapanış GERÇEĞİ) BİLİNÇLİ AYRI bir alan; ikisi birlikte
yaşar. Manifest şeması V2→V3 (`kontrol-test-ledger.ts`): `findingId` ASLA
manifeste yazılmaz (bulgu, manifest mühürlendikten SONRA doğar — zamanlama
kuralı ADR'de); ilişki hep `test_run → öneri → bulgu` zincirinden İLİŞKİSEL
sorgulanır. `impact-graph.ts`'e yeni `BULGU_RETEST` kenarı (mevcut `BULGU`/
`TEST` düğümleri yeniden kullanılır, yeni düğüm türü YOK) — hem saf motora
hem GERÇEK route'a (`/api/dayaniklilik/graf/anlik-goruntu`) kablolu. Proof
Room forward-fix (`20260720330000`) hem RPC hem SAYFA (`/proof/[token]`)
seviyesinde: `manifestOzeti` (şema V3 + kritik hizmet/senaryo doğrulanmış mı
BOOLEAN — ham UUID/isim DEĞİL, mevcut "kullanıcı kimlikleri dönmez" ilkesi
korunarak), `retestNiyeti`, İLİŞKİSEL `kabulEdilmisBulgu` ve tarihsel
`kapananBulgular` — manifest hash'i BİLİNÇLİ gösterilmiyor (RFC 8785 yalnız
TS'te var, SQL'de yok — raporlanmış teknik sınır). UI: `/controls/[id]`'de
"Kritik hizmete bağlı"/"Serbest metin kapsamı"/"Senaryo şablonuna bağlı"/
"Doğrulanmamış senaryo kimliği" etiketli seçiciler + bulgu/retest zinciri
görünümü + retest-niyeti seçici. **31/31 canlı Supabase smoke (iki gerçek
kullanıcı, tam zincir) + 1 yeni Chromium e2e + 24 yeni PGlite testi; 1465
birim + 76 e2e, 0 skip; build yeşil.**

Yol boyunca (tam e2e suite koşusu SAYESİNDE) bulunup düzeltilen İKİ gerçek
açık, F1'in kendisinden BAĞIMSIZ: (1) `scripts/setup-e2e-fixtures.ts`
`policy_exceptions` tablosunu (M16 policy_lifecycle_v2, `telafi_test_
definition_id ... on delete restrict`) hiç temizlemiyordu — `control_test_
definitions` reset'i sessizce başarısız oluyor, aynı isimli fixture tanımı
her koşuda birikiyordu; (2) yeni `retest_of_finding_id` (`on delete set
null`) `test_run_immutable()` (M12, `20260717230001`) ile çatışıyordu —
trigger HER update'i koşulsuz reddettiği için, bir bulgu silindiğinde
Postgres'in KENDİ FK-cascade UPDATE'i bile reddediliyor, ilişkili koşu bir
daha ASLA silinemiyordu; forward-fix (`20260720340000`) yalnız bu tek-alan
null'lamayı serbest bırakıyor, kural 13'ün gerisini bozmuyor. İkisi de
regresyon testleriyle kilitlendi.

**Bilinçli sonraki dilim (F1'in KENDİSİNDE kapsam dışı, kurucu kararı
bekliyor):** F2 test-program/campaign tablosu, M17 `audit_samples`↔
`SAMPLE_REVIEW` bridge, RTO/RPO/`impact_tolerances` bağlama, TLPT/pentest
orkestrasyon, AI-üretilmiş verdict, findings kapanışı için özel bir UI/rota
(bugün olduğu gibi doğrudan DB üzerinden, service_role ile — kontrol-test.
spec.ts'teki emsal desen).

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

**M16 ÜRETİM KAPISI GEÇTİ (kurucu onayı 18 Temmuz "geçir").** K1 staging + K2
dış cron paralel borç (kapıyı bloklamaz). **V2 PR-2a BİTTİ:** organization_
profiles (org_type: REGULATED/CORPORATE_FINANCE/MIXED_GROUP; tenants.segment
dokunulmadı), onboarding `/kurulum`, saf segment yardımcıları, scope-recalc
outbox olayı. **688 birim + 26 e2e.** **PR-2b (dayanak/pack) + PR-2c (plan/entitlement) BİTTİ → V2 PR-2 TAMAM.**
PR-2c: 5 plan × sürümlü yetenek matrisi (jsonb, koda gömülü değil), server-side
zorlama (`entitlement-server.ts`; `/api/sod/degerlendir` sod_tam ister →
Starter 402 / Pro 200, e2e kanıtlı), forged-plan-claim DB'de reddedilir (istemci
abonelik yazamaz), downgrade veri silmez (RLS testli). Billing K3 OPEN-DECISION
(MVP mock provisioning). **710 birim + 30 e2e, 0 skip.** Sıradaki: CFO Kalkanı
MVP → Regulated dikey dilim. **BORÇ:** PGlite test kurulumu 50+ migration'ı her dosyada
uyguluyor (global timeout 90sn; snapshot-klon çözümü ayrı iş olarak spawn'landı).

**⏩ OTURUMLAR ARASI DEVİR: `docs/DEVAM.md` OKU.** Kurucu kalıcı onay: V2 PR
sırasının sonuna kadar duraksamadan devam. Bugün canlıda: M16 kapısı geçti +
V2 PR-0/2a/2b/2c/3a/3b/4a + PGlite hızlandırma + AA.

**V2 PR-4b BİTTİ (18 Temmuz gece, M20-M24 tek yeşil dikey dilim, canlı e2e
kanıtlı):** (1) `provisions` bitemporal global hüküm (valid+system time,
düzeltme=yeni kayıt); (2) `obligations`+`obligation_control_mappings` 6 durumlu
doğrulama, DB guard: VERIFIED doğamaz / yalnız LEGAL_REVIEW'den + dogrulayan
atfı / VERIFIED içerik donuk; (3) `applicability_decisions` tenant'a özgü,
UNKNOWN≠NOT_APPLICABLE DB invariant'ı (NA=gerekçe+onay+kimlik atfı), append-only
karar zinciri, RFC8785 fact fingerprint (`applicability.ts` — kural motoru
UYDURULMADI: eksik olgu→UNKNOWN, tam olguda karar insanda); (4) legal-basis
guard (`legal-basis.ts` saf motor + `legal-basis-server.ts` RLS toplayıcı)
`/api/kontrol-test/[id]/calistir`a bağlı: doğrulanmamış eşleme ZORUNLU kontrolü
409+koşusuz-fotoğrafla BLOKlar, kapsam sorunları uyarıdır (kural 13 ruhu),
dayanaksız kontrol bloklanmaz; her koşuda immutable `execution_legal_snapshots`
(UPDATE herkese kapalı; DELETE test_runs disipliniyle hizalı — `20260718190000`,
fixture cascade regresyonunu PGlite testi yakaladı); (5) M24 sitasyon paketi:
`citation-bundle.ts` + `/api/kontrol-test/run/[runId]/sitasyon` + bağımsız
`scripts/verify-sitasyon.ts` (DB'siz; e2e ayrı süreçte VERIFIED/kurcalı-FAILED),
üç EK hash `legalSnapshotHash`/`sourceBundleHash`/`applicabilityDecisionHash`
(kural 15, mevcut dörtlü bozulmadı; fotoğrafsız eski koşuda NULL — uydurulmaz),
paket İMZASIZ_HASH_BUTUNLUKLU (sahte "signed" yok). Canlı smoke 21/21; 6 yeni
migration canlıda. **789 birim (61 dosya) + 34 e2e, 0 skip; build yeşil.**
Kalan dar iş: EvidenceTraceRail Hüküm/Yükümlülük düğümlerine gerçek veri +
`/regulasyon/kaynaklar` hüküm listesi (DEVAM.md §2). Sıradaki: V2 PR-5 (M17).

**V2 MVP Stratejisi (18 Temmuz gecesi, yedinci belge) işlendi — PR-0, kod yok:**
`docs/arastirma/KALKAN_OS_V2_MVP_Strateji_Ek_Talimat_2026.md` + PR-0 dökümü
`docs/adr/PR0-v2-mvp-strateji-2026-07-18.md` + ROADMAP §1.8. İki ürün hattı
(Regulated + CFO Kalkanı), aynı çekirdek. V2 PR-1'in ("M16 kapanışı") işlevsel
maddeleri kanıt tablosuyla ZATEN BİTMİŞ; sıradaki gerçek iş = M16 platform
kapanışı (threat model, backup/rollback prosedürü, AA taraması, limit ölçümü;
staging K1 + dış cron K2 kurucu kararı). Sonra: Segment+Entitlement → CFO MVP
→ Regulated dikey dilim (ADR-V2-1…6 onay bekliyor; billing K3 OPEN-DECISION,
MVP'de manuel provisioning).

**Master talimat (18 Temmuz, altıncı belge) işlendi:** `docs/arastirma/KALKAN_OS_
Master_Talimat_UI_Regulasyon_2026.md` + PR-0 keşif/ADR (`docs/adr/PR0-master-
talimat-kesif-2026-07-18.md`, ROADMAP §1.7). Dört ADR (token/tema/ortak-hukuk-
verisi/kaynak-erişimi) kurucu ONAYLI. **PR-1 UI Foundation BİTTİ** (ROADMAP §1.7
altında tam liste): Regulatory Observatory paleti (shadcn adları korunarak),
paketsiz tema (body-başı inline script + cookie + `profiles.tema_tercihi`,
migration `20260718050000`), AppShell (NavRail/ContextHeader/MobileNav, ölü link
yok), durum bileşenleri + `EvidenceTraceRail` iskeleti, health endpoint'leri,
güvenlik başlıkları (CSP report-only). Tema e2e iki gerçek bug yakaladı: App
Router manuel `<head>`'i yok sayar (script body'ye taşındı) ve supabase-js
builder lazy (`void builder` istek GÖNDERMEZ — `.then` şart). **642 birim +
19 e2e, 0 skip; production build yeşil.** Görsel baseline:
`docs/gorsel-baseline/`.

**PR-2 Ekran Taşıma da BİTTİ** (ROADMAP §1.7 altında tam liste): tüm
`*_BADGE_VARIANT` sabitleri kaldırıldı, 13 ekran tek semantik durum diline
(`StatusBadge`, ui-labels `*_SEMANTIK` eşlemeleri) geçti — kural 13 görselde
de ayrık (UNKNOWN≠FAILED≠STALE≠EXCEPTION). Kanıt izi rayı kontrol detayında
canlı (dürüst kısmi zincir; Test düğümü `kontrolGuvenceDurumu`nu bileşen
callback'iyle alır). Davranış birebir korundu.

**PR-3C BİTTİ (18 Temmuz, `20260718060000`) — rollback + maker-checker, canlı
smoke doğrulı.** Ters değişiklik seti APPLY ANINDA manifest'e yakalanır
(EKLENDI/GUNCELLENDI-tam-eski-satır/SONA_ERDIRILDI; upsert-revive→GUNCELLENDI
düzeltmesi; legacy manifest NULL → rollback 409, uydurulmaz). `sod_import_
geri_al` RPC tek transaction: fiziksel silme YOK (ekleneni sona erdir,
güncelleneni geri yükle, sona-erdirileni yeniden aç) + outbox + UYGULANDI.
Maker-checker DB guard'ı (service_role dahil): onaylayan ≠ talep_eden, karar
verilmiş kayıt donuk, talep RLS'i `talep_eden=auth.uid()`. İki rota (talep +
karar). Deploy doğrulaması gerçek bug yakaladı: `/health` proxy açık yollarında
değildi (307) → düzeltildi + smoke e2e kilidi.

**PR-3D BİTTİ (18 Temmuz) — PR-3 SERİSİ TAMAM.** Dar UI `/sod/import`
(dosya+kaynak+mod → dry-run rozetleri → Uygula/stale-409 → manifest geçmişi +
rollback talep/karar + outbox drenaj butonu), MIME kapı kontrolü
(`csvDosyasiKabulEdilebilirMi`, çift-uzantı reddi), gerçek Chromium e2e A–E
(`sod-import.spec.ts`): import+DB doğrulaması / idempotency / stale 409 /
maker-checker iki-kullanıcı rollback / outbox→değerlendirme gerçek çatışma
(kurucu #10 kapandı). Testler kirli DB'ye dayanıklı (RESOLVED kalıntılar
projeksiyonda yeniden sayılabilir — sabit sayı assert edilmez).

**#5 + #9 BİTTİ (18 Temmuz, `20260718070000/070001`).** #5: atama/kural/taraf
değişimi outbox'a `SOD_YENIDEN_DEGERLENDIR` kuyruklar (kiracı başına debounce);
`/sod` açılışında oto-drenaj; motor TS'te tek kaynak. #9: güvenlik testleri
migration'suz KIRMIZI koşularak **üç gerçek açık kanıtlandı ve kapatıldı** —
istisna başkası adına talep, onay atfı sahteleme ("dolaylı özdeşlikle kendi
istisnasını onaylama"), resolved_by sahteleme; kimlik atfı alanları oturum
sahibine sabitlendi (service/cron muaf, süre-dolumu regresyon testli).
**#3 İstisna uzatma BİTTİ (18 Temmuz, `20260718080000`):** uzatma = yeni kayıt
(`onceki_istisna_id` zinciri; onaylı kayıt kilitli, geçmiş silinmez); zincir
guard'lı (aynı çatışma + karara bağlanmış önceki + ileri tarih); bağımsız onay
zinciri uzatmaya otomatik işler. UI `sod/[id]`'de "Uzatma Talep Et" + "Uzatma"
rozeti; sod.spec e2e'si dolmuş→REOPENED→uzatma→ikinci-kullanıcı-onayı akışını
sürüyor. Vitest global timeout 60sn'ye çekildi (PGlite yük-flake sınıfı — üç
koşuda üç farklı dosyada aynı desen; assert değişmedi).

**#8 Üretim panosu BİTTİ (18 Temmuz):** `/sod`'a dört kart — Kapsama (payda
görünür; eksik taraf = unknown "değerlendirilemiyor"), Kural Doğrulama
(kural 3), Çatışma Yaşam Döngüsü (durumlar birleşmez), İzleme Sinyalleri
(yaklaşan istisna + SON IMPORT SONRASI yeni çatışma; import yoksa null ≠ 0).
Türetme saf `sod-metrikler.ts` (7 birim test, kural 11); master §9.1: tek
birleşik skor YOK.

**M16 ÜRETİM KAPANIŞI PR'ı BİTTİ (18 Temmuz gecesi):** WCAG AA otomatik
taraması (`e2e/erisilebilirlik.spec.ts`, @axe-core; 2 gerçek ihlal bulundu+
düzeltildi: Select tetiği aria-label + success/warning kontrast koyulaştırma,
ham amber→semantik warning); operasyon dokümanları (THREAT_MODEL, YEDEKLEME_
GERI_YUKLEME [veri restore provası K1'e bağlı], DEPLOY_ROLLBACK, LIMITLER
[canlı ölçüm]); dış cron ADR (K2). **677 birim + 28 e2e, 0 skip.** M16 kapısı
tek taraflı "geçti" İLAN EDİLMEDİ — kurucu kararı bekliyor (kalan: K1 staging +
veri restore provası, K2 dış cron). Kapı geçince M17 ADR + Segment/Entitlement.

**#6 Atama UI BİTTİ (18 Temmuz, dar): `/sod/atamalar`** — liste+filtre
(kaynak/geçerlilik/metin), 500 kayıt sınırı görünür, BİLİNÇLİ SALT-OKUR
(giriş yolu CSV import; elle düzenleme bütünlük zincirini baypas ederdi —
e2e "düzenleme kontrolü yok"u assert ediyor). **KURUCUNUN 12 MADDESİ TAMAM**
(#1–#10; #12 kapı-sonrası ADR işi). **677 birim + 25 e2e, 0 skip.** M16 kapı
KARARI kurucuda: belge §32'nin platform maddeleri açık (staging yok, threat
model yazılı değil, backup/rollback prosedürü yazılı değil, resmi AA denetimi
yok, dış cron ADR'lik) — ROADMAP "M16 ÜRETİM KAPISI DURUMU" bölümünde. Kapı
kararı verilmeden M17/M18/M19+ kodu YOK. Deploy: `main` push'u Hostinger'a
otomatik gider.

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

**CANLI ALAN ADI: `wardproof.com`** (21 Temmuz 2026, kurucu bildirdi). Deploy
sağlık kontrolleri artık `wardproof.com` üzerinden yapılır — `/health/live`→200,
`/health/ready`→200, `/`→307→`/giris` (F3'te doğrulandı). Eski geçici Hostinger
alan adı `blue-yak-865668.hostingersite.com` ARTIK SERVİS VERMİYOR (ona yapılan
istekler el sıkışma sonrası ECONNRESET). `www.wardproof.com` şu an 503 (apex
çalışıyor; `www` DNS/redirect config düzeltmesi bekliyor — ayrı iş).

**Deploy artık DOĞRULANDI (17 Temmuz 2026 akşamı) — Hostinger Business, Node.js
otomatik dağıtım.** GitHub'dan otomatik çekiyor (`orhanluce/kalkan_os`, `main`),
build komutu `pnpm run build`, Node 22.x, (o günkü geçici alan adı
`blue-yak-865668.hostingersite.com` — artık `wardproof.com`, yukarı bkz).
**Kanıt, tahmin değil:** kurucunun ekran
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
16. AI hiçbir zaman insan onayı olmadan PASSED/UYUMLU/KAPALI/DOĞRULANDI/KARŞILANDI gibi
   nihai bir durum üretemez; AI çıktısı her zaman taslak/öneri (SUGGESTED/PROPOSED) olarak
   doğar, kesin durum değişikliği yetkili insan onayıyla (gerekirse maker-checker'la) yapılır.
17. AI çıktısının provenance'ı zorunludur: kullanılan model/sürüm, kaynak, üretim zamanı ve
   insan inceleme/onay durumu birlikte taşınır — bunlardan biri eksikse çıktı "doğrulanmış"
   sayılmaz.
18. Ürün dilinde (kod, doküman, pazarlama) "blockchain" iddiası kullanılmaz; ham müşteri
   verisi, PII veya mevzuat içeriği hiçbir genel/public chain'e yazılmaz. Kriptografik kanıt
   zinciri "kriptografik şeffaflık defteri" gibi doğru ve dürüst dille anlatılır.
19. Bugünkü imza/zaman-damgası altyapısının sınırı açıkça taşınır: `LocalDevSigner`
   production-grade bir imzalayıcı DEĞİLDİR; SCITT veya RFC 9162 ile "tam uyum" ya da
   "sertifikalı" iddia edilmez — yalnız bu mimarilerden esinlenildiği söylenir.
20. Pilot operasyon önceliği sabit sıradadır: özel SMTP → K1 restore provası → K2 kritik
   zamanlanmış görev güvencesi → hukukça doğrulanmış ilk mevzuat paketi → ilk kontrollü pilot
   → pilot geri bildirimi — bu sıra tamamlanmadan Dikey H (AI Yönetişimi) ve Dikey I
   (Kriptografik Kanıt/KMS) kodsuz analizi bile açılmaz, G2 (self-servis+ödeme) hiç açılmaz.
