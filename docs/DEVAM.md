# DEVAM TALİMATI — kaldığın yerden sürdür (22 Temmuz 2026 güncellemesi — Dikey G1)

Bu dosya oturumlar arası devir içindir. **Kurucu kalıcı onay verdi:
"her bitişte onaya gerek yok, V2 PR sırasının SONUNA KADAR devam."** Her PR'ı
doğrula → commit → push → deploy health kontrol, duraksamadan sonrakine geç.
**AMA:** her GERÇEKTEN YENİ mimari karar için önce KODSUZ analiz sun, kurucunun
açık "Kararlarım"ını bekle, sonra tam uygula + rapor (F1-G1'de bu iki-faz
disiplini tutarlı uygulandı).

## -9. Dikey J — Otomatik Kanıt Toplama roadmap tanımı + landing vizyon notu (22 Temmuz 2026, KOD YOK)

Kodsuz bir konumlandırma turu, vertikal BİTTİ değil. Kurucunun "WardProof'un
otomatik kanıt toplama altyapısına doğru tasarlandığını gösterelim ama sahte
özellik üretmeyelim" talebi karşılandı: `docs/adr/PR0-dikeyJ-otomatik-kanit-
toplama-2026-07-22.md`'de tam mimari analiz (Kurumsal Sistemler → Connector
Layer → Evidence Collector → Kontrol Eşleştirme → Test Motoru → Kriptografik
Kanıt Zinciri → Proof Room) + bugün/planlanan/iddia-edilmeyecek ayrımı +
landing/yatırımcı mesajlaşması. **Bulgu:** son dört katman zaten üretimde
(`control-test.ts`'in `Gozlem` sözleşmesi connector'lı bir dünyayı zaten
varsayıyordu — kural 13); eksik yalnız Connector Layer + Evidence Collector.
Gerçek ön koşul borcu: `evidences.kaynak_kontrol_id` yok (ROADMAP §2710).
ROADMAP.md §1.71'e işlendi (M08 Connector Platform + M39 Connector Hub
placeholder'larının ilk detaylı mimarisi — **"Dikey H" değil "Dikey J"**,
§1.69'daki AI Yönetişimi vertikaliyle ad çakışmasını önlemek için kurucunun
önerdiği harften değiştirildi). `/tanitim`e küçük, "yakında" demeyen bir
gelecek-vizyonu notu eklendi (Güven bölümü altına, mevcut AI Güvence/
Kriptografik Şeffaflık Defteri kartlarıyla aynı üslupta). **Öncelik sırası
DEĞİŞMEDİ:** özel SMTP → K1 → K2 → mevzuat paketi → pilot → geri bildirim
tamamlanmadan Dikey J'nin kodsuz analizi bile açılmaz.

## -8. Dikey H/I roadmap tanımı + landing sayfası AI/kriptografi kartları (22 Temmuz 2026, KOD YOK)

Bir "vertical BİTTİ" değil — kodsuz bir doküman+pazarlama-metni turu.
Kurucunun "sitede AI ve chain teknolojisinden bahsedelim ama abartmadan"
talebi karşılandı: `/tanitim`e iki kart eklendi (Modüller: "AI Güvence" —
mevcut `/ai-guvence` M37'yi anlatır; Güven bölümü: "Kriptografik Şeffaflık
Defteri" — mevcut `transparency.ts` Merkle/JWS defterini anlatır), ikisi de
"blockchain"/"AI otomatik karar verir"/"SCITT sertifikalı" gibi iddialar
KULLANMADAN. `transparency.ts`'teki eski RFC 6962 referansı RFC 9162'ye
düzeltildi (davranış değişmedi, yalnız yorum). ROADMAP.md §1.69 (Dikey H —
AI Yönetişimi, H1-H5) ve §1.70 (Dikey I — Kriptografik Kanıt, I1-I5) planlı
(kod yok) dikey olarak eklendi; CLAUDE.md'ye kural 16-20 (AI karar sınırı,
provenance zorunluluğu, blockchain/SCITT/RFC iddia yasağı, pilot önceliği)
eklendi. **Öncelik sırası DEĞİŞMEDİ:** özel SMTP → K1 → K2 → mevzuat paketi
→ pilot → geri bildirim tamamlanmadan H1/I1 kodsuz analizi bile açılmaz.

## -7. DİKEY G1 BİTTİ (22 Temmuz 2026) — Kontrollü Pilot Provisioning ve
Kurum Onboarding

Dikey F sonrası gap analysis'in bulduğu en sert engel: kod tabanında
`signUp`/`inviteUserByEmail`/`createUser` HİÇ çağrılmıyordu — yeni bir kurumu
kendi başımıza sisteme sokmanın tek yolu service_role script'iydi. G1 bunu
kapatır: `platform_operator` → `/platform` konsolundan pilot tenant + ilk
davet → davet edilen `/ilk-giris`te Supabase'in kendi invite akışıyla parola
belirler → `/onboarding`da KVKK/şartlar → kritik hizmet CSV önizleme →
yalnız VERIFIED mevzuat paketi seçimi → incelemeye gönder → platform_operator
son onayla PILOT_AKTIF.

**KEŞİFTE BULUNAN GERÇEK AÇIK (uygulamadan ÖNCE kapatıldı):** eski
self-serve bootstrap RLS politikaları (`tenants_insert_authenticated`,
`profiles_insert_self`, 20260716120003) HERHANGİ bir authenticated
kullanıcının UI hiç gerekmeden yeni tenant açıp kendini admin yapmasına izin
veriyordu — M1'in terk edilmiş planı, kullanılmayan ama AÇIK arka kapı.
Kapatıldı; tek yol artık `platform_operator`'ın provisioning rotası.

**Rol modeli:** `platform_operator` (profiles.role), `tenant_id` nullable +
`role='platform_operator' ⟺ tenant_id IS NULL` CHECK'i. İş verisini RLS'ten
dolayı hiç göremez (current_tenant_id() NULL → mevcut politikalar zaten sıfır
satır döner, yeni "hariç tut" kuralı icat edilmedi).

**Yeni tablolar:** `tenant_provisioning` (guard'lı 8 durumlu makine, append-
only audit) · `tenant_onboarding_acceptances` (KVKK/şartlar, append-only) ·
`onboarding_import_onizlemeleri` + `onboarding_import_uygula` RPC (SoD
PR-3A/3B'nin BİLİNÇLİ sadeleştirilmiş tekrarı — v1 rollback yok, maker-
checker var) · `regulation_packages` + `tenant_regulation_scope`
(obligations'ın AYNI beş-durumlu doğrulama sözleşmesi). "Pilot planı/süresi"
mevcut `tenant_subscriptions`/`subscription_events`i (V2 PR-2c) kullanır —
yeni billing kavramı YOK.

**Canlı smoke + e2e sırasında bulunup düzeltilen DÖRT gerçek açık:**
1. `tenants_select_platform_operator` eksikti (INSERT+RETURNING, RETURNING
   satırı SELECT politikasına da tabidir — F5'in kendi "ikinci select"
   dersinin ters yönden aynısı).
2. `/ilk-giris` proxy'nin `ACIK_YOLLAR` listesinde yoktu — davet linkinin
   oturum jetonları URL HASH'inde (sunucuya gitmez), sunucu proxy'si
   `user=null` görüp erken `/giris`e düşürüyordu.
3. `tenant_provisioning`de tenant admin için UPDATE politikası hiç yoktu —
   kendi kurulumunu ilerletemiyordu. Yeni politika yalnız üç kendi-hizmet
   hedefiyle sınırlı (PILOT_AKTIF/DONDURULDU/SONA_ERDI hâlâ yalnız operatör).
4. `auth.tsx`'in girişi, platform_operator'ın (tenant_id NULL) `null` Profile
   dönüşünü "hesap geçersiz" sanıp oturumu kapatıyordu — rol ayrıca kontrol
   edilip `/platform`e yönlendirildi.

**Operasyonel bulgu (altyapı, kod değil):** Supabase'in varsayılan e-posta
servisi ÇOK DÜŞÜK hız sınırlı — canlıda doğrulandı. **Gerçek pilot
davetinden önce özel SMTP yapılandırılmalı.**

**Kapsam dışı (bilinçli G1 kararı):** self-servis kayıt, ödeme/billing,
gerçek connector'lar, tüm mevzuat kütüphanesi doğrulaması, gerçek çoklu-
tenant üyelik, K1 (staging+restore provası — OPERASYONEL, bu dilimde
yapılmadı, bloklayıcı çıkış kapısı), K2 (harici cron envanteri, ayrı iş).

**Basitleştirme (raporlandı):** 9 adımlı sihirbaz taslağı TEK `/onboarding`
sayfasında; içe aktarma UI'ı yalnız KRİTİK_HİZMET'e bağlandı (KONTROL/
TEDARIKÇI motor+RPC hazır, UI fast-follow).

**1658 birim + genişletilmiş RLS (self-servis kapanışı saldırgan testiyle) +
1 yeni Chromium e2e (uçtan uca) + 19/19 hedefli regresyon (iki temiz koşu);
typecheck/lint/build yeşil.** **Sıradaki (G1 kapsamı dışı, kurucu kararı
bekliyor):** Dikey G2 — Commercial Provisioning (self-servis + ödeme),
yalnız gerçek pilot deneyimi doğrulandıktan sonra; K1 staging+restore
provası (operasyonel, kurucu/ekip erişimi gerektirir).

## -6. DİKEY F, F5.1 BİTTİ (21 Temmuz 2026) — Kurtarma Karşılaştırmasının
Kritik Hizmet Test Paketine Projeksiyonu

F5'in bilinçli kapsam dışı bıraktığı entegrasyon tamamlandı — kurucunun üç
kesin kararıyla (madde 1-3, aşağıda) + sekiz ek kural. **Yeni motor YOK**:
`kritik-hizmet-test-paketi.ts` yalnız F5'in merkezi sözleşmelerini
(`test_run_kurtarma_olcumu_guncel` + `test_run_kurtarma_karsilastirmasi_guncel`)
test tanımı bazında İLİŞKİSEL okur.

**Kurucunun kesin kararları:**
1. OTOMATIK_OLCUM + RTO/RPO ASTI → **ENGELLENDI**.
2. MANUEL_BEYAN + ASTI → **en fazla INCELEME_GEREKLI** (ENGELLENDI değil).
3. **Güncel ölçüm var, güncel karşılaştırma YOK → NÖTR bilgi** ("Kurtarma
   ölçümü mevcut; tolerans karşılaştırması oluşturulmamış."), ne İNCELEME_
   GEREKLI ne VERI_EKSIK üretir, paket durumunu DÜŞÜRMEZ — F4'ün "karşılaştırma
   opsiyoneldir" ilkesiyle tutarlı (opsiyonel adımı fiilen zorunlu kılan bir
   ceza icat edilmedi). Bu, ilk taslağımdaki "INCELEME_GEREKLI" önerisinin
   kurucu tarafından açıkça REDDEDİLİP düzeltildiği tek karardı.

Ayrıca: KARSILADI genelDurum'u yükseltmez; OLCUM_YOK/TOLERANS_YOK/
KARSILASTIRILAMAZ yalnız bağlamsal bilgi; paket kendi cümlesini üretmez (F5'in
mühürlü `aciklama` metni AYNEN taşınır).

**Şema V2 additive** (kurucu onaylı, migration YOK — paket zaten opak JSONB):
`kurtarmaKarsilastirmaOzeti?` PER-TEST alanı (kurucunun taslak örneği paket-
seviyesi gibi görünüyordu; TEST TANIMI bazında yerleştirme kararı açıkça
raporlandı, düzeltilmedi). Route **iki geçişli** çalışır — motorun kendi
"güncel koşu" seçimi YENİDEN YAZILMADI, yalnız o id'ler için F5 RPC'leri
çağrılır.

**Yol boyunca bulunup düzeltilen GERÇEK açık (F5'in kendisinde):**
`/api/kontrol-test/run/[runId]/kurtarma-karsilastirmasi` GET rotası merkezi
RPC'nin düz özet satırını doğrudan döndürüyordu — UI iç içe `rto.aciklama`
bekliyordu (crash riski). Proof Room'un "ikinci select" deseni GET'e de
uygulandı.

**13 yeni saf motor testi + genişletilmiş e2e (iki test tanımlı adanmış
kritik hizmet: MANUEL_BEYAN ASTI → İNCELEME_GEREKLI, yalnız-ölçüm → NÖTR bilgi
metni) + mühürleme + anonim Proof Room'da aynı özet. 1623 birim + 19/19
hedefli Dikey F/paylaşılan-fixture e2e (iki temiz koşu); typecheck/lint/build
yeşil.** Dikey F (F1→F5.1) şu an açık bekleyen bir karar taşımıyor.

## -5. DİKEY F, F5 BİTTİ (21 Temmuz 2026) — Kurtarma Ölçümü ile Onaylı Etki
Toleransının Güvenli Karşılaştırılması

Kurucunun çok ayrıntılı "Kararlarım" mesajıyla (A-D + F5 artefakt kararları)
tam uygulandı; ADR `docs/adr/PR0-dikeyF-f5-kurtarma-karsilastirmasi-2026-07-21.md`.
**F2/F3 paketine BİLİNÇLİ SIZMADI** — kurucunun kararı gereği bu entegrasyon
ayrı bir gelecek dilim olan "Dikey F5.1"e bırakıldı.

**A) `impact_tolerances.superseded_at` forward-fix** (migration `20260721050000`):
NULL→timestamp tek yönlü geçiş, kendi `onay_zamani`sinden önce olamaz, yeni
sürümün `onay_zamani`'sı kapatılan sürümden önce olamaz, aktivasyonda sunucu
otomatik doldurur. **Bitemporal as-of** `impact_tolerance_asof(critical_service_
id, as_of)`: `onay_zamani <= as_of AND (superseded_at IS NULL OR as_of <
superseded_at)` (onay_zamani dahil, superseded_at hariç) — CANLI veri tek satır
olduğundan backfill NO-OP oldu (anomali yok, doğrulandı).

**D) `measured_at` yaşam döngüsü** (migration `20260721060000`): iki `NOT VALID`
CHECK — gelecek-zaman reddi + olay-zamanı-tutarlılığı (`hizmet_geri_geldi_at`
varsa `measured_at` ONA EŞİT olmalı). **Canlı veri bir GERÇEK açık doğruladı**
(motivasyon): bir satırda `measured_at` yanlışlıkla `recorded_at`'e eşitti çünkü
UI hiç göndermiyordu — route sessizce varsayılan atıyordu. Rota + `KurtarmaOlcumuBolumu`
düzeltildi: olay zamanları modunda `measured_at` OTOMATİK `hizmetGeriGeldiAt`'ten
türetilir (alan gizlenir); süre-beyanı modunda AÇIK VE ZORUNLU alan. Tek debris
satırı `NOT VALID` ile İSTİSNA edildi (immutable tablo — silinmedi/uydurulmadı).

**B) Merkezi "güncel kayıt" sözleşmesi** — `ORDER BY...LIMIT 1` ASLA kullanılmadı
("en yeni" ≠ "geçerli supersede yaprağı"). Dört-durumlu (`GUNCEL_KAYIT_VAR/
KAYIT_YOK/BIRDEN_FAZLA_GUNCEL_KAYIT/ZINCIR_HATASI`) SQL fonksiyonu İKİ kez
(migration `20260721070000`: `test_run_kurtarma_olcumu_guncel`; `20260721080000`:
`test_run_kurtarma_karsilastirmasi_guncel`) — F5 üçüncü bir kopya YAZMADI.

**F5 artefaktı** — yeni immutable tablo `test_run_recovery_comparisons`
(migration `20260721080000`): sabit FK'ler + tolerans eşikleri MÜHÜRLENİR
(yalnız FK değil — sonraki tolerans revizyonu geçmiş sonucu DEĞİŞTİRMEZ, canlı
smoke'ta uçtan uca kanıtlandı). RTO/RPO BAĞIMSIZ beş durum (`KARSILADI/ASTI/
OLCUM_YOK/TOLERANS_YOK/KARSILASTIRILAMAZ`). Güvenilirlik dili motor içinde
mühürlü `aciklama` metniyle taşınır (MANUEL_BEYAN: "beyan edilen değer...";
OTOMATIK_OLCUM: "ölçülen değer..." — asla çıplak "RTO/RPO karşılandı"). Ledger/
JWS durumu MATEMATİK SONUÇTAN AYRI bir boyut olarak gösterilir (henüz anchor
edilmemiş bir karşılaştırma GERÇEK sonucunu yine de gösterir + ayrı bütünlük
notu taşır). Cross-tenant + kritik-hizmet-bağlantısı guard'ı (`trrc_tenant_
guard`) YENİ bir guard sınıfı: test_run'ın `control_test_definitions`'ının,
karşılaştırılan kritik hizmete GERÇEKTEN (DIRECT veya VIA) bağlı olduğunu ayrıca
doğrular. Proof Room mevcut test_run dalına ilişkisel genişledi (migration
`20260721090000`, minimize — ham FK yok; altıncı hedef AÇILMADI).

**Uygulama sırasında bulunup düzeltilen GERÇEK açık (bug, F5 mantığından
bağımsız değil ama önemli):** ilk motor tasarımı `tolerance.durum !== 'YURURLUKTE'
→ KARSILASTIRILAMAZ` kontrolü yapıyordu — bu YANLIŞTI: bitemporal as-of eşleşmesi,
GEÇMİŞTE geçerli olan ama ŞU AN `durum='SUPERSEDED'` olan bir tolerans sürümünü
doğru biçimde döndürebilir. Kural düzeltildi: `!yonetimOnayi || onayZamani ===
null` ("gerçekten onaylanmış mıydı" — "şu an yürürlükte mi" değil). Kurucuya
AÇIKÇA bildirildi, motor + testler (yeni 7b testi) düzeltildi.

**DÖRDÜNCÜ + BEŞİNCİ "AYNI SINIF" fixture açığı** (tam regresyon SIRASINDA
yakalandı, F5 mantığından bağımsız): `test_run_recovery_comparisons`ın (yeni)
ve `kritik_hizmet_test_paketi_snapshots`ın (F2 borcu, şimdi ortaya çıktı)
`critical_service_id`/`test_run_id` alanları RESTRICT ama `setup-e2e-fixtures.
ts` temizlik listesinde HİÇ yoktu — toplu DELETE'i sessizce bloklayıp "E2E: MFA..."
+ "E2E Kritik Hizmet" birikmesine yol açıyordu (kontrol-test/legal-basis/
proof-room/sod patladı). İkisi de listeye doğru sırayla eklendi, iki temiz
koşuyla doğrulandı. **Ayrıca F5'ten TAMAMEN BAĞIMSIZ, önceden var olan 5 e2e
hatası** (bulut-pak/dikey-e1/dikey-e2/tedarikci-anket-sablonu/tedarikci-
degerlendirme) iki ayrı tam-suite koşusunda AYNI ŞEKİLDE tekrarlandı — muhtemelen
aynı sınıf bir başka fixture açığı, ayrı bir spawn_task ile işaretlendi, F5
kapsamına DAHİL EDİLMEDİ.

**18/18 hedefli Dikey F + paylaşılan-fixture regresyon grubu (iki temiz koşu)
+ 1610 birim + typecheck/lint/build yeşil.** Yeni e2e `e2e/kurtarma-
karsilastirmasi.spec.ts`: PASSED koşu → olay-zamanlı ölçüm → Karşılaştır →
RTO/RPO bağımsız "Karşıladı" rozetleri → dil doğru ("Beyan edilen", çıplak
"RTO/RPO karşılandı" YOK) → tolerans v2'ye geçse de DONMUŞ eski sonuç → anonim
Proof Room minimize görünüm. Yol boyunca ayrıca GERÇEK bir GET rotası hatası
bulundu: `/api/kontrol-test/run/[runId]/kurtarma-karsilastirmasi` GET, merkezi
RPC'nin düz özet satırını (`rto_sonucu` vb.) doğrudan `karsilastirma` olarak
dönüyordu — UI bileşeni iç içe `rto.aciklama` BEKLİYORDU (canlıda ilk tıklamada
crash). Proof Room'un zaten kullandığı "ikinci select ile mühürlü JSONB'yi çek"
deseni GET rotasına da uygulandı.

**Sıradaki (F5'in KENDİSİNDE bilinçli kapsam dışı, kurucu kararı bekliyor):**
Dikey F5.1 — F5'in F2/F3 Kritik Hizmet Test Paketi'ne İLİŞKİSEL bağlanması.

## -4. DİKEY F, F4 BİTTİ (21 Temmuz 2026) — Kurtarma Ölçümü Yakalama

**AÇIK NOKTA — deploy health (dürüstlük notu):** commit `231403a` main'e
push'landı; iki migration canlı Supabase'e uygulandı; 1554 birim + 79 e2e (iki
temiz koşu) + 15/15 canlı smoke + typecheck/lint/build YEŞİL. ANCAK
`wardproof.com` push'tan ~20 dk sonra hâlâ **Hostinger'ın kendi 503'ünü
(`server: hcdn`) döndürüyor** — Node konteyneri ayakta değil (yavaş yeniden-
build ya da paylaşımlı hostta build OOM/başarısızlığı; deploy log'una erişimimiz
yok). Yerel `pnpm run build` yeşil olduğundan kod tarafı sağlam; bu bir hosting
kaynak/deploy sorunu olabilir. **Canlı sağlık TARAFIMIZDAN doğrulanmadı** —
kurucu Hostinger deploy log'unu kontrol etmeli / gerekiyorsa yeniden deploy
tetiklemeli. `/health/live`,`/health/ready`,`/` üçü de 503.

Kurucunun "Kararlarım"ıyla (ADR `PR0-dikeyF-f4-kurtarma-olcumu-yakalama-2026-
07-21.md`) ayrı immutable tablo `test_run_recovery_measurements` (migration
`20260721030000`): koşuya bağlı ölçülen kesinti/veri-kaybı; ham olay zamanları
birincil, süreler SUNUCUDA türetilir (`generated always as stored` — istemci
yazamaz); süre-yalnız beyan ayrı ve etiketli. Güvenilirlik katmanı MANUEL_BEYAN
(form; beyan_eden auth.uid'e sabit) / OTOMATIK_OLCUM (yalnız service_role; DB
guard sahte yükseltmeyi reddeder). **KARŞILAŞTIRMA YOK, impact_tolerances
tüketilmez**, `comparisonPerformed:false`. İmmutable + supersede (lineer);
kanıt: canonicalHash→JWS→ledger outbox (RECOVERY_MEASUREMENT)→SCITT. Proof Room
mevcut test_run dalı ilişkisel genişledi (minimize, ham beyan_eden yok; altıncı
hedef AÇILMADI). UI `/controls/[id]` kontrol testi koşusunun altında "Kurtarma
Ölçümü" bölümü + "kullanıcı beyanıdır" uyarısı.

**17 saf + 17 PGlite/RLS + 1 Proof Room PGlite (regresyon) + 15/15 canlı smoke
+ 1 Chromium e2e; 1554 birim + 79 e2e, 0 skip; typecheck/lint/build yeşil.**
Tam suite koşusu ÜÇÜNCÜ kez aynı sınıf fixture açığı yakaladı (F4 mantığı
değil): yeni `test_run_recovery_measurements.test_run_id → test_runs ON DELETE
RESTRICT` `setup-e2e-fixtures.ts`'in test_runs cascade temizliğini blokluyordu;
tablo temizlik listesine `control_test_definitions`'tan ÖNCE eklendi (policy_
exceptions/SoD deseni). Kurtarma bölümü TEMBEL yüklendi (havuz baskısını önler).
`baslangic_at/bitis_at` semantiği (testin çalışma penceresi) kurtarma için
yanlış olduğu doğrulandı → ayrı alanlar. **Sıradaki (F4 dışı, kurucu kararı
bekliyor):** gerçek nicel karşılaştırma motoru (ölçüm ↔ impact_tolerances),
tier-farkında; yeterli ölçüm olgunluğu sonrası.

## -3. DİKEY F, F3 BİTTİ (21 Temmuz 2026) — Onaylı Etki Toleransının Görünürlüğü
Kurucunun "Seçenek A: sığ fakat dürüst bağlama" kararı tam uygulandı
(docs/adr/PR0-dikeyF-f3-etki-toleransi-gorunurlugu-2026-07-21.md). `impact_
tolerances` (M13, o güne dek HİÇ tüketilmiyordu — altıncı erteleme) F2 paketine
+ UI + Proof Room'a bağlandı. **NİCEL KARŞILAŞTIRMA YOK:** `test_runs`'ta
yapılandırılmış kesinti/veri-kaybı ÖLÇÜMÜ olmadığından "RTO/RPO karşılandı",
"tolerans içinde/aşıldı", yüzdesel başarı, güven skoru ASLA üretilmez;
`karsilastirmaYapildi` HER ZAMAN `false`. Saf motor geriye dönük genişletildi
(`impactTolerances?` opsiyonel — verilmezse F2 sonucu birebir aynı). Beş durum
sınıfı; birden fazla YURURLUKTE savunmacı ele alınır (rastgele seçim yok); NULL
≠ sıfır. Genel duruma etki: onaylı tolerans DOGRULANMIS tetiklemez, yokluğu
ENGELLENDI üretmez; yalnız onaysız/çakışma gerekçe ekler + DOGRULANMIS→
INCELEME_GEREKLI düşürür (ENGELLENDI iyileştirilmez). Şema V1→V2; V1 kayıtlar
değiştirilmez/yeniden hash'lenmez/backfill YOK. **Proof Room migration'ı
GEREKMEDİ** — özet mühürlü `paket`'in içine gömülü ve zaten minimize/PII'siz
(`onaylayanBelirtildi` boolean), beşinci dal olduğu gibi döndürür; altıncı dal
açılmadı. `valid_from/valid_until` `impact_tolerances`'ta YOK (kurucu taslağı
düzeltildi → `onay_zamani`/`durum`).

**17 yeni saf test + 5 yeni PGlite/RLS + 18/18 canlı smoke + 1 Chromium e2e;
1519 birim + 78 e2e, 0 skip; typecheck/lint/build yeşil.** Yol boyunca gerçek
ön-var regresyon (F3 değil): "Şifreyi göster" butonu `helpers.ts`'in
`getByLabel("Şifre")`'ini iki elemana çözüyordu — 17 iki-kullanıcı testi
`ikinciKullaniciGirisYap`'ta patladı; `getByRole("textbox")` ile daraltıldı.
**Sıradaki (F3'ün KENDİSİNDE kapsam dışı, kurucu kararı bekliyor):** gerçek
nicel RTO/RPO bağlama — önce `test_runs`'a ölçüm veri sözleşmesi kurulmalı,
karşılaştırma motoru ANCAK ondan sonra. Diğer açık dallar: M17 örnekleme
köprüsü, impact-graph genişlemesi, gerçek test-program orkestrasyonu.

**DEPLOY HEALTH DOĞRULANDI (çözüldü) — YENİ ALAN ADI: `wardproof.com`.**
Kurucu bildirdi: site adı artık `wardproof.com`. Önceki oturumdaki
`ECONNRESET` gizemi bununla ÇÖZÜLDÜ — eski `blue-yak-865668.hostingersite.com`
artık servis vermiyor, deploy custom alan adına taşındı. Commit `f65c9df` canlı
ve sağlıklı: `wardproof.com/health/live` → **200**, `/health/ready` → **200**,
`/` → **307 → /giris** (beklenen yönlendirme). **AÇIK NOKTA (F3 dışı):**
`www.wardproof.com` → **503/timeout** (apex çalışıyor, `www` varyantı DNS/
redirect config düzeltmesi bekliyor — ayrı iş). Tüm deploy sağlık kontrolleri
artık `wardproof.com` üzerinden yapılmalı (eski Hostinger geçici alan adı
DEĞİL).

## -2. DİKEY F, F2 BİTTİ (21 Temmuz 2026) — Kritik Hizmet Test Paketi
Kurucunun F2 kararları tam uygulandı: `kritik_hizmet_test_paketi_snapshots`
(UI adı: "Kritik Hizmet Test Paketi") — tek bir kritik hizmet için mevcut M12
zincirinin (test tanımı → koşu → öneri → bulgu → retest) mühürlü fotoğrafı.
`test_kampanyasi_snapshots` adı BİLİNÇLİ kullanılmadı (M8 simülasyon/tatbikat
diliyle karışma riski, kurucu kararı). Kapsam çözümleme İKİ güvenilir
kaynaktan: `control_test_definitions.critical_service_id` (DOĞRUDAN) +
`critical_service_controls` (DOLAYLI/kontrol üzerinden), deterministik
birleşim (aynı tanım iki yoldan gelirse `BOTH`, tekilleşir — `kritik_hizmet_
adi` serbest metninden ASLA otomatik eşleştirme yok). Paket iki katman
taşır: güncel görünüm (en son koşu, worst-of yalnız buradan) + tarihsel iz
özeti (yalnız sayaç/kimlik listeleri — tam geçmiş kopyalanmaz, hiçbir sonuç
silinmez/örtülmez). `genelDurum` beş ayrı sınıf (DOGRULANMIS/INCELEME_
GEREKLI/ENGELLENDI/VERI_EKSIK/TEST_YOK) — sayısal güven skoru yok.

Tablo `impact_graph_snapshots`/`cloud_assurance_profile_snapshots`'ın AYNI
deseni: append-only, maker-checker YOK (yeni bir uyum iddiası değil, zaten
guard'lı verilerin fotoğrafı), service_role dahil UPDATE koşulsuz reddedilir.
Proof Room BEŞİNCİ polimorfik hedef (`kritik_hizmet_test_paketi_snapshot_id`)
— `proof_room_link_target_guard()` ve `proof_room_goruntule()` forward-fix'i
GÜNCEL sürüm temel alınarak yapıldı, diğer dört dal DEĞİŞMEDİ. UI:
`/kritik-hizmetler/[id]`'de "Test Paketi Önizle"/"Mühürlü Paket Oluştur" +
geçmiş listesi; Proof Room sayfası beşinci dalı render ediyor.

**17 saf motor testi + 8 PGlite/RLS testi (snapshot tablosu) + 4 PGlite testi
(Proof Room 5. dal) + 27/27 canlı Supabase smoke + 1 yeni Chromium e2e; 1495
birim + 77 e2e, 0 skip.** Bu dilimde bulunan tek e2e
hatası kendi hatamızdı (yeni test, ürün kodu değil): "Mühürlü Paket Oluştur"
sonrası "Proof Room Linki Oluştur" `.first()` ile tıklanıyordu — biriken eski
snapshot satırları varken bu YANLIŞ (eski) satırı seçebiliyordu; POST
yanıtının kendi `id`'siyle eşleşen `data-testid`'e scope'lanarak düzeltildi
(Faz B'nin "gerçek POST yanıtını bekle, metin görünürlüğüne güvenme" dersinin
aynısı). Sonraki: F1'deki gibi F1/F2'nin KENDİSİNDE kapsam dışı bırakılanlar
(test-program orkestrasyonu, çoklu kritik hizmet kampanyası, M17 köprüsü,
RTO/RPO bağlama, impact-graph genişlemesi) kurucu kararı bekliyor.

## -1. DİKEY F, F1 BİTTİ (21 Temmuz 2026)
Kurucunun F1 talimatı (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-
retest-2026-07-20.md) tam uygulandı: `control_test_definitions` → kritik
hizmet/senaryo GERÇEK referansı (tenant guard'lı, serbest metin korunur);
`finding_verified_closure_guard` forward-fix (öneriyi kabul eden kendi
bulgusunu kapatamaz); `test_runs.retest_of_finding_id` (retest NİYETİ, bulgunun
kapanış kaydından AYRI); manifest V3 (`findingId` asla yazılmaz — ilişki hep
sorgudan); impact-graph `BULGU_RETEST` kenarı (gerçek route'a kablolu); Proof
Room hem RPC hem SAYFA (`/proof/[token]`) yeni alanları gösteriyor; UI
seçiciler + zincir görünümü `/controls/[id]`'de. **31/31 canlı Supabase smoke +
1 Chromium e2e (kontrol-test-f1.spec.ts) + 24 yeni PGlite testi.**

Yol boyunca bulunup düzeltilen İKİ gerçek açık (F1'in KENDİSİ değil, ama tam
e2e suite koşusu SAYESİNDE ortaya çıktı):
1. `scripts/setup-e2e-fixtures.ts` `policy_exceptions` tablosunu hiç
   temizlemiyordu (`on delete restrict` → `control_test_definitions` reset'i
   sessizce başarısız oluyor, aynı isimli tanım birikiyordu).
2. `test_runs.retest_of_finding_id` (`on delete set null`) `test_run_
   immutable()` ile çatışıyordu: bir bulgu silinince Postgres'in kendi FK-
   cascade UPDATE'i bile reddediliyor, ilişkili koşu BİR DAHA ASLA
   silinemiyordu. Forward-fix (`20260720340000`) yalnız bu tek-alan
   null'lamayı serbest bırakıyor.
İkisi de düzeltildi + regresyon testleriyle kilitlendi; ayrıca `kontrol-
test.spec.ts`'in kendi `.eq("tur","MANUAL_PROCEDURE").single()` sorgusu
(legal-basis.spec.ts/proof-room.spec.ts'te zaten `ad` ile düzeltilmişti, bu
dosya unutulmuştu) aynı desenle düzeltildi.

**Sıradaki:** F2 (test-program/campaign tablosu — kurucu kararı bekliyor),
M17 audit_samples↔SAMPLE_REVIEW bridge, RTO/RPO/impact_tolerances bağlama —
hepsi F1'de BİLİNÇLİ kapsam dışı bırakıldı (docs/adr/PR0-dikeyF-f1-...'de §10).

## 0. İLK İŞ (her yeni oturumun başında)
Yeşil taban doğrula (körlemesine güvenme):
```
pnpm check        # typecheck + lint + vitest  (beklenen: ~1495 birim, 0 skip)
pnpm e2e          # gerçek Chromium            (beklenen: ~77 e2e, 0 skip, fixture reset dahil)
cmd /c "pnpm build 2>&1"   # exit 0
curl.exe -s https://blue-yak-865668.hostingersite.com/health/ready  # hazir/erisilebilir
```
Bu üçlü 21 Temmuz Dikey F F1 oturumunda TAM koşuldu (1465/1465 birim; `pnpm e2e`
5 tam koşu içinde 2 kez tastamam 76/76 temiz, arada çıkan 2 tekil başarısızlık
(tema.spec.ts, tedarikci-signoff-ledger.spec.ts — F1 ile İLGİSİZ modüller)
izole 3x tekrar koşusunda temiz çıktı — genel suite'in ortam gürültüsü,
regresyon değil). **`pnpm e2e` KULLAN, çıplak `playwright test` DEĞİL** —
fixture reset olmadan partial/tekrarlı koşular birbirinin DB durumunu kirletip
sahte başarısızlık üretir (bu bir ürün hatası değildi, 20 Temmuz oturumunda
tekrar keşfedildi). Kırmızı çıkarsa önce onu düzelt.

## 0b. BLOKAJ ÇÖZÜLDÜ (kayıt için)
Gece oturumundaki izin blokajı kurucu onayıyla ("izin verdim") aşıldı:
6 migration canlıda (`...150000`→`...190000`), db:types tazelendi, canlı
yazma smoke'u 21/21 geçti (geçici script silindi), tüm commit'ler push'landı,
deploy health `hazir`. Devreden blokaj YOK.

## 0a2. KALICI ONAY (19 Temmuz) — GECE OTONOM MODU
Kurucu: **"sabaha kadar çalış, ben hepsine devam diyorum."** → nihai §8 gate
sırasında (G5/G6/G7/G8...) duraksamadan, her gate'i bağımsız çalışan dikey
olarak teslim et: migration+RLS+guard+birim+RLS testi+gerçek Chromium e2e+
build+canlı guard smoke+deploy health, commit+push. Kurucu kararı gerektiren
şeyleri (JWS/TSA/connector pilot stack/AI sağlayıcı/dış lisans/G1 içerik)
UYDURMA — adapter/OPEN_DECISION + interface ile ilerle, dış gönderim/gerçek
para/credential yapma. Her gate sonunda §15 raporu.

## 0a3. NİHAİ TALİMAT v3.2 (19 Temmuz, "CLAUDE_CODE_KALKAN_OS_NIHAI_TEK_TALIMAT.md")
Kurucu yeni bir sürüm (3.2) yükledi ve "bu talimatlara göre devam et" dedi —
**tek bağlayıcı kurucu talimat budur** (çelişki sırası: güvenlik/bütünlük
invaryantları > repo ADR+testler > bu talimat > diğer belgeler). Milestone
numaraları DEĞİŞMEDİ. §8.0 "Güncel devam mandası" TEK sıradaki dikeyi net
tanımlıyordu: **gerçek domain artefaktlarının transactional outbox ile SCITT
şeffaflık defterine OTOMATİK+idempotent bağlanması** (receipt Proof Room +
offline verifier zincirine taşınmış). **BU DİKEY BİTTİ** (commit `7c548e6`,
aşağıda). §8.0 sonu, bu dikeyden SONRAKİ öncelik sırasını da veriyor (aşağıda
"Sonraki" altında).

## 0a4. NİHAİ TALİMAT v3.3 (19 Temmuz, "CLAUDE_CODE_KALKAN_OS_NIHAI_TEK_TALIMAT.md")
Kurucu sürüm 3.3'ü yükledi ("bu talimatlara göre devam et") — **tek bağlayıcı
talimat budur.** §8.0 artık BEŞ DİKEYLİK bir sıra veriyor (tez bulgularının
ürünleştirilmesi). Milestone numaraları değişmedi; KALKAN_OS tek başına çalışır
(başka proje/simülasyon motoruna çalışma-zamanı bağımlılığı YOK). Sıra:
1. **G3 ledger kapsamını tamamlama** (M35 sign-off/kritik kapanış, M37 olay
   kapanış/eval karar, M40 board attestation) — **BİTTİ** (`5df9176`, §1.42).
2. **M12 standart test/tatbikat manifesti** (immutable V2 snapshot: amaç/kapsam/
   hedef/senaryo sürümü/başlangıç-bitiş/beklenen-gerçek/FP-FN/log hash/hazırlayan-
   onaylayan; hazırlayan≠onaylayan guard) — **BİTTİ** (`e73fd20`, §1.43). Sonraki
   dilim: manifeste bulgu/retest referansı + tatbikat (simülasyon) koşularına V2.
3. **M35 Cloud & Critical Third-Party Assurance Pack** (11 bulut alanı + kaynak
   künyesi + VERIFIED disiplini kural 6; içerik uydurulmaz) — **BİTTİ** (`15831b9`,
   §1.44). Sonraki dilim: madde bazlı applicability UI + pak önizleme/paylaşım.
4. **M37 AI veri/model güvence genişlemesi** (soyağacına lisans/izin/sürüm/hash+
   sentetik oran+poisoning[BİLİNMİYOR default]+label-noise; drift izleme eşik-
   KAYNAĞI zorunlu — koda gömülmez) — **BİTTİ** (`91efb68`, §1.45). Bilinçli
   sonraki dilim: segment sonuç, override gerekçe, rollback/son test, ISO
   42001↔27001 crosswalk (kaynak+VERIFIED disiplini). Ham veri LLM'e gitmez.
5. M21/M42 dayanıklılık taksonomisi (8 üst alan, THESIS_DERIVED/TODO_DOGRULA,
   VERIFIED seed YOK) + etki grafiği (tek hata noktası/zincirleme etki/en çok
   etkileyen kontrol/tedarikçi yoğunlaşması/en yüksek iyileştirme — tek sahte skor YOK).

## 0c. GERÇEK DURUM (20 Temmuz — Dikey E2 + Dikey E1 + Dikey B Faz 1-4 + Dikey D ilk dilim + Kullanıcı Kılavuzu TAMAM)
- **20 Temmuz ONİKİNCİ talimatı: Dikey E, E2 — Telafi Edici Kontrol + Proof
  Room Tenant Bütünlüğü TAMAM (ROADMAP §1.68, tam detay orada).** İKİ SIRALI
  KAPI: Kapı 1 (`280199c`, önceki oturumda push'landı) Proof Room'un ÜÇ ESKİ
  dalındaki (test_run_id/roi_export_run_id/graph_snapshot_id) hiç var
  olmayan cross-tenant guard'ını TEK merkezi `proof_room_link_target_guard()`
  ile kapattı — canlı tarihsel tarama sıfır kirlenme buldu. Kapı 2
  (`20260720290000`) `assessment_finding_compensating_controls` — YENİ test
  altyapısı yok (M12 kontrol-test motoru yeniden kullanılır), SoD'nin
  `sod_telafi_edici_kontroller`'inin DOĞRUDAN kopyası DEĞİL (burada telafi
  KAYDININ KENDİSİ de maker-checker'lı: submitted_by≠reviewed_by zorunlu).
  Saf motor (`cloud-assurance.ts` @1→@2, geriye dönük uyumlu):
  `telafiAktifMi` DB'nin dondurulmuş AKTIF etiketine kör güvenmez, `asOf`
  itibarıyla PASSED+kanıt-güncel+geçerlilik-penceresi kendisi hesaplar.
  **Bulgu HİÇBİR ZAMAN telafiyle kapanmaz** — tüm açık KRİTİK bulgular
  kapsanınca `genelDurum` yeni `KRITIK_BULGU_TELAFI_ALTINDA` değerine döner
  (`acikKritikBulgular`'da hâlâ görünür), kısmi kapsama ENGELLENDI'de tutar.
  Sign-off: `assessment_tamamla_guard()` DEĞİŞTİRİLMEDİ (dar hesaplanmış
  etiket tercih edildi, blast-radius sıfır). Impact graph: yeni düğüm türü
  YOK, mevcut KONTROL düğümüne tek yeni kenar türü. Proof Room'a asgari
  `telafiOzetleri` (kontrol referansı + geçerlilik bitişi, ham veri YOK).
  API: `/api/tedarikciler/[id]/bulgular/[findingId]/telafi` (öner+gönder),
  `/api/telafi/[id]/karar`, `/api/telafi/[id]/iptal` — hepsi session client,
  kimlik atfı istemciden GÜVENİLMEZ. UI `/tedarikciler/[id]`'de her açık
  KRİTİK/YÜKSEK bulgu satırında telafi bloğu. **Süre-dolumu (SURESI_DOLDU)
  geçişi BİLİNÇLİ OLARAK yalnız PGlite'ta test edildi** — canlı paylaşımlı
  tabloda güvenlik trigger'ını geçici devre dışı bırakmak gerekirdi,
  kurucuya AskUserQuestion ile soruldu, "canlı trigger'a dokunma" seçildi.
  25 PGlite + 16+3 saf motor birim + canlı smoke (16 kontrol, iki gerçek
  kullanıcı oturumu) + yeni `e2e/dikey-e2-telafi-edici-kontrol.spec.ts`
  (2 senaryo). **`pnpm e2e` (fixture reset dahil) 73/75, 0 skip** — 2 kalan
  başarısızlık bu dilimle İLGİSİZ (simulasyon.spec.ts M18 + tedarikciler.
  spec.ts vendor-portal, ikisi de AYNI sınıf ön-var olan okuma-yarışı, koda
  dokunulmadı, ayrı borç). 1442 birim (127 dosya) + 75 e2e; build yeşil.
- **20 Temmuz ONBİRİNCİ talimatı: Dikey E, E1 — Bulut/Kritik Tedarikçi Güvence
  Profili TAMAM (ROADMAP §1.67).** **İSİM ÇAKIŞMASI UYARISI (kayıt için
  önemli):** `docs/GAP_MAP_37_TEZ.md`'deki "Dikey E" (KOS-5, AI Governance
  Board — hâlâ YAPILMADI) ile BU dilim ("Dikey E1", kurucunun ayrı/yeni
  talimatı) FARKLI şeylerdir — aynı harf, iki bağımsız dikey sıralaması.
  Gap Map'e DOKUNULMADI (bu dilim hiçbir KOS maddesine karşılık gelmiyor).
  Detay ROADMAP §1.67'de tam. Özet: `kaynak_turu` epistemik kolonu (8 değer,
  default UNKNOWN, kaynak_turu≠dogrulama_durumu AYRI boyut) +
  `assessment_finding_guard` bağımsız-kapanış forward-fix'i (sahibi kendi
  bulgusunu kapatamaz) + TEK yeni tablo `cloud_assurance_profile_snapshots`
  (mühürlü, immutable, `impact_graph_snapshots`'ın AYNI deseni) + saf motor
  `src/lib/cloud-assurance.ts` (zorunlu kategori listesi UYDURULMADI,
  worst-of) + `impact-graph.ts`'e opsiyonel `tedarikciBulgulari` (backward-
  compat korunuyor, 20 birim regresyon dahil) + Proof Room 4. dal.
  **Bulunan gerçek boşluk kapatıldı:** `proof_room_links`'in üç eski dalında
  hiç var olmayan cross-tenant FK-hedef guard'ı, yalnız yeni 4. dal için dar
  kapsamda eklendi. **Bulunan iki gerçek yan-hata düzeltildi:** şablon→soru
  kopyalama `kaynak_turu`/`template_id` taşımıyordu; mevcut bulgu-kapatma
  UI'ı hiç `sahibi` atamıyordu (yeni guard'la MEVCUT akış kırılırdı — UI'a
  zorunlu sahip seçici eklenerek önlendi, canlıya gitmeden yakalandı).
  UI ilk kez Cloud Pack'i `/tedarikciler/[id]`'de görünür/kullanılabilir
  yaptı + güvence profili kartı (mühürleme + Proof Room bağlantısı) +
  `/proof/[token]` 4. dal render'ı. **32 PGlite + 16 saf motor + 20 impact-
  graph birim + canlı smoke (17 kontrol) + yeni `dikey-e1-cloud-assurance.
  spec.ts` (uçtan uca, bağımsız kapanış dahil).** Test koşusu sırasında
  DÖRT test (bulut-pak/kontrol-test-manifest/kontrol-test/tema) tam takımda
  başarısız oldu, izole+temiz-ortam koşusunda hepsi yeşil — kök neden
  KENDİ arka-plan test koşularımın birikmiş node/chrome process yükü
  (bir chrome process ~8000 CPU-saniyesi biriktirmişti), kod DEĞİL; ayrıca
  `simulasyon.spec.ts`'in M18 bağı testi bu dilimle dosya-düzeyinde İLGİSİZ
  ve tekrarlanabilir başarısız — koda DOKUNULMADI, ayrı borç olarak kayıtlı.
  **TAM e2e takımı temiz ortamda 73/73, 0 skip. 1369 birim (125 dosya) + 73
  e2e; build yeşil.** Bilinçli kapsam dışı: telafi edici kontrol (E2), RTO/
  RPO zinciri, sözleşme-düzeyi graf granülerliği, dördüncü-taraf değişiklik
  bildirimi, SCITT/KMS/JWS/TSA/AI-hukuk-sağlayıcı seçimi.
- **20 Temmuz ONUNCU talimatı: Kullanıcı Kılavuzu / Yardım Merkezi TAMAM
  (§1.66).** Teknik olmayan kurum çalışanı için Türkçe kılavuz + bağlama
  duyarlı yardım paneli — ürün mimarisi DEĞİŞMEDİ. İçerik `src/lib/yardim-
  icerik.ts`'te TEK kaynak (kurucunun anlatım şablonu birebir, route'lar
  `nav-items.ts`'ten doğrulandı — uydurulmuş route yok). 3 yeni sayfa
  (`/yardim`, `/yardim/hizli-baslangic`, `/yardim/sozluk`) + 13 modül
  sayfasına `EkranYardimPaneli` (native `<details>`, JS'siz klavye erişimi).
  **Gerçek erişilebilirlik açığı bulundu ve düzeltildi:** `CardTitle` bu
  kod tabanında semantik olmayan bir `<div>`dir — kılavuzun ~20 bölümü ekran
  okuyucu başlık gezinmesine hiç girmiyordu; `<h2 className="contents">`
  ile (yalnız yeni sayfalarda, paylaşılan bileşene dokunmadan) düzeltildi.
  Yeni `e2e/yardim.spec.ts` (8 senaryo) + `erisilebilirlik.spec.ts`'e
  `/yardim`+`/yardim/sozluk` eklendi (axe AA sıfır ihlal, light+dark).
  **TAM e2e takımı 72/72, 0 skip.** 1318 birim (bu dilim DB/motor kodu
  içermiyor, sayı değişmedi) + 72 e2e; build yeşil.
- **20 Temmuz SEKİZİNCİ talimatı: Dikey D ilk dilim TAMAM (§1.65) —
  Kurumsal Dayanıklılık ve Kritik Hizmet Bağımlılık Grafiği.** Grep sweep
  gerçek boşluğu KÜÇÜLTTÜ: Dikey 5 zaten kritik-hizmet grafının çoğunu
  inşa etmişti — yeni bir "graf DB'si" KURULMADI, `src/lib/impact-graph.ts`
  (YENİ saf motor) 9 dağınık kenar kaynağını (`critical_business_services`/
  `service_dependencies`/`third_parties`/`fourth_parties`/`ict_service_
  types`/`controls`/`obligations`/`control_test_definitions`/`findings`/
  `evidences`) TEK bir kanonik düğüm/kenar projeksiyonuna birleştirdi.
  `tekilNoktaAnalizi` (M13) ve `konsantrasyonAnalizi` (M35) TEKRARLANMADI —
  `tekNoktaTespitiTamGraf` ilkelerini TEK bir BFS ile tüm düğüm türlerine
  (çok-atlamalı dahil) genelleştirdi; `etkiYayilimi` açık kritik/yüksek
  bulgulu kontrollerden otomatik başlayan çok-atlamalı yayılım hesaplar
  (geri: etkilenen kritik hizmet/mevzuat; ileri: kanıt/test zinciri).
  **Bulunup düzeltilen gerçek hata (unit testte yakalandı, canlıya gitmeden):**
  BAGIMLILIK düğümleri ilk taslakta satır id'siyle kimliklendiriliyordu —
  aynı fiziksel bağımlılığı (ör. "Ana Veri Merkezi") paylaşan iki kritik
  hizmetin iki AYRI satırı iki AYRI düğüme dönüşüp SPOF tespitinin asıl
  amacını kırıyordu; düğüm kimliği normalize ada çevrildi (`tekilNoktaAnalizi`
  M13 kuralı). Mühürlü artefakt `impact_graph_snapshots` (`20260720200000`)
  — maker-checker YOK (uyum iddiası değil, deterministik hesaplama fotoğrafı),
  **immutable by design** (UPDATE trigger'ı service_role dahil her zaman
  reddeder — `test_runs`'ın 20260717230001 dersi). Proof Room üçüncü dal
  (`20260720210000`, GÜNCEL `proof_room_goruntule` — `20260720180000` —
  temel alındı, Faz 4 dersi bir kez daha uygulandı). "AI sonucu kesin gerçek
  DEĞİLDİR" kuralı her sonuçta `hesaplamaYontemi` ile ayrı gösterildi.
  `/dayaniklilik` + `/proof/[token]` UI'ı, 17 birim + 13 PGlite testi +
  gerçek oturumlu canlı smoke + yeni Chromium e2e (SPOF+Proof Room) yeşil.
  **TAM e2e takımı (64 spec) — yalnız `tema.spec.ts` tam takımda tek seferlik
  zamanlama flake'i gösterdi, izole koşuda yeşil (bu dikeyle İLGİSİZ).**
  **1318 birim (123 dosya) + 64 e2e; build yeşil.** Sıradaki adım kurucu
  kararını bekliyor: Dikey D sonraki dilim (süreç/varlık/uygulama ayrı
  düğüm tipleri, RTO/RPO-gerçek-test farkı) ya da başka bir dikey.
- **20 Temmuz YEDİNCİ talimatı: Dikey B Faz 4 TAMAM (§1.64) — DORA RoI export
  alanları için kanıt zinciri (provenance).** Yeni ilişkisel model YOK
  (talimatın kendi kısıtı) — export ÜRETİLİRKEN saf motor (`src/lib/roi-
  export-provenance.ts`) mevcut ÜÇ kaynaktan (`roi_kaynak_kayitlari`/
  `ict_service_types`/`assurance_claims`, `iddiaGosterimDurumuHesapla`
  REUSE) bir provenance raporu hesaplar, `paket`le AYNI anda `provenance_
  raporu`/`provenance_hash` olarak mühürlenir (worst-of birleşim — kanıtsız
  alan asla VERIFIED gösterilemez, yapısal garanti). SCITT deftere
  `ROI_EXPORT_PUBLISHED` olarak bağlandı (mevcut `ledger_outbox` deseni
  GENİŞLETİLDİ, yeni entegrasyon yolu yok); reconciliation cron kaynak
  sonradan düşerse export'u işaretler (durum geriye dönük değişmez). Proof
  Room'a minimize provenance özeti (`{alanKodu, kaynakDurumu, genelDurum,
  iddiaSayisi}`, ham iddia metni YOK) + ledgerDurumu eklendi.
  **Bu turda İKİ gerçek hata bulundu ve düzeltildi (PGlite'ta, canlıya
  gitmeden):** (1) `roi_export_run_guard()`'ın terminal-durum bloğu
  reconciliation cron'un `yeniden_inceleme_*` yazmasını da engelliyordu —
  istisna eklendi (yalnız o iki alan, kaçış yolu yok); (2) reconciliation
  cron'un ilk taslağında `uuid`/`text` örtük karşılaştırması (42883) ve
  tırnaksız/tırnaklı `jsonb_to_recordset` alias uyuşmazlığı (42703) vardı —
  **cron'un exception-yutan try/catch'i bunu PGlite testinde SESSİZCE
  yutuyordu, testler "hata yok" görüp "iş yapıldı" sanıyordu** — exception-
  yutmasız bir debug kopyasıyla gerçek hatalar bulundu, forward-fix (henüz
  push edilmeden, `20260720190000` içinde) düzeltildi. Gerçek oturumlu canlı
  smoke 10/10 (mühürleme, guard kilidi, maker-checker, SCITT enqueue+
  ANCHORED drenaj, terminal istisna, reconciliation, Proof Room minimize
  projeksiyon) — service_role ile İLK smoke denemesi `ledger_outbox_claim`in
  `current_tenant_id()`e dayandığını unutup boş döndü, gerçek e2e kullanıcı
  oturumlarıyla düzeltildi (kontrol-test rotasının AYNI deseni). **TAM e2e
  takımı (63 spec, 0 skip) sıfır flake ile koştu. 1288 birim (121 dosya,
  +24) + 63 e2e, 0 skip; build yeşil.** **37 Tez Dikey B (Faz 1-4) TAM.**
- **20 Temmuz ALTINCI talimatı: Dikey B Faz 3'ün KALANI TAMAM (§1.63) —
  DORA RoI export motoru artık UÇTAN UCA çalışır durumda** (veri modeli →
  export üretimi → maker-checker onay → CSV/XLSX indirme → Proof Room
  paylaşımı). Gerçek HTTP (`page.request`) + gerçek UI tıklama + gerçek
  Supabase e2e (`e2e/dora-roi-export.spec.ts`). **Bu turda İKİ gerçek hata
  bulundu ve düzeltildi:** (1) oturumsuz-erişim testi yanlış katmanı
  hedefliyordu (proxy.ts 307'ye düşürüyor, rota kodu hiç çalışmıyor —
  savunma zaten var, test düzeltildi); (2) **`proof_room_goruntule` RPC'sini
  genişletirken önceki bir forward-fix'in (`ledgerDurumu` alanı,
  20260719120000) İLK sürümü temel alınarak FARKINDA OLMADAN geri alınması**
  — TAM e2e takımı koşusu (63 spec) bunu yakaladı (`proof-room.spec.ts`,
  bu dikeyle ilgisiz mevcut bir test kırıldı), forward-fix `20260720160000`
  ile düzeltildi. **Ders: bir fonksiyonu CREATE OR REPLACE ederken TÜM
  dokunan migration'ları grep'lemek şart** — bugünün asıl dersiyle (dört-göz
  INSERT-bypass) aynı kategoride farklı bir hata sınıfı.
  CSV/XLSX serileştirme YENİ BAĞIMLILIK EKLEMEDEN yapıldı (jszip zaten
  vardı, minimal OOXML elle yazıldı). **TAM e2e takımı (63 spec) sıfır
  flake ile geçti — bu koşu iki hatayı da yakalayan koşuydu.**
- **20 Temmuz DÖRDÜNCÜ talimatı: Dikey B Faz 3 ilk dilim TAMAM (§1.62) — DORA
  RoI Export Motoru.** Saf motor (`src/lib/roi-export.ts`) + `roi_export_runs`
  (sealed snapshot + maker-checker yayın onayı + export-öncesi-engelleme) +
  Proof Room şema genişletmesi + iki API rotası. UI YOK, `/api/proof-room`
  RPC'si roi_export_run_id'yi henüz kabul etmiyor (bilinçli, sonraki dilim).
  **API rota katmanı yalnız typecheck/lint ile doğrulandı** (tarayıcı aracı
  oturum açma adımında yanıt vermedi) — altındaki DB katmanı ve saf motor
  ayrı ayrı canlı/PGlite ile tam doğrulandı, rotalar ince sarmalayıcı.
- **PARALEL OTURUM NOTU (dürüstçe, önemli):** bu dikeyin guard'ını yazarken
  `sod_import_rollbacklari`'nda AYNI SINIF bir dört-göz INSERT-bypass'ı
  bulundu (guard yalnız `before update`, INSERT hiç kontrol edilmiyordu).
  `spawn_task` ile AYRI bir arka plan görevine devredildi (bu dikeyin
  kapsamı dışı). O görev BU OTURUM SÜRERKEN, AYNI git çalışma dizininde
  (izole worktree DEĞİL) bağımsız çalıştı ve `dd8596d`/`89c6c5d` commit'lerini
  DOĞRUDAN `origin/main`'e push etti — benim kendi commit'lerimden ÖNCE.
  Çakışma OLMADI (git geçmişi lineer birleşti, `git status` "up to date"
  gösterdi), ama bu iki ajan oturumunun AYNI repo+AYNI canlı Supabase'e
  eşzamanlı yazdığı anlamına geliyor — ileride benzer bir durumda dikkatli
  olunmalı (örn. iki migration'ın çakışan timestamp'i, ya da bir db:push'un
  diğerinin şemasını yarım görmesi riski; bu seferinde gerçekleşmedi).
- **20 Temmuz ÜÇÜNCÜ talimatı: Dikey B Faz 2'nin KALANI TAMAM (§1.61).**
  `third_parties`/`third_party_contracts`/`fourth_parties`/`tenant_legal_
  identity` RoI alanlarıyla GENİŞLETİLDİ (yeni tablo ailesi yok, ADR
  `docs/adr/PR0-37-tez-dikeyB-faz2-kalan-2026-07-20.md`). `third_party_
  contracts.ict_hizmet_turu_kod` artık `ict_service_types` kataloğuna GERÇEK
  FK. Açık mapping tablosu `third_party_contract_critical_services`
  `third_parties.tier`'ı DORA fonksiyon-kritikliğinden KESİN AYRIK tutuyor
  (talimatın kendi kırmızı çizgisi). Bu dilimde YENİ bir dört-göz guard'ı
  YOK (dürüst gerekçe: eklenen alanların hiçbiri yeni regülasyon iddiası
  taşımıyor) — dolayısıyla INSERT-bypass sınıfı hatanın tekrarlanma riski
  yapısal olarak yok. 12 yeni PGlite testi + canlı smoke (6 adım), 0
  regresyon. **1220 birim (118 dosya) + 62 e2e, 0 skip; build yeşil.**
- **20 Temmuz İKİNCİ talimatı: Dikey C bitti, artık TEK ÖNCELİK Dikey B'nin
  DORA RoI export dilimi (§1.60).** 5 faz: hukuk/kaynak kilidi → veri modeli
  → export motoru → kanıt zinciri → kurumsal arayüz. ML-eval'e özgü dar
  kapsam + ileri AI özellikleri BEKLETİLDİ. ADR `docs/adr/PR0-37-tez-dikeyB-
  export-2026-07-20.md`: kurucunun yeni Dikey D-H sıralaması Gap Map'in
  MEVCUT harfleriyle çakışıyor — harfler KORUNDU, kurucunun sırası KOS
  referanslarıyla takip ediliyor.
- **Faz 1 (3. EUR-Lex geçişi) + Faz 2 ilk dilim (`ict_service_types`, S01-S19
  kataloğu) TAMAM (§1.60).** Bu sırada **SİSTEMİK bir dört-göz INSERT-anı
  bypass'ı** bulundu: BEŞ tablo (obligations/obligation_control_mappings,
  roi_kaynak_kayitlari, assurance_claims, control_resilience_domains,
  iso_42001_27001_crosswalk) TEK KİŞİNİN bir kaydı doğrudan LEGAL_REVIEW
  olarak (incelemeye_alan NULL) insert edip sonra kendini dogrulayan yaparak
  VERIFIED'e taşımasına izin veriyordu (NULL eşitliği guard'ı atlatıyordu).
  Forward-fix migration `20260720110000` beş fonksiyonu da düzeltti; 5 PGlite
  dosyasına regresyon testi + yeni `rls-ict-service-types.test.ts` (14 test)
  eklendi; canlı smoke iki ayrı tabloda (ict_service_types + obligations)
  düzeltmeyi kanıtladı. **BU BULGU KAYITLI TUTULMALI** — dört-göz mekanizması
  kural 14'ün (bulgu kapanışı) ve tüm ürünün güven temelidir.
- **20 Temmuz İLK talimatı: Dikey C (Model/Compliance Claim Guard) TAMAM (§1.59).**
  Genel amaçlı iddia güvencesi (`assurance_claims` + `src/lib/claim-guard.ts`
  + `/guvence`) — kaynak+kanıt+GERÇEK dört-göz+staleness+çatışma görünürlüğü.
  **Canlı geliştirme sırasında yakalanan bug (dürüstçe kayıtlı):**
  `assurance_claims`'in ilk taslağı VE dünkü `roi_kaynak_kayitlari` (§1.58)
  ikisi de `obligations`'ın ESKİ (tek-kişili) dört-göz sürümünü kopyalamıştı;
  kendi PGlite testleri yakaladı, ikisi de düzeltildi (`roi_kaynak_kayitlari`
  için forward-fix migration `20260720000001` — şiplenmiş migration
  DEĞİŞTİRİLMEDİ). Detay ROADMAP §1.59, ADR `docs/adr/PR0-37-tez-dikeyC-
  claim-guard-2026-07-20.md`. Gap Map KOS-7 satırı güncellendi: genel guard
  VAR, ML-eval'e özgü dar kapsam (manifest+11 guard kuralı) hâlâ YOK —
  dürüstçe ayrı bırakıldı.
- **Öncesi (19 Temmuz):** `docs/arastirma/KALKAN_OS_37_Tez_Nihai_Uygulama_
  Talimati_2026.md` kabul edildi (ADR `docs/adr/PR0-37-tez-kesif-2026-07-19.
  md` + envanter `docs/GAP_MAP_37_TEZ.md` — KOS-1..11, ölçülmüş durumlar).
  Dikey A BİTTİ (§1.56). Dikey B'nin KEŞİF adımı (§1.57) + İLK MİGRATİON
  DİLİMİ (§1.58 — `tenant_legal_identity` + `roi_kaynak_kayitlari`, İÇERİK
  SEED'İ YOK) BİTTİ.
- **BİR SONRAKİ OTURUM ÖNCE `docs/GAP_MAP_37_TEZ.md` + `docs/adr/PR0-dikeyD-
  dayaniklilik-etki-grafi-2026-07-20.md` OKUMALI** — kurucunun 20 Temmuz
  sekizinci talimatı Dikey D'nin ilk dilimini TAMAMEN BİTİRDİ (§1.65):
  birleşik etki grafı (mevzuat/kritik hizmet/ICT hizmeti/üçüncü taraf/alt
  yüklenici/kontrol/test/bulgu/kanıt), çok-atlamalı SPOF tespiti, otomatik
  yayılım hesaplaması, mühürlü immutable snapshot, Proof Room üçüncü dalı —
  hepsi gerçek PGlite+canlı smoke+e2e ile doğrulandı. **37 Tez Dikey B (Faz
  1-4) de zaten TAM idi (§1.60-§1.64).** Sıradaki adım kurucu kararını
  bekliyor: Dikey D sonraki dilim (süreç/varlık/uygulama ayrı düğüm tipleri,
  RTO/RPO-gerçek-test farkı) ya da Gap Map'teki bağımsız bir sıradaki dikey.
- **Remote (origin/main) HEAD:** `76c1c8b` (§1.66: Kullanıcı Kılavuzu /
  Yardım Merkezi — 3 yeni sayfa + 13 modül yardım paneli, DB/motor değişikliği
  yok) + DEVAM SHA commit'i. Öncesi `a3e30b2` (§1.65: Dikey D ilk dilim —
  kurumsal dayanıklılık birleşik etki grafı, SPOF tespiti, çok-atlamalı
  yayılım, mühürlü immutable snapshot, Proof Room üçüncü dal) + DEVAM SHA
  commit'i. Öncesi `c0ea1c0` (§1.64: Dikey B Faz 4 — DORA RoI
  export alanları için kanıt zinciri/provenance, SCITT bağlama, reconciliation
  cron, Proof Room minimize projeksiyonu; **37 Tez Dikey B Faz 1-4 TAM**) +
  DEVAM SHA commit'i. Öncesi `f5a15da` (§1.63: Dikey B
  Faz 3 kalan dilimi — gerçek HTTP+UI+e2e, CSV/XLSX serileştirme, Proof Room
  kablolaması, `proof_room_goruntule` ledgerDurumu forward-fix) + DEVAM SHA
  commit'i. Öncesi `7d46d7f` (§1.62: Dikey B Faz 3
  ilk dilim — DORA RoI export motoru, roi_export_runs maker-checker+seal,
  Proof Room şema genişletmesi) + DEVAM SHA commit'i. Öncesi `89c6c5d`/
  `dd8596d` (PARALEL OTURUM: sod_import_rollbacklari INSERT-bypass forward-
  fix — bu dikeyin yan bulgusu, ayrı görev olarak tamamlandı). Öncesi
  `0319296` (§1.61: Dikey B
  Faz 2 kalan dilimi — kurum kimliği/sözleşme/alt-yüklenici RoI alanları +
  açık kritik-fonksiyon mapping tablosu, tier'dan ayrık) + DEVAM SHA commit'i.
  Öncesi `61a2a5d` (§1.60: Dikey B Faz 1
  hukuk/kaynak kilidi + Faz 2 ilk dilim `ict_service_types` + SİSTEMİK
  dört-göz INSERT-bypass forward-fix'i, 5 tablo) + DEVAM SHA commit'i. Öncesi
  `79abaf8` (§1.59: 37 Tez Dikey C —
  Model/Compliance Claim Guard, `assurance_claims`+`claim-guard.ts`+`/guvence`
  + `roi_kaynak_kayitlari` dört-göz forward-fix) + DEVAM SHA commit'i. Öncesi
  `ddd2fef` (§1.58: 37 Tez Dikey B ilk migration dilimi — kurum yasal kimlik +
  RoI kaynak kataloğu) + DEVAM SHA commit'i. Öncesi `faeb103` (§1.57: Dikey B
  keşfi, kod yok), `25e817a`
  (§1.56: 37 Tez Dikey A — tedarikçi anket yanıtlama), `91d39ce`
  (§1.55: PR-0 keşif + Gap Map, kod yok), `c894ac5` (§1.54: M35 sonraki
  dilim — vendor-portal dış erişim), `6ba5a25`
  (DEVAM SHA), `c084723` (§1.53: M18 sonraki dilim madde 2/2 — tatbikat →
  eğitim tamamlama gerçek bağı), `7de81b4` (DEVAM SHA), `11460cd` (§1.52: M18
  sonraki dilim madde 1/2 — retraining otomasyonu). Öncesi `ec73851` (§1.51:
  M17 sonraki dilim madde 4/4 SON — WORM export → §1.29 KAPANDI), `8eb3517`
  (§1.50: madde 3/4 — formal independence bağı), `8618a64` (§1.49: madde 2/4 —
  PBC/request), `b73f51d` (§1.48: madde 1/4 — workpaper→bulgu/kontrol bağı),
  `c3320aa`/`4200c75` (§1.47: Dikey 4 kalanı — segment drift + insan override +
  model rollback + ISO 42001↔27001 crosswalk), `c44a954`/`b074bbc` (Dikey 5:
  M21/M42 dayanıklılık taksonomisi + etki grafiği, §1.46). Öncesi tüm v3.3
  Dikey 1-4 + M12-M40 zinciri: `91efb68` (Dikey 4: AI veri/model güvence),
  `15831b9` (Dikey 3: bulut paketi), `e73fd20`
  (Dikey 2: M12 V2 manifest), `5df9176` (Dikey 1: G3 defter kapsamı), `b6283bc`
  (M38 toplantı), `65767b7` (M35 anket şablonu), `2e5efea` (AI eval soyağacı),
  `4007aad` (AI olay bildirim saati), `7c548e6` (transactional outbox → SCITT),
  `88df93e` (M37 AI olay/eval), `be073f3` (M35 değerlendirme), `2a40eca` (M36
  DSAR), `94e4748` (G3 tutarlılık), `ed62f49` (G3 SCITT), `64d9a35` (G8/M40).
  Push edilmemiş commit YOK.
- **Deploy health:** `/health/ready` → `{"durum":"hazir","supabase":"erisilebilir"}`.
- **Test tabanı: 1264 birim (119 dosya) + 63 e2e (+1 yeni), 0 skip; build
  exit 0. TAM e2e takımı (63 spec) sıfır flake koştu.** (§1.63: +13 PGlite/
  saf birim — 10 `roi-export-serialize.test.ts` + 3 `rls-proof-room.test.ts`
  roi_export dalı. Tam takım koşuldu, sıfır regresyon.)
  (§1.62: +30 PGlite/saf birim — 15 `roi-export.test.ts` (saf motor) + 15
  `rls-roi-export-runs.test.ts` (INSERT-bypass regresyonu + maker-checker +
  export-öncesi-engelleme + Proof Room polimorfik hedef). Tam takım koşuldu,
  sıfır regresyon — paralel SoD oturumunun eklemeleri dahil.)
  (§1.61: +12 PGlite birim, yeni `rls-dikeyB-
  faz2-kalan.test.ts`. Tam takım koşuldu, sıfır regresyon.)
  (§1.60'ta UI
  yok), 0 skip; build exit 0.** (§1.60: +25 PGlite birim — yeni `rls-ict-
  service-types.test.ts` 14 test + sistemik INSERT-bypass regresyon testi
  5 dosyaya birer/ikişer eklendi: obligations, assurance-claims, resilience,
  ai-drift-crosswalk, dora-roi-kimlik. Tam takım koşuldu, sıfır regresyon.)
  (§1.59: +40 PGlite birim (21 `rls-assurance-claims.test.ts` + 19 `claim-
  guard.test.ts`) + 1 yeni e2e (`guvence.spec.ts`). Tam takım koşuldu, sıfır
  regresyon; tam-suite paralel koşuda 6 spec ortak-kiracı durum kirliliğinden
  başarısız oldu (fixture reset öncesi state — kod DEĞİL), fixture reset
  sonrası tekil koşuda hepsi yeşil.)
  (§1.58'de UI yok — e2e sayısı değişmedi, yalnız 18 yeni PGlite testi. Bu
  oturumda tam takım ON İKİ kez uçtan uca yeşil koşuldu — `tema.spec`
  dahil hiçbir izole-flake tekrarlamadı. Yol boyunca üç gerçek e2e çakışması
  yakalandı ve düzeltildi (bkz. §1.49/§1.50/§1.53 detayları — ROADMAP'te);
  §1.56'da DÖRDÜNCÜSÜ: e2e'de misafir context yanlış-token URL'inde kalıp
  `reload()` ile devam ediyordu — `goto(anketUrl)` ile düzeltildi, ayrıca
  ikinci `fill()` sonrası `toHaveValue` senkron kontrolü eklendi (React state
  commit'ini garanti eder). §1.53'te bir tam-takım koşusunda PDF/ZIP paket
  testi 90sn timeout'la düştü, İZOLE koşuda temiz geçti — kaynak çekişmesi,
  kod DEĞİL; §1.54/§1.56'nın tam-takım koşuları 0 flake ile geçti. AYRICA:
  `.next` dizini bir noktada bozuldu (`pnpm check`/`pnpm build` tsc'de
  anlamsız hata verdi — kod DEĞİL, dev sunucusunun eşzamanlı yazdığı stale
  bir type-validator dosyası); `rm -rf .next` ile temizlenip yeniden
  koşuldu, temiz geçti — kayıt için: bu sınıf hata görülürse önce `.next`'i
  temizle.)
- **§1.56'da canlı e2e GERÇEK bir şema bug'ı yakaladı (kayıt için önemli):**
  `assessment_response_answers.question_id` ilk halinde `ON DELETE RESTRICT`
  idi — `third_parties` silinirken cascade zinciri (assessments→questions VE
  ayrı dalda revisions→answers) aynı işlemde çakışıyor, TÜM silme FK
  ihlaliyle sessizce başarısız oluyordu (herhangi bir tedarikçi ankete yanıt
  aldıysa, onu silmeye çalışan HER akış çökerdi — testler dahil). Forward-fix
  migration `20260719301000` (`CASCADE`'e çevrildi) + PGlite regresyon testi.
  **Ders:** cascade zincirinde bir dalda RESTRICT + başka dalda CASCADE aynı
  hedef satıra bakıyorsa, Postgres sırayı garanti etmez — yeni bir FK
  eklerken kardeş tablolardaki cascade yönünü kontrol et.
- Migration sırası son: `20260719301000_tedarikci_anket_yaniti_cascade_
  duzelt.sql` (canlıda; guard'lar + cascade fix gerçek Supabase'e karşı smoke
  ile doğrulandı — PGlite≠Supabase disiplini korundu).
- **E2E LEDGER TEMİZLİK KURALI (kayıt için):** kontrol testleri artık auto-anchor
  ediyor → `artifact_ledger_links` entries'e ON DELETE RESTRICT'li. Ledger'a
  dokunan HER e2e spec temizliğinde links+outbox ÖNCE silinmeli (yoksa toplu
  entry-delete sessizce başarısız olur, paylaşımlı E2E kiracısında birikir).
  seffaflik/proof-room/dsar/tedarikci-signoff/kontrol-test-manifest hepsi bu
  sıraya uyar.
- **Bu oturumda TAMAMLANAN vertical dilimler (ayrıntı ROADMAP §1.46-1.52'de):**
  Dikey 5 (M21/M42 dayanıklılık taksonomisi + etki grafiği — `critical_service_
  controls`/`control_resilience_domains`, kural 11 "tek sahte skor yok"); Dikey
  4 kalanı (AI segment drift + insan override + model rollback + ISO 42001↔
  27001 crosswalk); **M17'nin (§1.29) DÖRT maddesi de TAMAMLANDI** — workpaper→
  bulgu/kontrol bağı, PBC/request, formal independence bağı (mevcut G7 tablosu
  genelleştirildi, YENİ tablo AÇILMADI), WORM export (`audit_worm_exports` —
  simulation_result_manifests mühür deseni + `scripts/verify-audit-worm.ts`
  bağımsız CLI'sı, canlıda uçtan uca doğrulandı); M18'in İKİ sonraki-dilim
  maddesi de TAMAM — retraining otomasyonu (§1.52 — `training_assignments`
  unique kısıtı partial hale geldi + `egitim_periyot_yenile()` pg_cron işi,
  SoD/TPR süre-dolumu deseninin aynısı) ve tatbikat→eğitim tamamlama gerçek
  bağı (§1.53 — `scenario_templates.egitim_konusu` etiketli bir şablonun
  tatbikatı puanlanınca katılımcı-rolündeki kullanıcıların eşleşen aktif
  eğitim ataması otomatik tamamlanır, skor mühürlenen puandan UYDURULMADAN
  kopyalanır; mevcut S01-S05'in HİÇBİRİ etiketlenmedi — kural 12, mekanizma
  hazır ama içerik kararı kurucuda kalıyor). M35'in bir sonraki-dilim maddesi
  de TAMAM — **vendor-portal dış erişim** (§1.54 — `third_party_access_
  grants`/`tedarikci_goruntule`, matter_access_grants/matter_goruntule
  deseninin AYNISI; tedarikçi hesapsız süreli/iptal edilebilir token'la kendi
  kaydının özetini + açık bulgularını görür, `/tedarikci-erisim/[token]`
  oturumsuz rota). **37 Tez Dikey A da BİTTİ (§1.56)** — tedarikçi kendi
  anket sorularını YANITLIYOR: token sertleştirmesi (yalnız hash saklanır),
  TASLAK→GONDERILDI→(kurum incelemesi)→DEGISIKLIK_ISTENDI→[yeni revizyon]→
  KABUL_EDILDI/REDDEDILDI/SURESI_DOLDU durum makinesi, RLS'te kilitli "kurum
  tedarikçi adına cevap üretemez" invariant'ı (GONDERILDI olmayan revizyona
  UPDATE erişimi hiç yok), çift-submit idempotent, süre-dolumu cron. Her
  dilim: kendi migration + RLS/guard testleri + canlı guard smoke + UI +
  gerçek Chromium e2e + commit + push + deploy health doğrulaması ile teslim
  edildi.
- **Sıradaki (Gap Map'in kendi sırası, bu oturumda YAPILMADI):** Dikey B (M35
  resmi DORA RoI — RESMİ AB şeması bulunup kaydedilmeden KAYNAK BEKLİYOR
  kalır, uydurulmaz), Dikey C (KOS-7 Model Claim Guard — M37 eval'ı genişletir,
  yeni paralel motor kurulmaz), Dikey D (KOS-6 açıklama/adalet/itiraz — DIŞ
  KARAR: SFIX/S-SFIX bağımsız replikasyon + lisans ADR'si olmadan
  başlanmaz), Dikey E (KOS-5 AI Assurance kalanı: Governance Board + AI
  sözleşme bağı), Dikey F (KOS-1 source-to-proof impact-review), Dikey G
  (KOS-2 çok-hoplu dayanıklılık zinciri — 29 alt kategori hâlâ KAYNAK
  BEKLİYOR), Dikey H (KOS-8 kalanı), Dikey I (KOS-9, YOK), Dikey J (KOS-10,
  YOK, Dikey C'ye bağımlı), Dikey K (KOS-11, DIŞ KARAR + kapı, en son).
  Tam ayrıntı: `docs/GAP_MAP_37_TEZ.md`. Bunun yanında hâlâ açık: tezin 29 alt
  kategorisi + kaynak künyesi (Dikey 5/G kesişimi); ROADMAP §1.25-1.28'in
  M36/M37/M38/M13 "sonraki dilim" borçları (sınır-ötesi TransferAssessment,
  ExternalOrganization/Professional sicili, vb). Kurucudan yeni belge
  gelene kadar bu iki listeden (Gap Map + eski backlog) mantıklı bir sonraki
  madde seçilerek devam edilebilir.
- **§8.0 ana dikeyi TAM (ilk kapsam madde 1-2):** kontrol testi koşusu
  (`test_runs`, otomatik, Proof Room'a bağlı) + DSAR kanıt paketi (senkrondan
  asenkrona geçirildi). Genel mekanizma (`ledger_outbox`+`artifact_ledger_links`
  +claim/mark RPC'leri+`ledger-outbox.ts` dispatch) HAZIR — madde 3-5 (M35
  sign-off, M37 eval/olay kapanışı, M40 risk/board kararı) bilinçli SONRAKİ
  dilim (dispatch registry'ye birer satır, mekanik genişleme; ROADMAP §1.37).
- **§8.0 sonu öncelik sırası TAMAMEN BİTTİ (madde 1-4, ROADMAP §1.38-1.41):**
  (1) AI ciddi olay bildirim süre saati — eşik SAYISI koda sabitlenmedi (kural
  3), kurum kendi hukuk ekibiyle girer. (2) AI eval veri-soyağacı — ham veri
  girmez (kural 22). (3) M35 doğrulanmış anket şablonu — bir kez yazılır, her
  değerlendirmede kopyalanır. (4) M38 regülatör toplantı kaydı — matter
  zincirine eklendi.
- **NİHAİ TALİMAT v3.2'DE AÇIKÇA SIRALANMIŞ TÜM İŞ BİTTİ.** Sıradaki iş için
  ya kurucudan yeni yön beklenmeli ya da §8.0 dışındaki gate'lerin (G0 kalanı,
  G9 M42, bilinçli sonraki-dilim borçları — ROADMAP §1.24-1.30, §1.37 madde
  3-5) arasından mantıklı bir sonraki adım seçilmeli.
- **GATE G8 TAM** (M13+M17+M18+M40). **GATE G3 dış-karardan bağımsız kısım TAM**
  (SCITT şeffaflık defteri + TSA adaptör arayüzü; connector pilot yığını + nitelikli
  TSA sağlayıcı OPEN_DECISION #7 bekliyor — UYDURULMADI).
- **G1 durumu:** *Proof Room engineering slice complete; K8 content validation
  pending.* G1 source-to-proof dikeyinin KOD tarafı bitti (artifact ingest,
  temporal provision, dört-göz obligations, applicability, legal-basis guard,
  execution snapshot, citation bundle + offline verifier, Proof Room). **G1
  TAM CLOSED DEĞİL:** ≥20 uzman doğrulamalı SPK/7545 kontrolü + ≥5 gerçek test
  tanımı KURUCU/hukuk içerik teslimi bekliyor (kural 3 — uydurulmaz; K8 hukuk
  doğrulayıcı rolü). İçerik gelince G1 CLOSED ilan edilir.

## 1. NEREDE KALINDI
- **M16 üretim kapısı GEÇTİ** (kurucu onayı). Paralel borç: K1 staging, K2 dış cron.
- **V2 PR-0 / PR-2 (a-b-c) / PR-3 (CFO çekirdeği) / PR-4a**: TAMAM (ayrıntı
  CLAUDE.md + ROADMAP).
- **V2 PR-4b adım 1-5 TAMAM (canlıda, e2e kanıtlı):**
  1. `provisions` (M20, bitemporal, global) — rls-provisions 8/8.
  2. `obligations`+`obligation_control_mappings` (M21) — 6 doğrulama durumu;
     DB guard: VERIFIED doğamaz / yalnız LEGAL_REVIEW'den + dogrulayan atfıyla /
     VERIFIED içerik donuk. rls-obligations 9/9.
  3. `applicability_decisions` (M22, tenant'a özgü) — UNKNOWN != NOT_APPLICABLE
     DB invariant'ı (NA gerekçe+onay+kimlik-atfı ister), append-only karar
     zinciri (supersede), fact_snapshot + RFC8785 fingerprint; saf yardımcılar
     `src/lib/applicability.ts` (kural motoru UYDURULMADI — eksik olgu →
     UNKNOWN, tam olguda karar insanda). rls-applicability 10/10 + 6 birim.
  4. `src/lib/legal-basis.ts` (M23 saf motor) + ROTAYA BAĞLI:
     `/api/kontrol-test/[id]/calistir` koşudan önce zinciri okur
     (`legal-basis-server.ts`, RLS altında; REJECTED eşleme = iddia değil) →
     BLOCK ise 409 + koşusuz değişmez fotoğraf; değilse koşu + fotoğraf.
     V2 kabulü e2e'de kanıtlı (`legal-basis.spec.ts`): doğrulanmamış eşleme
     zorunlu kontrolü bloklar → doğrula → uyarılı koşu → applicability →
     ALLOW. `20260718190000`: fotoğraf DELETE disiplini test_runs'la hizalandı
     (fixture cascade'i kırılmasın — PGlite regresyon testi yakaladı).
  5. M24 sitasyon paketi: `src/lib/citation-bundle.ts` (KALKAN_CITATION_
     BUNDLE_V1; İMZASIZ_HASH_BUTUNLUKLU — sahte "signed" yok) + rota
     `/api/kontrol-test/run/[runId]/sitasyon` + BAĞIMSIZ CLI
     `scripts/verify-sitasyon.ts` (DB'siz; e2e'de ayrı süreçte VERIFIED=0 /
     kurcalı=1 kanıtlı). Üç EK hash (kural 15, mevcut dörtlü bozulmadı):
     `legalSnapshotHash`/`sourceBundleHash`/`applicabilityDecisionHash`;
     fotoğrafsız eski koşuda hash NULL — uydurulmaz.
Test tabanı: **789 birim (61 dosya) + 34 e2e, 0 skip**; production build yeşil.
Migration sırası son: `20260718190000_els_delete_alignment` (CANLIDA).

## 2. SIRADAKİ İŞ — NİHAİ TEK TALİMAT (v3.0) GATE SIRASI
**⚠️ BAĞLAYICI BELGE DEĞİŞTİ (18 Temmuz gece, en son):**
`docs/arastirma/KALKAN_OS_Nihai_Tek_Talimat_2026.md` artık TEK kurucu
talimatı; QRegu dahil öncekiler tarihsel. Fark analizi + gate↔repo eşlemesi:
`docs/adr/G0-nihai-talimat-fark-analizi-2026-07-18.md` (ROADMAP §1.20).
Rapor formatı: nihai §15. Özet: **G0 GEÇMİŞ; sıradaki G1 kapanışı → G2
(M34 Policy Lifecycle) → G3 (connector+TSA interface)**. G1'in tek gerçek
blocker'ı kurucu İÇERİK teslimi (≥20 doğrulanmış SPK/7545 kontrolü + hukuk
doğrulayıcı rolü). QRegu döneminde teslim edilenler (ROADMAP §1.16-1.19):
1. ~~**PR-Q1'** (kaynak ingest dilimi)~~ **BİTTİ** (ROADMAP §1.17): bucket +
   küratör ingest scripti + `source_fetch_runs` + tazelik (kural 8) + UI
   nüsha listesi; canlı smoke 8/8. Sapma: staleness cron'u connector'a
   ertelendi (türetim okuma-anı saf fonksiyon).
2. ~~**PR-Q2a'** dört-göz iş akışı~~ **BİTTİ** (ROADMAP §1.18).
3. ~~**PR-Q2b'** applicability wizard + kanıt izi rayı gerçek verisi~~
   **BİTTİ** (ROADMAP §1.19).

**GATE SIRASI (nihai §8; ayrıntı fark-analizi ADR'sinde):**
1. ~~**G1 kapanış dilimi: Proof Room**~~ **BİTTİ** (ROADMAP §1.21): süreli/
   iptal edilebilir oturumsuz koşu görünümü + RPC + güvenlik testleri + e2e.
   G1'in kalan kod borcu KÜÇÜK: koşu satırından link üretme UI butonu.
   G1 kapanışının gerçek blocker'ı hâlâ KURUCU İÇERİK teslimi (≥20 doğrulanmış
   SPK/7545 kontrolü + ≥5 gerçek test tanımı + hukuk doğrulayıcı rolü K8).
2. ~~**G2 — M34 Policy Lifecycle**~~ **BİTTİ + ÜRETİM DİKEYİ GENİŞLETİLDİ**
   (ROADMAP §1.22 ilk dilim, §1.23 kurucu tam kapsam v2): 8 tablo
   (documents/versions/clauses/clause_links/attestations/**approvals**/
   **exceptions**/**impacts**), IN_REVIEW yaşam döngüsü, çoklu bağımsız onay +
   dört göz, geriye-tarih yasağı, APPROVED/EFFECTIVE donukluğu, istisna
   süre-dolumu cron → YENIDEN_DEGERLENDIR, PolicyImpact PROPOSED/AI sınırı;
   `/politikalar` + `/politikalar/[id]` detay (madde→bağ→onay→yürürlük→
   salt-okur+audit); rls 14/14 + e2e 7-adım + canlı smoke 6/6. Redline diff
   görünümü bilinçli sonraki dilim.
3. ~~**G4 — M35 TPRM**~~ **BİTTİ** (ROADMAP §1.24): 5 tablo (third_parties/
   services/fourth_parties/contracts/exit_plans), insan-karar guard, bilinmeyen
   dördüncü taraf, tested-exit kanıt şartı, süre-dolumu cron, yoğunlaşma analizi
   + DORA RoI iskelesi; `/tedarikciler` + detay UI; rls 7/7 + saf 8/8 + e2e +
   smoke 5/5. Sonraki dilim: assessment/questionnaire/finding + resmî RoI +
   vendor-portal.
4. ~~**G6 — M36 PrivacyOps**~~ **BİTTİ** (ROADMAP §1.25): ROPA + DSAR (kimlik
   şartı + süre saati) + ihlal (bildirim saati) + DPIA dört-göz; veri
   minimizasyonu (maskeli+hash); `/gizlilik` hub; rls 7/7 + saf 6/6 + e2e +
   smoke 4/4. Sonraki dilim: connector, DSAR kanıt paketi, TransferAssessment.
5. ~~**G5 — M37 AI Assurance & Agent Governance**~~ **BİTTİ** (ROADMAP §1.26):
   ai_systems/ai_agents/ai_execution_receipts; PROHIBITED-aktif-yasağı,
   yazma-yetkisi-insan-onay, AI karar sınırı (AI/service kabul edemez); receipt
   fingerprint; `/ai-guvence` hub; rls 7/7 + saf 3/3 + e2e + smoke 3/3. Sonraki
   dilim: eval/data-lineage/incident detayı, crosswalk içeriği, AI literacy.
6. ~~**G7 — M38+M41 Regulatory Engagement + Partner**~~ **BİTTİ** (ROADMAP
   §1.27): matters/requests/responses (dört-göz + makbuz) + independence +
   matter_access_grants + oturumsuz `/matter/[token]`; rls 4/4 + saf 2/2 +
   üç-context e2e + smoke 3/3. Sonraki dilim: meeting, external org/prof sicili,
   external review/note, gerçek gönderim connector.
7. **G8 parça 1 — M13 Critical Service & Impact Tolerance BİTTİ** (ROADMAP
   §1.28): critical_business_services/impact_tolerances/service_dependencies;
   yönetim-onaylı tolerans + eşik donukluğu + sistemik tekil-nokta; M35 tedarikçi
   bağı; `/kritik-hizmetler`; rls 5/5 + saf 2/2 + e2e + smoke 2/2.
8. **G8 parça 2 — M17 Audit Workspace BİTTİ** (ROADMAP §1.29): audit_engagements/
   samples/workpapers/review_notes; tekrarlanabilir seed'li örnekleme +
   bağımsızlık sign-off + onaylı-kağıt donukluğu; `/denetim`; rls 3/3 + saf 5/5 +
   e2e + smoke 3/3.
9. **G8 parça 3 — M18 Training & Competency BİTTİ** (ROADMAP §1.30):
   training_requirements/assignments/completions; geçme eşikten hesaplanır +
   attestation + yetkinlik boşluğu; `/egitim`; rls 5/5 + saf 3/3 + e2e + smoke
   3/3.
10. **G8 kalan + sıradaki (nihai §8):** M40 risk appetite/KRI/loss-distribution
    (CRQ — sahte kesinlik YOK: dağılım+varsayım, tek risk puanı değil). G3
    (connector + RFC 3161 TSA adapter interface + SCITT-tarzı transparency ledger,
    M5.5 Merkle yeniden kullanılır) — connector'lar kurucu #7 pilot stack'i
    bekliyor; TSA interface + SCITT-tarzı ledger dış-karar bağımsız. Ayrıca
    M13/M17/M18/M35/M36/M37/M38 "sonraki dilim" borçları (ROADMAP §1.24-1.30).
Her adım: migration (PGlite RLS testi) → canlı db:push+db:types → gerçek
Chromium e2e → commit; rapor nihai §15 formatında. Kural 3'ü her adımda koru.

## 3. V2 PR-4b SONRASI SIRA (V2 §9)
PR-5 M17 Audit Workspace MVP → PR-6 M18 Training MVP (M12 test motorunu yeniden
kullan) → PR-7 Connector+Consolidation → PR-8 Product Analytics.
Ayrıca **CFO MVP kalan dilimleri** (ROADMAP §1.13 sonu): (a) CFO baseline pack
İÇERİĞİ — finans best-practice kontrolleri için katalog framework genişletmesi
gerekir (mevcut `frameworks.code` check yalnız VII-128.10/7545/BDDK/DORA'ya
izin verir; BEST_PRACTICE bucket'ı için migration + `data/packs/*.yaml`, kural 3:
uydurma law değil açıkça best-practice); (b) finans-detay wizard; (c) BEC/
deepfake tatbikatı M12'ye bağlama; (d) yönetim raporu export.

## 4. DEĞİŞMEZ SINIRLAR (uydurMA)
Açık kurucu kararları — adapter/interface + OPEN-DECISION ile ilerle, GERÇEĞİNİ
uydurma: **K1** staging, **K2** dış cron, **K3** billing provider (MVP mock
provisioning), **K4** fiyat/KDV/trial, **K5** partner delegation, **K6** analitik
retention, **K7** ilk ERP/banka connector, **K8** hukuk-doğrulama/küratör rolü,
+ KMS/HSM, RFC 3161 TSA, üçüncü taraf mevzuat lisansları, dış otorite gönderimi.
Ayrıca: kural 3 (uydurma mevzuat VERIFIED yok), CFO §5.1 (para hareketi/
credential yok, salt-okur), IBAN maskeli+hash (tam IBAN saklanmaz).

## 5. ÇALIŞMA DÜZENİ (bu repoda kanıtlanmış akış)
- Migration yaz → PGlite'ta RLS testi (`src/lib/__tests__/helpers/pg.ts` artık
  snapshot-klon, hızlı) → `pnpm db:push` (canlı) → `pnpm db:types` → gerçek
  yazma smoke (geçici script, sonra sil) → gerçek Chromium e2e.
- Commit mesajını DOSYAYA yaz, `git commit -F <dosya>` (heredoc PowerShell'de
  kırılıyor). İngilizce commit, Türkçe UI/yorum.
- Push sonrası deploy: `curl.exe /health/ready`; build ID Turbopack'te güvenilmez,
  kesin doğrulama gerçek giriş + ekran render'ı.
- PowerShell shell sınıflandırıcısı ara sıra "temporarily unavailable" verir —
  kısa bekle, tekrar dene; read-only işler etkilenmez.
- vitest.config exclude `**/node_modules/**` (worktree node_modules sızmasın).
- Deploy health'i background task olarak koştur, bloklanma.

## 6. AÇIK BİR NOT
"PGlite snapshot" worktree'si (festive-austin) gece oturumunda kontrol edildi:
içinde main'de olmayan hiçbir iş yoktu (temiz, aynı commit) — silindi. Ayrık
worktree kalmadı; `git worktree list` yalnız ana çalışma ağacını gösteriyor.
