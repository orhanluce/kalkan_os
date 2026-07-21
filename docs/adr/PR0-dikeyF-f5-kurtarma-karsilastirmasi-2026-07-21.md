# ADR — Dikey F, F5: Kurtarma Ölçümü ile Onaylı Etki Toleransının Güvenli Karşılaştırılması

**Tarih:** 21 Temmuz 2026
**Durum:** KABUL EDİLDİ (kurucu "Kararlarım" — bu belge onları yansıtır)

## 1. Bağlam

F3: onaylı etki toleransı (`impact_tolerances`) test paketine bağlandı, **nicel
karşılaştırma yapılmadı** (`karsilastirmaYapildi:false`). F4: gerçek ölçülen
kurtarma verisi (`test_run_recovery_measurements`) güvenilir/immutable/kanıtlı
kaydedildi, **yine karşılaştırma yok**. F5 bu ikisini karşılaştırır.

F5'in temel sorusu yalnız matematik değildir: **hangi F4 ölçümü, hangi F3
tolerans sürümüyle, hangi güvenilirlik seviyesinde karşılaştırılabilir?**

## 2. Ön koşul düzeltmeleri (F5'ten ÖNCE, bu dilimde tamamlandı)

Grep sweep üç gerçek açık buldu; hepsi F5'ten önce kapatıldı:

**A) `impact_tolerances.superseded_at`** (migration `20260721050000`): yalnız
`onay_zamani` ile "ölçüm anında yürürlükte olan sürüm" sorgusu iki garanti
edilmeyen varsayıma dayanırdı (monoton aktivasyon, süprese anının dolaylı
çıkarımı). Emsal: `applicability_decisions` bitemporal deseni. Yeni sürüm
YURURLUKTE olduğunda önceki sürümün `superseded_at`'i SUNUCU tarafında
otomatik dolar (istemcinin iki-UPDATE akışının atomiklik riski ortadan
kalkar). Sınır semantiği: `onay_zamani` DAHİL, `superseded_at` HARİÇ.
`impact_tolerance_asof(critical_service_id, as_of)` saf SQL fonksiyonu bu
sorguyu tek yerde cevaplar; belirsizlikte (aday yok) `null` döner.

**Backfill:** canlı veri incelendi — `impact_tolerances` TEK satır (tek sürüm,
hiç süprese edilmemiş). **Geriye dönük zincir YOK, backfill gerekmedi.** Bu,
sessizce atlanmış bir adım değil, ölçülmüş bir sonuçtur.

**B) Güncel TRRM sorgusu merkezileştirildi** (migration `20260721070000`):
`test_run_kurtarma_olcumu_guncel(test_run_id, tenant_id)` — dört durumlu
sözleşme (`GUNCEL_KAYIT_VAR`/`KAYIT_YOK`/`BIRDEN_FAZLA_GUNCEL_KAYIT`/
`ZINCIR_HATASI`), `ORDER BY ... LIMIT 1` YASAK (kurucu kararı: "en yeni kayıt"
ile "geçerli supersede yaprağı" aynı şey değildir). Hem route hem Proof Room
ARTIK AYNI fonksiyonu çağırıyor — üçüncü bir kopya (F5) böylece önlendi.
`ZINCIR_HATASI` savunmacıdır (F3'ün `BIRDEN_FAZLA_AKTIF_TOLERANS` deseniyle
aynı) — `trrm_tenant_guard` bunu yapısal olarak zaten engelliyor, PGlite'ta
gerçek bir INSERT ile üretilemediği için ayrıca test edilmedi.

**C) `measured_at` yaşam döngüsü** (migration `20260721060000` + motor +
route + UI): canlıda doğrulanan gerçek bug — UI hiç `measured_at`
göndermiyordu, route sessizce `recorded_at`'e düşürüyordu. Artık: kesinti
olay zamanları varsa `measured_at = hizmet_geri_geldi_at` (SUNUCU türetir,
UI alanı GİZLER); yalnız veri-kaybı varsa veya süre-yalnız beyanda `measured_
at` UI'da AÇIK VE ZORUNLU alan. DB CHECK (`NOT VALID` — canlıdaki tek F4
debris kaydı bilinçli istisna, silinmedi/düzeltilmedi çünkü tablo immutable):
gelecek zaman reddi (5 dk tolerans) + olay-penceresi tutarlılığı. Motor
katmanında da AYNI iki kural (savunma derinliği).

## 3. F5 kapsamı (kesin)

Tek görev: **belirli bir F4 ölçüm kaydı ile ölçüm anında yürürlükte olan
onaylı F3 tolerans sürümü arasında immutable, kaynakları açık bir
karşılaştırma artefaktı üretmek.**

F2/F3 Kritik Hizmet Test Paketi **BU AŞAMADA DEĞİŞTİRİLMEZ** — paket
motoruna sızma AYRI bir sonraki dilim (**Dikey F5.1**): en güncel geçerli
karşılaştırmanın seçimi, RTO/RPO sonuçlarının paket görünümüne eklenmesi,
genel paket durumuna etkisi, yeni paket şema sürümü, Proof Room paket
görünümü — hepsi F5.1'de karara bağlanacak.

## 4. Karşılaştırma artefaktı: `test_run_recovery_comparisons`

Ayrı, immutable tablo. Sabit FK'ler: `test_run_id`, `recovery_measurement_id`,
`impact_tolerance_id`, `critical_service_id`, `tenant_id`. **Tolerans eşikleri
snapshot'a MÜHÜRLENİR** (yalnız FK bırakılmaz) — tolerans sonradan yeni
sürümle süprese edilse bile tarihsel sonuç yeniden üretilebilir kalır.

RTO ve RPO **BAĞIMSIZ** değerlendirilir, beş durum:
```
KARSILADI | ASTI | OLCUM_YOK | TOLERANS_YOK | KARSILASTIRILAMAZ
```
Emsal: `execution_legal_snapshots` deseni (test_run'a FK'li, tekil-yaprak) —
ama TRRM'nin kendi append-only+supersede zincirini miras alır (ölçüm veya
tolerans süprese edilirse karşılaştırma da yeni kayıtla süprese edilir, eski
kayıt tarihsel artefakt olarak kalır).

## 5. Güvenilirlik dili

`OTOMATIK_OLCUM`: "Ölçülen değer hedefi karşıladı/aştı" — YALNIZ provenance +
zorunlu kanıt şartları geçerliyse. `MANUEL_BEYAN`: matematiksel sonuç
hesaplanır AMA "Beyan edilen değer hedefin içinde/hedefi aşıyor" dili
kullanılır — **"RTO karşılandı" gibi kaynağı gizleyen kesin ifade YASAK.**

## 6. Ledger ayrımı

Ledger/JWS durumu matematiksel sonucu DEĞİŞTİRMEZ — ayrı boyutlar: ölçüm
kaynağı güvenilirliği, artefakt bütünlük durumu, nicel karşılaştırma sonucu.
Ledger henüz anchor edilmemişse matematik yine hesaplanır, ayrıca "Bütünlük
kaydı henüz anchor edilmedi" uyarısı gösterilir.

## 7. Proof Room

Mevcut `test_run_id` dalına ilişkisel ek (F4'ün yaptığı gibi) — **altıncı
polimorfik hedef açılmaz.**

## 8. Bilinçli kapsam dışı

F2/F3 paket entegrasyonu (→ F5.1), gerçek OTOMATIK_OLCUM connector'ı, cross-
tenant kritik-hizmet eşleşme genişletmesi (F5'in kendi cross-tenant guard'ı
zaten aynı kritik hizmete bağlılığı zorunlu kılar).
