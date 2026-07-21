# ADR — Dikey F, F3: Onaylı Etki Toleransının Test Paketinde Görünürlüğü

**Tarih:** 21 Temmuz 2026
**Durum:** KABUL EDİLDİ (kurucu Seçenek A kararı, bu belgede yansıtılıyor)

## 1. Bağlam

`impact_tolerances` (M13, `20260719040000_critical_service.sql`) kuruluşundan
beri hiçbir yerde tüketilmiyordu — F1 Karar 5 ve F2'nin kendi ADR'si bu
bağlamayı iki kez erteledi. Bu grep sweep beşinci ertelemeyi (M13 kuruluşu,
Dikey C, Dikey D ×2, F1, F2) doğruladı — hepsi AYNI gerekçeyle: "sayı
uydurulmaz."

**Kritik teknik gerçek:** `test_runs` şemasında yapılandırılmış, karşılaştırılabilir
bir kesinti-süresi veya veri-kaybı alanı YOK. `RESTORE_TEST` bile diğer her
test türüyle AYNI genel `iddiaKarsilandi: boolean` mantığıyla değerlendiriliyor.
`baslangic_at`/`bitis_at` testin ÇALIŞTIRILMA anını gösterir, restore süresini
DEĞİL. Bu yüzden "RTO karşılandı" gibi bir NİCEL hüküm üretmek, ölçülmeyen bir
şeyi ölçülmüş gibi göstermek olurdu (kural 11 ihlali).

