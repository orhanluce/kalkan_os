# PR-0 — 37 Tez Dikey B, Faz 3 ilk dilim: DORA RoI Export Motoru (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz dördüncü talimatı. Kapsam: mevcut kurum
kimliği, ICT hizmet türü, third_parties, fourth_parties ve critical_
business_services yapılarını KULLAN; yeni paralel tablo veya ikinci bir
kritik fonksiyon modeli KURMA.

## 0. Önce mevcut yapı (kural 1)

Okunanlar: `src/lib/canonical.ts` (RFC 8785 kanonik JSON + `canonicalHash`
— export mühürü İÇİN YENİDEN KULLANILACAK, ikinci bir hash şeması İCAT
EDİLMEYECEK), `supabase/migrations/20260719260000_audit_worm_exports.sql`
(WORM mühür deseni: INSERT sonrası içerik alanları TAMAMEN donuk),
`supabase/migrations/20260718060000_sod_import_rollback.sql` (maker-checker
deseni: `talep_eden`/`onaylayan`, onaylayan≠talep_eden), `src/app/api/
proof-room/route.ts` + `proof_room_links` şeması (denetçiye paylaşılabilir
token linki — ŞU AN yalnız `test_run_id`'ye bağlı).

**Bulgu (yan ürün, bu turda DÜZELTİLMEDİ, ayrı görev olarak işaretlendi):**
`sod_import_rollbacklari`'nın maker-checker guard'ı yalnız `before update`
tetikleniyor — `before insert` YOK. RLS insert policy'si `durum` alanını
kısıtlamıyor, yani bir kullanıcı doğrudan `durum='UYGULANDI', onaylayan=
kendisi` ile INSERT edip iki-kişi kuralını atlayabilir. **Bugünün asıl
dersiyle (INSERT-anı bypass) AYNI SINIF bir açık** — ama SoD modülü bu
dikeyin kapsamı DIŞINDA, kod DEĞİŞTİRİLMEDİ, ayrı bir arka plan görevi
olarak işaretlendi (spawn_task). Bu ADR'nin kendi yeni guard'ı (§3) bu
hatayı BAŞTAN doğru yazarak tekrarlamaz.

## 1. Ön-kontrol (export öncesi engelleme) — SAF FONKSİYON

`src/lib/roi-export.ts`, `roiExportOnKontrol()`: mevcut 5 yapının
(kimlik/hizmet türü/third_parties/fourth_parties/critical_business_
services + mapping tablosu) anlık görüntüsünü alır, İKİ seviyeli sorun
listesi döner (`blok`/`uyari`, kural 11 desenindeki `sebepler[]` biçimi):

- **BLOK:** kimlik yok/LEI yok/ülke yok; bir sözleşmenin `ict_hizmet_turu_
  kod`'u `ict_service_types`'ta VERIFIED DEĞİLSE (**bugün HİÇBİR ICT hizmet
  türü VERIFIED değil — bu YÜZDEN her sözleşme-bağlı export bugün BLOKE
  KALACAK, bu dürüst ve İSTENEN davranış**, kural 3: doğrulanmamış kaynak
  export'a giremez).
- **UYARI:** ulusal kimlik kodu (EUID/ticaret sicil) eksik; aktif sözleşme
  ama bitiş tarihi geçmiş (tutarsızlık); veri saklanıyor ama ülke yok; alt
  yüklenicinin bağlı olduğu sözleşme id'si girdi kümesinde yok (tutarsızlık);
  eşlemedeki kritik fonksiyon PASİF durumda.

**Export ÜRETİMİ bu sorunlarla ENGELLENMEZ** (taslak her zaman görülebilir,
kullanıcı neyin eksik olduğunu görsün) — **YAYINLANMASI (onay talebi)
engellenir** (§3).

## 2. Şablon satırı üretimi — SAF FONKSİYON, uydurma YOK

`roiSablonSatirlariUret()`: yalnız VAR OLAN 5 yapıdan doğrudan türeyen
alanları doldurur; RoI'nin gerektirdiği ama repo'da henüz KARŞILIĞI OLMAYAN
alanlar (ör. B_06.01 RTO/RPO — `impact_tolerances` tablosunda var ama bu
turun kapsamındaki 5 yapıya dahil değil, kurucunun kendi listesi) `null` +
`kapsamDisi: true` işaretiyle bırakılır — UYDURULMAZ. Kapsanan şablonlar:
B_01.01 (kurum kimliği), B_02.01/B_02.02 (sözleşme genel+özel — mevcut alan
alt kümesi), B_05.01 (üçüncü taraf kimliği), B_05.02 (alt yüklenici zinciri),
B_06.01 (kritik fonksiyon adı — RTO/RPO kapsam dışı işaretli).

## 3. `roi_export_runs` — sealed snapshot + maker-checker yayın onayı

**Altı-durumlu `dogrulama_durumu` sözlüğü BURADA KULLANILMADI** (bilinçli
karar): o sözlük "bu içerik regülasyon olarak doğrulandı mı" sorusuna
cevap verir; export onayı FARKLI bir soru ("bu belirli export denetçiye
gösterilsin mi") — SoD rollback'in maker-checker ailesiyle AYNI KAVRAM,
o yüzden `talep_eden`/`onaylayan` vokabüleri yeniden kullanıldı, DURUM
adları export'a özgü: `TASLAK → ONAY_TALEP_EDILDI → YAYINLANDI`/`REDDEDILDI`.

**Mühür (audit_worm_exports deseninin aynısı):** `paket` (jsonb, §2'nin
çıktısı) + `paket_hash` (RFC 8785 `canonicalHash`, `src/lib/canonical.ts`
YENİDEN KULLANILDI) + `on_kontrol_raporu` (§1'in çıktısı) + `engelleyici_
sorun_sayisi` — HEPSİ INSERT ANINDA MÜHÜRLENİR, sonrasında DEĞİŞTİRİLEMEZ
(guard).

**Guard (BAŞTAN doğru — §0'ın bulgusundan ders alınarak, `before insert or
update`):**
- INSERT: yalnız `TASLAK` doğabilir (`ONAY_TALEP_EDILDI`/`YAYINLANDI`/
  `REDDEDILDI` doğrudan INSERT'te REDDEDİLİR — dört-göz ailesinin INSERT-
  bypass dersinin AYNISI, farklı vokabülerle).
- `TASLAK → ONAY_TALEP_EDILDI`: `engelleyici_sorun_sayisi = 0` DEĞİLSE
  REDDEDİLİR (§1'in "yayın engelleme" şartı burada zorlanır).
- `ONAY_TALEP_EDILDI → YAYINLANDI`/`REDDEDILDI`: `onaylayan` zorunlu,
  `onaylayan ≠ talep_eden` zorunlu (maker-checker).
- `YAYINLANDI`/`REDDEDILDI` TERMİNAL: bir daha DEĞİŞMEZ.
- İçerik alanları (`paket`/`paket_hash`/`on_kontrol_raporu`/`talep_eden`/
  `tenant_id`) her durumda donuk.

RLS: third_party_contract_critical_services'in AYNI deseni (tenant-scoped,
admin/uyum select+insert; UPDATE de aynı policy altında — guard zaten
geçişleri kilitliyor, SoD'nin revoke-and-route-only yaklaşımı BURADA
GEREKMİYOR çünkü publish'in karmaşık yan etkisi yok).

## 4. Proof Room bağlantısı — GENİŞLETME, yeni paylaşım mekanizması YOK

`proof_room_links.test_run_id` NULLABLE yapıldı, `roi_export_run_id`
(nullable, FK) EKLENDİ, CHECK: tam olarak biri dolu. `/api/proof-room`
rotası `roiExportRunId` kabul edecek şekilde genişletilecek (yalnız
`durum='YAYINLANDI'` olan export'lar için link kurulabilir) — BU DİLİMDE
rota değişikliği YAPILMADI (şema hazır, rota genişletmesi UI dilimiyle
birlikte gelir, kapsam dışı §6).

## 5. Kapsam dışı (bu dilimde YOK)

CSV/XLSX serileştirme (yalnız JSON — kural 4 ruhu: yeni ağır bağımlılık
eklemeden önce founder kararı), UI, `/api/proof-room` rotasının roi_export_
run_id'yi gerçekten kabul etmesi (şema hazır, rota kablolanmadı), impact_
tolerances RTO/RPO zenginleştirmesi, B_01.02/B_01.03/B_02.03/B_03.x/B_04.01/
B_07.01/B_99.01 şablonları (kurucunun bu tur listesi yalnız 5 yapı — third_
parties/fourth_parties/critical_business_services/kimlik/hizmet türü —
kapsıyordu, bunların doğrudan karşılığı olmayan şablonlar dahil edilmedi),
SoD `sod_import_rollbacklari` INSERT-bypass'ı (ayrı görev olarak işaretli,
§0).
