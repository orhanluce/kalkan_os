# ADR — Dikey F, F1: M12 Test Manifestinin Tamamlanması, Kritik Hizmet/Senaryo Bağı, Bağımsız Bulgu Kapanışı

Tarih: 20 Temmuz 2026. Durum: KABUL EDİLDİ (kurucu onayı, 5 karar + 2 mimari düzeltme).

## 1. Bağlam

Dikey F analiz raporu (bu oturumun önceki turu), grep sweep ile şu gerçeği ortaya
çıkardı: M12'nin "standart test/tatbikat manifesti" (nihai talimat v3.3 §8.0
Dikey 2, migration `20260719180000`, `src/lib/kontrol-test-ledger.ts`) **zaten
canlıda ve olgun**. ROADMAP §1.43 kendi "sonraki dilim" notunu bırakmıştı:
"manifeste bulgu/retest referansı + tatbikat (simülasyon) koşularına da V2
manifest." Dikey F talimatı bağımsız olarak AYNI ihtiyacı tarif etti. Kurucu,
analiz raporunu onayladı ama uygulama öncesi İKİ mimari düzeltme zorunlu kıldı:

1. Test-run manifesti mühürlendikten SONRA doğan `findingId`, o immutable
   manifestin İÇİNE sonradan yazılamaz (zamanlama uyuşmazlığı — bulgu, koşudan
   SONRA, insan kararıyla doğar).
2. Yeni FK kolonlarında (`critical_service_id`) sıradan bir `references`
   yeterli değildir — tenant bütünlüğü DB seviyesinde AYRICA zorlanmalı
   (composite FK / constraint trigger / guard).

## 2. Karar

Yeni bir test motoru veya "test programı/kampanya" tablosu KURULMAZ. Mevcut
M12 çekirdeği (`control_test_definitions`/`test_runs`/`control_test_finding_
proposals`/`findings`) dar biçimde tamamlanır:

1. `control_test_definitions`'a **opsiyonel** `critical_service_id`/
   `scenario_template_id` FK — mevcut serbest metin (`kritik_hizmet_adi`/
   `senaryo_kimligi`) KALIR, silinmez, otomatik eşleştirilmez.
2. `finding_verified_closure_guard`'a bağımsız-doğrulayan kontrolü
   (forward-fix — `create or replace`, önceki migration dosyasına dokunulmaz).
3. `ControlTestRunManifest` **V3**'e yükseltilir: `retestOfFindingId` (yalnız
   sunucu/DB kaynaklı, oluşturma anında BİLİNİYORSA), `criticalServiceId`,
   `scenarioTemplateId`. **`findingId` manifestin İÇİNE HİÇ eklenmez** — bkz.
   §3.
4. `impact-graph.ts`'e tek yeni kenar: `BULGU_RETEST` (BULGU → mevcut TEST
   düğümü, `findings.kapatma_retest_run_id`'den).
5. `proof_room_goruntule()`'un `test_run_id` dalına V2/V3 manifest alanları +
   ilişkisel bulgu/retest bağlantıları eklenir (manifest MUTASYONA
   UĞRAMADAN — RPC okuma anında ilişkisel sorgudan türetir).

## 3. Neden `findingId` manifestin içine yazılmıyor (zamanlama düzeltmesi)

Yaşam döngüsü doğrulandı (`src/app/api/kontrol-test/oneri/[oneriId]/route.ts`):

```
FAILED test_run (INSERT, manifest o anda mühürlenebilir hale gelir)
  → control_test_finding_proposals (PROPOSED, test_run_id ile 1:1)
    → insan KABUL kararı (AYRI bir istek, dakikalar/günler sonra olabilir)
      → findings INSERT + control_test_finding_proposals.finding_id/karar_veren UPDATE
```