Ayrıca üç AYRI, birbirinden kopuk RTO/RPO yüzeyi tespit edildi:
1. `impact_tolerances` — saat cinsinden, versiyonlu, yönetim onaylı, KULLANILMIYOR.
2. M8 `scenario_scoring_rules.parametreler.dakika` — dakika cinsinden, senaryo
   yazarının serbestçe yazdığı bir sayı (ROADMAP'in kendi notu: "zaten
   uydurulmuş bir sayı").
3. `yk-beyani.ts` — legacy elle-giriş saat, emekliye ayrılıyor.

Birim bile tutmuyor (saat vs dakika). F3 yalnız (1)'i, F2 paketine BAĞLAR —
(2) ve (3)'e dokunulmaz.

## 2. Karar — Seçenek A: sığ fakat dürüst bağlama

Onaylı etki toleransının VARLIĞI ve HEDEF DEĞERLERİ paket/UI/Proof Room'da
gösterilir. **Nicel karşılaştırma YAPILMAZ** — "RTO karşılandı"/"tolerans
içinde"/yüzdesel başarı/sayısal güven skoru gibi hiçbir ifade üretilmez.
`karsilastirmaYapildi` alanı HER ZAMAN `false` — bu, motorun kendi kendini
denetleyen bir dürüstlük bayrağıdır.

## 3. Beş durum sınıfı

```
TOLERANS_TANIMLI_VE_ONAYLI      -- YURURLUKTE tek kayıt, en az bir hedef dolu
TOLERANS_TANIMLI_FAKAT_ONAYSIZ  -- yalnız TASLAK var, YURURLUKTE yok
TOLERANS_BULUNAMADI             -- hiç kayıt yok (ne TASLAK ne YURURLUKTE)
TOLERANS_VERISI_EKSIK           -- YURURLUKTE kayıt var ama RTO VE RPO ikisi de null
BIRDEN_FAZLA_AKTIF_TOLERANS     -- savunma amaçlı: DB'nin unique partial index'i
                                    (`impact_tolerances_tek_yururlukte`) bunu
                                    yapısal olarak İMKANSIZ kılıyor, ama motor
                                    yine de bu olasılığı ele alır (uydurulmuş
                                    bir seçim yapmadan)
```

`NULL` sıfır değildir — RTO dolu/RPO boş olabilir, ayrı gösterilir.

## 4. Veri alanı adı düzeltmesi

Kurucunun taslak sözleşmesi `validFrom`/`validUntil` alanı öneriyordu — grep
sweep bu alanların `impact_tolerances`'ta VAR OLMADIĞINI doğruladı (bu alanlar
`assessment_finding_compensating_controls`'a ait, farklı bir tablo). Gerçek
şema yalnız `onay_zamani` (onay anı) ve `durum` (TASLAK/YURURLUKTE/SUPERSEDED)
taşıyor — ayrı bir "geçerlilik bitiş" alanı yok (versiyon+supersede modeli
buna ihtiyaç duymuyor: bir sürüm YENİ bir sürüm onaylanana kadar YURURLUKTE
kalır). Veri sözleşmesi buna göre uyarlandı: `validFrom`/`validUntil` yerine
`onayZamani` kullanıldı.

## 5. Kimlik minimizasyonu

`onaylayan` ham UUID olarak DÖNMEZ — `onaylayanBelirtildi: boolean` (F1'in
`hazirlayanBelirtildi`/`sorumluBelirtildi` deseninin AYNISI). Gerekçe: paket
nesnesi DOĞRUDAN Proof Room'a mühürlenip döndürülüyor — motor çıktısı zaten
Proof-Room-güvenli olmalı, okuma anında ayrıca filtrelemeye güvenilmemeli.
Mevcut `/kritik-hizmetler/[id]` UI'ı da onaylayan kimliğini hiç göstermiyor —
kayıp bir işlevsellik yok.

## 6. Schema V1→V2

`KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1` → `V2`. V1 sabiti KORUNUYOR (F1'in
V2/V3 deseni) — eski kayıtlar okunabilir kalır, yeniden hash'lenmez. Yeni alan
(`etkiToleransiOzeti`) TS arayüzünde OPSİYONEL — eski V1 JSON'da bu alan
olmadığından UI/Proof Room "bu sürümde bilgi yok" ile savunmacı okur.

## 7. Genel paket durumuna etki

Onaylı tolerans varlığı DOGRULANMIS'i tetiklemez; yokluğu ENGELLENDI üretmez.
Yalnız ONAYSIZ TASLAK veya (yapısal olarak imkansız ama savunmacı ele alınan)
ÇAKIŞMA durumu gerekçelere eklenir ve mevcut sonuç DOGRULANMIS ise INCELEME_
GEREKLI'ye düşürülür — worst-of ilkesinin doğal uzantısı, yeni bir politika
icat edilmedi.

## 7.1. Proof Room: yeni migration GEREKMEDİ

F2'nin beşinci dalı (`proof_room_goruntule`, `20260721020000`) mühürlenmiş
`paket` JSONB'sini OLDUĞU GİBİ döndürüyor. F3'te `etkiToleransiOzeti` motor
tarafından `paket` payload'ının İÇİNE mühürlendiği için (ve tür gereği zaten
Proof-Room-güvenli: `onaylayanBelirtildi` boolean, ham onaylayan UUID'si YOK;
`toleranceId` bir kullanıcı değil bir artifact kimliği — `testRunId` gibi),
minimize özet mevcut dönüşün İÇİNDE saydam biçimde taşınır. Altıncı dal
açılmadı, RPC forward-fix'i GEREKMEDİ (ADR §13 "gerekebilir" koşuluydu — bu
dilimde koşul gerçekleşmedi). V1 snapshot'ta `paket.etkiToleransiOzeti` YOK
(undefined) — Proof Room sayfası bu yokluğu "bu snapshot sürümünde etki
toleransı bilgisi bulunmamaktadır" ile savunmacı okur, güncel DB'den
zenginleştirme YAPILMAZ (snapshot ile ilişkisel veri karışmaz).

## 8. Bilinçli kapsam dışı

`test_runs`'a yeni ölçüm alanı, RTO/RPO karşılaştırma motoru, M8 scoring
entegrasyonu, dakika/saat normalizasyonu, yeni cron, yeni test türü, eski
snapshot backfill'i, `yk-beyani.ts` taşıma. Gerçek nicel bağlama AYRI bir
gelecek dilim — önce ölçüm veri sözleşmesi kurulmalı, karşılaştırma motoru
ancak ondan sonra.
