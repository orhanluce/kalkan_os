# PR-0 — Dikey E, E1: Cloud / Critical Supplier Assurance Profile (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz onbirinci talimatı — Dikey E analiz onayı +
E1 uygulama emri, 4 kurucu kararı (aşağıda) ile.

## 0. Grep sweep (talimatın kendi kural 1'i) — bu turda YENİDEN doğrulandı

`assessment_finding_guard`: yalnız `20260719100000_tpr_assessment.sql` —
GÜNCEL sürüm bu, forward-fix bunun üzerine. `proof_room_goruntule`: en son
`20260720210000_proof_room_graph_snapshot_dali.sql` (Dikey D'nin kendi
işi). `proof_room_links` şeması en son `20260720200000_impact_graph_
snapshots.sql`'de değişti (`graph_snapshot_id` + 3'lü CHECK). `assessment_
questions`/`assessment_question_templates`: taban `20260719150000`, Cloud
Pack genişlemesi `20260719190000`, anket-yanıtlama `20260719300000/301000`
— GÜNCEL şema bunların TOPLAMI. `impact_graph_snapshots`: yalnız Dikey D'nin
iki migration'ı, üçüncüsü bu turda eklenecek forward-fix'tir.

## 1. Mimari karar

Yeni tablo/motor/graph DB YOK. E1 = mevcut M35 + Cloud Pack + Dikey D
(`impact-graph.ts`) + Dikey B (provenance/Proof Room) ÜZERİNE 5 dar iş:
(1) `kaynak_turu` epistemik kolonu, (2) `assessment_finding_guard` bağımsız-
kapanış forward-fix'i, (3) TEK yeni tablo (`cloud_assurance_profile_
snapshots`, mühürlü profil), (4) `impact-graph.ts`'e opsiyonel tedarikçi-
bulgusu genişlemesi, (5) Proof Room 4. dal.

**Alternatifler ve neden reddedildi:** yeni "vendor assurance" paralel
şeması → M35+Cloud Pack zaten kapsamın çoğunu karşılıyor, tekrar model
riskli. Yeni graph DB → `impact-graph.ts` zaten üçüncü taraf/alt yüklenici
düğümü taşıyor, yalnız bulgu kenarı eksikti. `kaynak_turu`'nu `assurance_
claims`'e (polimorfik) bağlamak → reddedildi: `assurance_claims` "iddia"
kavramı için tasarlandı (dört-göz + VERIFIED şartları); Cloud Pack sorusunun
epistemik etiketi daha yerel bir sınıflandırma, doğrudan kolon daha az
bağlantı/risk taşıyor.

**Bilinçli kapsam genişlemesi (dürüstçe kayıtlı, talimatın "yalnız kaynak_
turu" maddesinin ÖTESİNDE tek ek):** `assessment_questions`'a nullable
`template_id` FK eklendi. Gerekçe: talimat G maddesi her soru için "doğrulama
durumu/doğrulayan/doğrulama zamanı" göstermeyi istiyor — bu alanlar YALNIZ
`assessment_question_templates`'te var (Cloud Pack'in kendi dört-göz
disiplini, `cloud_pack_dogrulama_guard`), `assessment_questions`'ta hiç yok
ve aralarında ÖNCEDEN hiçbir bağ yoktu (kopyalama düz INSERT, iz sürülemez).
`template_id` olmadan bu alanları per-soru göstermek YA uydurma YA imkânsız
olurdu. FK CANLI sorgulanır (kopyalama anında DONDURULMAZ) — motor hesap
anındaki GÜNCEL şablon durumunu okur; yalnız MÜHÜRLENMİŞ snapshot (aşağıda)
kendi anını dondurur. Bu, projenin "obligasyon/kaynak canlı, yalnız mühür
donuk" ilkesiyle (roi_export_runs, assurance_claims) AYNI.

## 2. Veri sahipliği

Tüm yeni/değişen kolonlar tenant-scoped. `assessment_question_templates`
zaten tenant'a özgü (kendi soru bankası). `cloud_assurance_profile_
snapshots` tenant-scoped, tek yazma yolu kendi RLS policy'si (admin/uyum).

## 3. Maker-checker sınırı

`assessment_finding_guard` forward-fix'i: `sahibi` (owner) NOT NULL VE
`kapatan <> sahibi` — bağımsız kapanış invaryantı, M12/SoD'nin "kendi işini
kendi kapatamaz" deseninin AYNISI. Snapshot'ın kendisi maker-checker
İSTEMEZ (§4'te gerekçeli).

## 4. Snapshot/immutability kararı (4 kategori, kurucunun kendi ayrımı)

- **Deterministik hesaplama snapshot'ı** (`cloud_assurance_profile_
  snapshots`): maker-checker YOK, **immutable ZORUNLU** — `impact_graph_
  snapshots`'ın (Dikey D) AYNI deseni: UPDATE trigger'ı service_role dahil
  HER ZAMAN reddeder (`test_runs`'ın 20260717230001 dersi). Gerekçe: bu,
  ZATEN KARARA BAĞLANMIŞ alt-gerçeklerin (dört-göz geçmiş dogrulama_durumu,
  bulgu durumları) bir ANDAKİ birleşik fotoğrafı — kendi başına yeni bir
  hüküm ÜRETMİYOR.
- **Hukuki/uyum sign-off artefaktı** (`third_party_assessments.durum=
  TAMAMLANDI`, Cloud Pack `VERIFIED`): ZATEN VAR, kendi guard'ları çalışıyor
  — dokunulmadı.
- **Tedarikçi beyanı** (`assessment_response_answers`, Dikey A): ZATEN VAR,
  bağımsız doğrulama SAYILMIYOR — `kaynak_turu=PROVIDER_ATTESTATION`
  etiketi bu ayrımı motor seviyesinde AÇIKÇA taşır.
  DELETE: `impact_graph_snapshots`'ın AYNI ilkesi — yalnız tenant cascade
  için serbest, authenticated'a DELETE policy'si YOK.
- **Bağımsız doğrulama**: Cloud Pack'in `dogrulayan`/`dogrulama_zamani`
  alanları — ZATEN VAR.

## 5. Hukuki statü ayrımı (`kaynak_turu`)

8 değer, kurucu onaylı, default `UNKNOWN`. `UNKNOWN` ne başarısızlık ne
olumlu güvence — yalnız "bilinmiyor". `PROVIDER_ATTESTATION` bağımsız
doğrulama SAYILMAZ (motor bunu genel durumda AÇIKÇA sınırlar, §6).
`LEGAL_REQUIREMENT`/`CONTRACTUAL_REQUIREMENT` sistem tarafından TAHMİN
EDİLEMEZ — yalnız insan seçer (DB seviyesinde zorlanmaz, kural: default
UNKNOWN + hiçbir otomasyon/seed bu iki değeri yazmaz, kod incelemesiyle
garanti). `kaynak_turu` ile Cloud Pack'in kendi `dogrulama_durumu`'u
BAĞIMSIZ iki boyut — motor ikisini AYRI ayrı taşır, birleştirmez.

## 6. Saf motor kararı — "zorunlu kategori" listesi UYDURULMADI

Cloud Pack modelinde HİÇBİR kategori "zorunlu" olarak işaretli DEĞİL (şema
taraması doğrulandı — `kategori` yalnız kapalı küme bir ETİKET, zorunluluk
bayrağı YOK). Motor bu yüzden sabit bir "şu kategoriler olmadan VERIFIED
olamaz" listesi UYDURMAZ. Bunun yerine: **genel durum yalnız MEVCUT
sorulara göre worst-of hesaplanır**; hiç sorusu olmayan bir kategori
`CEVAPSIZ` görünür (sessizce atlanmaz), genel durum bu durumda `TODO_
DOGRULA` üstünü GEÇEMEZ (asla sahte VERIFIED). `ACIK_KRITIK_BULGU` tek
MUTLAK blok (`ENGELLENDI`) — M35'in mevcut `assessment_tamamla_guard`
kuralının AYNI ilkesi, motor bunu tekrar İCAT ETMEZ, yalnız YANSITIR.

## 7. Proof Room / DORA RoI bağlantısı

4. dal, `impact_graph_snapshots`'ın AYNI polimorfik deseni (CHECK 3→4).
Minimize: ham cevap/sözleşme metni/PII DÖNMEZ — yalnız kategori durumları +
kaynak türü dağılımı + engel kodları + hash. `iliskili_roi_export_run_id`
opsiyonel, `impact_graph_snapshots`'ın AYNI cross-tenant guard'ı.

**Bulunan borç (kapsam dışı bırakılmadı, dar kapsamda kapatıldı):**
`proof_room_links`'in var olan üç dalı (test_run_id/roi_export_run_id/
graph_snapshot_id) hiçbirinde FK'lı hedefin tenant_id'sini doğrulayan bir
trigger YOK — yalnız satırın kendi tenant_id'si RLS ile korunuyor, hedefin
tenant'ı DEĞİL. Kurucunun 4. dal için açık şartı ("Cross-tenant linking
rejected at DB level") bu boşluğu miras alırdı. Üç eski dalı GENİŞLETMEDEN
(mevcut borç dokunulmadı, ayrı bir karar gerektirir), yalnız YENİ
`cloud_assurance_profile_id` kolonu için dar bir `before insert or update`
guard'ı eklendi (`20260720270000`).

## 8. RLS ve tenant modeli

İstemciden `tenant_id`/`olusturan`/hash GÜVENİLMEZ (mevcut desen — sunucu
rotası kendi oturum bağlamından okur). Snapshot INSERT'inden ÖNCE third_
party/contract/kritik-hizmet/roi-export aynı tenant'a ait mi DB trigger'ında
doğrulanır (`impact_graph_snapshots`'ın AYNI deseni).

## 9. Güvenlik ve veri minimizasyonu

Snapshot içine ham cevap metni/sözleşme metni/PII/erişim bilgisi/tam kanıt
dosyası/tedarikçi portal token'ı KONMAZ — yalnız kategori durumu + kaynak
türü SAYISI + engel kodu + kimlik referansları.

## 10. Bilinen borçlar (kapsam dışı, değişmedi)

Telafi edici kontrol bağlantısı (E2), RTO/RPO zinciri, sözleşme-düzeyi graf
granülerliği, dördüncü-taraf değişiklik bildirimi, yapılandırılmış SLA/IAM/
yedekleme alanları, SCITT bağlantısı, KMS/JWS/TSA, AI/hukuk sağlayıcısı.