`test_runs` append-only'dir (UPDATE/DELETE authenticated/anon'dan revoke) —
bu INVARIANT'ın ta kendisi `findingId`'nin test_run'a/manifeste SONRADAN
yazılmasını YAPISAL OLARAK engelliyor: manifest, koşu anında zaten var olan
verilerden (tanım+koşu) türer; bulgu henüz YOKTUR. "Manifesti bulgu kabul
edilince zenginleştirme" seçeneği DEĞERLENDİRİLDİ ve REDDEDİLDİ — bu,
immutable bir artefaktı sessizce mutasyona uğratmak (veya yeniden hash'lemek)
olurdu, kural 11/15'in doğrudan ihlali.

**Seçilen çözüm — ayrımı koru (kurucunun kendi önerisi, doğrudan uygulandı):**
- **test_run → bulgu** ilişkisi: `control_test_finding_proposals.test_run_id`
  + `.finding_id` üzerinden HER ZAMAN ilişkisel sorguyla türetilir (Proof
  Room, UI, impact graph). Manifestin bir PARÇASI değildir.
- **retest → hedef bulgu** ilişkisi: `retestOfFindingId` — YALNIZCA retest
  koşusu OLUŞTURULURKEN gerçekten biliniyorsa (kullanıcı hangi bulguyu
  kapatmak için bu koşuyu çalıştırdığını route'ta BELİRTİRSE) manifestin
  İÇİNE yazılır — çünkü bu bilgi koşu anında zaten mevcuttur (tıpkı
  `beklenenSonuc`/`hazirlayan` gibi, sonradan eklenmiyor, doğuşta biliniyor).
  İstemciden gelen değere KÖR GÜVENİLMEZ — route, hedef bulgunun (a) aynı
  tenant'a ait olduğunu ve (b) gerçekten `acik` + `retest_gerekli` olduğunu
  DB'den doğrular, yalnız o zaman manifest alanına yazar.
- **bulgu kapanış → retest** ilişkisi: `findings.kapatma_retest_run_id` (ZATEN
  var, kural 14 guard'ı zaten kanıtlıyor) — tarihsel kapanış kaynağı olarak
  KALIR, hiçbir mutasyon gerekmez.

Bu üç ilişki BİRLİKTE, manifесti hiç mutasyona uğratmadan, Proof Room/UI/graf
üzerinde TAM zinciri (`test → proposal → finding → retest → closure`) gösterir.

## 4. Manifest şema sürümü: V2 → V3 (byte-level tarama sonucu)

`CONTROL_TEST_RUN_MANIFEST_SCHEMA`'nın repo'daki TÜM tüketicileri tarandı:
yalnız `kontrol-test-ledger.ts` (tanım) ve `ledger-outbox.ts` (dispatch anında
YENİDEN hesaplar, dondurulmuş bir şekle KİLİTLİ değil). Hiçbir bağımsız
byte-seviyesi doğrulama CLI'ı (M9'un `verify-paket.ts`'i gibi) bu şemaya
kilitli değil. `ledger-manifests.test.ts`'teki testler yalnız GÖRECELİ hash
karşılaştırması yapıyor (`h1 !== h2` / `h1 === h2`), hiçbir SABİT/altın hash
string'i assert etmiyor — yani yeni zorunlu alan eklemek mevcut testleri
KIRMAZ (yalnız test fixture'ının `base` nesnesi güncellenir).

**Karar: V3'e yükselt** (`KALKAN_CONTROL_TEST_RUN_MANIFEST_V3`). Gerekçe:
payload şekli GERÇEKTEN değişiyor (3 yeni zorunlu-ama-nullable alan); kurucunun
kendi kriteri "Schema adı ve sürümü payload gerçekliğini yansıtacak" — V2 adı
artık payload'ı DOĞRU yansıtmaz. Eski V2 kayıtları SONSUZA DEK V2 kalır,
yeniden hesaplanmaz. Bu, `cloud-assurance.ts`'nin `@1`→`@2` bump'ının (Dikey
E2) AYNI deseni.

## 5. Manifest hash Proof Room'da gösterilmiyor — bilinçli teknik sınır

Kurucunun aday alan listesi "manifest hash"i içeriyordu. Doğrulandı:
manifest hash'i (RFC 8785 kanonik SHA-256) yalnız **TypeScript**'te
(`canonical.ts`) hesaplanıyor ve `ledger-outbox.ts` dispatch anında ON-DEMAND
üretiliyor — **hiçbir DB kolonunda KALICI olarak saklanmıyor**. `proof_room_
goruntule()` salt bir plpgsql fonksiyonu; RFC 8785 kanonikleştirmesi SQL'de
YOK. Bu nedenle:
- Manifest hash'i Proof Room payload'ına EKLENMEDİ (uydurmak yerine
  ATLANDI — kurucunun kendi "teknik engel varsa raporla, tahmin yapma"
  ilkesi).
- Bunun yerine `semaSurumu` (sabit string, `V2`/`V3`) VE zaten var olan
  `ledgerDurumu` (`artifact_ledger_durumu('test_runs', ...)`, mühürlenip
  mühürlenmediğini kanıtlıyor) gösterilir — ikisi birlikte "bu koşunun
  manifesti mühürlü, hangi şekilde" sorusunu dürüstçe cevaplar, hash DEĞERİNİ
  UYDURMADAN.
- Kalıcı hash saklama (yeni `test_runs.manifest_hash` kolonu) F1'in
  onaylanmış 5 maddelik kapsamının DIŞINDA — ayrı bir kurucu kararı
  gerektirir (bkz. §14 bilinçli kapsam dışı).

## 6. Tenant bütünlüğü — `critical_service_id` vs `scenario_template_id`

- `critical_business_services`: **tenant-scoped** (`tenant_id` kolonu var, RLS
  `current_tenant_id()` ile sınırlı). Sıradan `references` cross-tenant'ı
  ENGELLEMEZ (A kiracısı, B'nin kritik hizmetinin UUID'sini bilirse
  bağlayabilir — FK yalnız "satır var mı" der, "hangi kiracıya ait" demez).
  **BEFORE INSERT OR UPDATE constraint trigger** eklenir: `new.critical_
  service_id` doluysa, o satırın `tenant_id`'si `new.tenant_id` ile eşleşmeli,
  aksi halde reddedilir. `security definer`, `service_role` dahil atlanamaz
  (Dikey E2'nin `proof_room_link_target_guard()`/Dikey E1'in cross-tenant
  guard'larının AYNI deseni).
- `scenario_templates`: **tenant'a ait DEĞİL** (global kütüphane, `controls`/
  `frameworks` ile AYNI desen — `tenant_id` kolonu yok, RLS `for select using
  (true)`). Bu FK için tenant guard'a GEREK YOK — `control_id`'nin zaten
  hiçbir tenant kontrolü olmadan `controls`'a bağlanmasıyla AYNI durum.
  Kurucunun kendi talimatı bu ayrımı önceden tarif etmişti ("Global katalog
  ise tenant guard uydurma") — doğrulanan gerçeklik tam olarak budur.

## 7. Bağımsız bulgu kapanışı — güvenilir `karar_veren` ilişkisi

Yaşam döngüsü doğrulandı (`/api/kontrol-test/oneri/[oneriId]/route.ts`):
KABUL anında `findings` INSERT'i ve `control_test_finding_proposals.finding_
id`/`karar_veren` UPDATE'i AYNI istekte, `karar_veren = oturum sahibi` (asla
istemciden okunmaz). Öneri `durum='PROPOSED'` DIŞINDAYSA rota 409 döner —
yani bir öneri EN FAZLA BİR KEZ bir bulguya `finding_id` atar. Bu ilişki
GÜVENİLİR: `select karar_veren from control_test_finding_proposals where
finding_id = <bulgu.id>`.

Watertight hâle getirmek için forward-fix migration'a EK bir güvence:
`create unique index ... on control_test_finding_proposals (finding_id)
where finding_id is not null` — DB seviyesinde "bir bulguya en fazla bir
öneri bağlanabilir" garantisi (bugüne dek yalnız uygulama akışıyla doğruydu,
şimdi ŞEMADA da zorlanıyor).

Guard mantığı (yalnız `kaynak='kontrol_testi'` VE eşleşen bir öneri VARSA
uygulanır — diğer kaynaklarda [`sizma_testi`/`denetim`/`ic_tespit`/
`simulasyon`] "kabul eden" kavramı YOK, guard onları ETKİLEMEZ, sessizce
atlar, sahte bir kısıtlama İCAT ETMEZ):

```
acik -> kapali geçişinde (retest_gerekli dalının İÇİNDE, mevcut kontrollerden
SONRA):
  select karar_veren into v_karar_veren
  from control_test_finding_proposals where finding_id = new.id;
  if v_karar_veren is not null and new.kapatan = v_karar_veren then
    raise exception '... oneriyi kabul eden kisi kendi bulgusunu kapatamaz ...';
  end if;
```

Mevcut BEŞ kontrol (retest PASSED + doğru tanım + bulgudan sonra + kapatan
dolu + kapatan oturum sahibi) DEĞİŞMİYOR, yalnız ALTINCI bir kontrol EKLENİYOR.

## 8. Alternatifler (reddedilen)

- **Yeni "test programı" tablosu ilk dilimde:** REDDEDİLDİ (kurucu Karar 2) —
  F2'ye ertelendi.
- **M9/M12 manifest birleştirmesi:** REDDEDİLDİ (kurucu Karar 3) — iki ayrı
  olgun sistem kendi domain'inde kalır.
- **M17 örnekleme köprüsü:** REDDEDİLDİ (kurucu Karar 4) — ayrı dilim.
- **RTO/RPO/impact_tolerance bağlama:** REDDEDİLDİ (kurucu Karar 5) — ayrı
  dilim, sayı uydurulmaz.
- **`kritik_hizmet_adi`/`senaryo_kimligi`'yi ad eşleştirerek otomatik
  bağlamak:** REDDEDİLDİ — yazım benzerliğinden FK üretmek sahte bir ilişki
  iddiası olurdu (kural 11). Yeni kayıtlar İLERİ dönük gerçek seçiciyle
  bağlanır; eski kayıtlar serbest metin olarak KALIR, "doğrulanmamış" olarak
  etiketlenir.
- **Manifest hash'i persist etmek (yeni kolon):** ERTELENDİ — F1'in 5
  maddelik kapsamı dışında, ayrı kurucu kararı gerektirir (bkz. §5, §14).

## 9. Veri sahipliği / RLS / audit

Tüm değişiklikler mevcut `tenant_id`-scoped tablolar İÇİNDE (yeni tablo yok).
RLS politikaları değişmiyor (yeni kolonlar aynı satırın parçası, aynı
politika kapsıyor). Audit: `finding_verified_closure_guard` DEĞİŞİKLİĞİ audit_
log'a ayrı bir olay TÜRÜ eklemiyor (kapanış zaten mevcut `findings` UPDATE
audit izini bırakıyor — güvenlik testleri REDDİ kanıtlıyor, başarıyı değil).

## 10. Bilinçli kapsam dışı (kurucunun 5 kararı + bu ADR'nin kendi bulguları)

Test programı/kampanya tablosu; M17 örnekleme köprüsü; M9/M12 manifest
birleştirmesi; RTO/RPO/impact_tolerance bağlama; yeni test sonucu durumu;
yeni expiry cron'u; TLPT/saldırı/pentest; yeni connector; AI ile sonuç
kararı; SCITT yeniden tasarımı; eski manifestlerin yeniden hash'lenmesi;
bulgu kabulü sonrası manifest mutasyonu; **manifest hash'inin kalıcı
saklanması** (§5 — teknik olarak mümkün ama F1 kapsamı dışı, RFC 8785'in
SQL'de yeniden implementasyonu YA DA yeni bir persist kolonu gerektirir).
