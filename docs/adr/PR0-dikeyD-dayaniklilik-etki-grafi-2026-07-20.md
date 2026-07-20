# PR-0 — Dikey D: Kurumsal Dayanıklılık ve Kritik Hizmet Bağımlılık Grafiği, ilk dilim (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz sekizinci talimatı. Amaç: mevzuat, kritik
hizmet, ICT hizmeti, üçüncü taraf, alt yüklenici, kontrol, test, bulgu ve
kanıt arasındaki zincirleme etkiyi hesaplayabilmek. Yeni paralel varlık/
tedarikçi/kritik-hizmet modeli KURULMAYACAK.

## 0. Önce mevcut yapı — TAM grep sweep

Bu talimat sanıldığından DAHA AZ boş alan buluyor: **Dikey 5 (nihai talimat
v3.3 §8.0) zaten kritik-hizmet grafının önemli bir kısmını inşa etmiş.**
Okunanlar:

- `supabase/migrations/20260719040000_critical_service.sql` (M13):
  `critical_business_services`, `impact_tolerances` (sürümlü+yönetim onaylı),
  `service_dependencies` (kritik hizmet → SİSTEM/EKİP/TESİS/TEDARİKÇİ/BULUT,
  `third_party_id` opsiyonel, `tekil_nokta` bayrağı).
- `supabase/migrations/20260719210000_resilience_taxonomy.sql` (Dikey 5):
  `control_resilience_domains` (kontrol → 8 üst alan, dört-göz, global
  katalog) + `critical_service_controls` (kritik hizmet → kontrol kenarı,
  tenant'a özgü).
- `supabase/migrations/20260720120000_dikeyB_faz2_kalan_...sql` (Dikey B):
  `third_party_contract_critical_services` (sözleşme ↔ kritik-fonksiyon,
  DORA RoI B_02.02.0050 kökenli) — `third_party_contracts.ict_hizmet_turu_kod`
  ile ZATEN ICT hizmet türüne bağlı.
- `src/lib/dayaniklilik.ts` (M13 `tekilNoktaAnalizi`), `src/lib/tedarikci.ts`
  (M35 `konsantrasyonAnalizi`), `src/lib/etki-analizi.ts` (Dikey 5:
  `zincirlemeEtkiYollari`, `enCokKritikHizmetEtkileyenKontroller`,
  `iyilestirmeOnceligiSirala`, `dayaniklilikKapsamOzeti`) — hepsi SAF, kural
  11 (deterministik), TEK SAHTE SKOR YOK ilkesiyle yazılmış.
- `src/app/(app)/dayaniklilik/page.tsx` (399 satır) — bu üç motoru birleştiren
  çalışan bir ekran zaten var (`e2e/dayaniklilik.spec.ts` yeşil).
- `obligation_control_mappings` (M21, mevzuat→kontrol), `control_test_
  definitions`/`test_runs` (M12, kontrol→test→sonuç→kanıt), `findings`
  (M2, `kaynak_test_definition_id` ile teste bağlı, `20260717240000`),
  `evidences` (M2, `hash_sha256`).

**Sonuç: KURULACAK yeni bir "graf DB'si" yok — kenarların HEPSİ zaten var,**
dağınık. Bu dilimin gerçek işi: (1) bu dağınık kenarları TEK bir kanonik
düğüm/kenar projeksiyonuna birleştiren saf bir motor, (2) bu motorun ürettiği
grafta tam-graf tek-nokta tespiti + gerçek çok-atlamalı (multi-hop) etki
yayılımı (mevcut fonksiyonlar tek-atlamalı ya da tek-domain), (3) bu
projeksiyonun MÜHÜRLENMİŞ, hash'li bir Proof Room artefaktı olarak
paylaşılabilmesi (mevcut hiçbir şey bunu yapmıyor).

## 1. Kapsam — ilk dilim (bilinçli sınır)

**Düğüm türleri:** `KRITIK_HIZMET`, `BAGIMLILIK` (service_dependencies'in
SİSTEM/EKİP/TESİS/BULUT satırları — literal ad, ayrı bir varlık modeli
DEĞİL), `UCUNCU_TARAF`, `ALT_YUKLENICI` (fourth_parties; `bilinmiyor=true`
→ `BILINMIYOR` düğümü, ad UYDURULMAZ), `ICT_HIZMETI`, `KONTROL`, `MEVZUAT`
(obligations.kod), `TEST` (control_test_definitions), `BULGU` (findings),
`KANIT` (evidences, yalnız test_runs.evidence_id üzerinden ulaşılabilenler).

**Kenar türleri (hepsi MEVCUT bir tablodan türer, hiçbiri yeni ilişki
modeli DEĞİL):**
1. `KRITIK_HIZMET → BAGIMLILIK` — `service_dependencies` (third_party_id
   NULL olan satırlar; `tekil_nokta` meta olarak taşınır).
2. `KRITIK_HIZMET → UCUNCU_TARAF` — `third_party_contract_critical_services`
   ⋈ `third_party_contracts.third_party_id` (Dikey B'nin yapılandırılmış
   kaynağı; `service_dependencies.third_party_id`'den DAHA hassas — o da
   AYRICA taşınır, iki kaynak birleşmez, kenar `kaynak` alanıyla etiketlenir).
3. `UCUNCU_TARAF → ALT_YUKLENICI` — `fourth_parties`.
4. `UCUNCU_TARAF → ICT_HIZMETI` — `third_party_contracts.ict_hizmet_turu_kod`
   (sözleşme düzeyi bu dilimde AYRI düğüm değil — vendor→ICT-türü özetlenmiş
   görünüm; sözleşme granülerliği bilinçli sonraki dilim).
5. `KRITIK_HIZMET → KONTROL` — `critical_service_controls`.
6. `MEVZUAT → KONTROL` — `obligation_control_mappings` ⋈ `obligations.kod`
   (yükümlülük kontrolü karşılar yönü; `REJECTED` eşleme graf DIŞI, mevcut
   `proof_room_goruntule`'un AYNI filtresi).
7. `KONTROL → TEST` — `control_test_definitions`.
8. `TEST → BULGU` — `findings.kaynak_test_definition_id`.
9. `TEST → KANIT` — `test_runs` (test tanımı başına EN GÜNCEL `calisti_at`,
   `evidence_id` doluysa).

**Kapsam dışı (bilinçli, sonraki dilim):** sözleşme-düzeyi düğüm, RTO/RPO
zenginleştirmesi, interaktif düğüm-seçerek-yayılım UI'ı (bu dilim otomatik
olarak AÇIK kritik/yüksek bulguların kontrollerinden başlayan yayılımı
hesaplar — kurucunun "kontrol/bulgu etkisinin yayılımı" maddesi budur),
29 alt kategori.

## 2. Saf motor (`src/lib/impact-graph.ts`) — YENİ, iki mevcut motorun ÜSTÜNE

- `etkiGrafiProjekteEt(girdi)`: yukarıdaki 9 kenar kaynağını (çağıran DB'den
  çeker, motor SAF kalır) tek bir `{dugumler, kenarlar}` yapısına birleştirir.
  Sıra HER ZAMAN `tur+id`'ye göre deterministik (kural 11). `BILINMIYOR`
  düğümü (ad null) asla gerçek bir ada dönüştürülmez.
- **BAGIMLILIK düğüm kimliği NORMALİZE ADDIR, satır id'si DEĞİL**
  (`tekilNoktaAnalizi`'nin — M13 — birebir kuralı: `ad.trim().toLowerCase()`).
  İlk taslak satır id'si kullanıyordu — bu, aynı fiziksel bağımlılığı temsil
  eden İKİ AYRI `service_dependencies` satırını (iki farklı kritik hizmete
  ait) İKİ AYRI düğüme dönüştürüp paylaşımı GÖRÜNMEZ kılıyordu (SPOF
  tespitinin asıl amacının kendisini kırardı) — unit testte yakalanıp
  düzeltildi, canlıya gitmeden.
- `tekNoktaTespitiTamGraf(dugumler, kenarlar)`: `tekilNoktaAnalizi` (M13) ve
  `konsantrasyonAnalizi` (M35) İKİ AYRI fonksiyondu — bu motor onları
  ÇAĞIRMAZ/TEKRARLAMAZ, birleşik graf üzerinde TEK bir traversal ile AYNI
  ilkeyi (≥2 farklı KRITIK_HIZMET'in paylaştığı herhangi bir düğüm = sistemik
  tekil nokta) tüm düğüm türlerine (BAGIMLILIK/UCUNCU_TARAF/ALT_YUKLENICI/
  ICT_HIZMETI) genelleştirir — gerçek yeni mantık (var olanın kopyası değil).
- `etkiYayilimi(baslangicDugumIdleri, dugumler, kenarlar)`: BFS, ziyaret
  edilmiş küme ile döngü koruması, HER sonuç düğümü hangi hop'ta ve hangi
  yol üzerinden ulaşıldığını taşır (açıklanabilirlik — kural: "hesaplama
  yöntemi ayrı gösterilmeli"). Girdi: AÇIK kritik/yüksek bulgulu testlerin
  KONTROL düğümleri (kurucunun "kontrol/bulgu etkisinin yayılımı" maddesi).
- **Kesinlik uydurma YOK:** motorun döndürdüğü her sonuç nesnesi
  `hesaplamaYontemi` (sabit açıklama string'i) taşır; UI/API bunu "AI kesin
  sonucu" gibi DEĞİL "yapısal erişilebilirlik hesaplaması" olarak gösterir.
  Eksik/kopuk veri `BILINMIYOR` kalır, bağlantı asla varsayılmaz.

## 3. Mühürlü artefakt — `impact_graph_snapshots` (YENİ tablo, tenant'a özgü)

`roi_export_runs`'ın mühürleme deseninin (Faz 3) AYNISI ama maker-checker
YOK — bu bir UYUM İDDİASI değil, DETERMİNİSTİK BİR HESAPLAMANIN fotoğrafı
(assurance_claims/roi_export_runs'ın "kesin hüküm" sorunuyla karışmaz).
Kolonlar: `graf` (jsonb, dugumler+kenarlar), `graf_hash` (RFC 8785),
`spof_raporu` (jsonb), `yayilim_raporu` (jsonb), `hesaplama_yontemi` (jsonb —
motor sürümü + varsayımlar), `olusturan`, `created_at`,
`iliskili_roi_export_run_id` (opsiyonel FK — DORA export bağlantısı, §5).
**Immutable by design:** UPDATE/DELETE policy YOK (RLS varsayılan-red) —
audit_log'un AYNI ilkesi, guard trigger'ına GEREK YOK çünkü zaten hiçbir
yazma yolu açılmıyor.

## 4. Proof Room genişlemesi — üçüncü dal

`proof_room_links.graph_snapshot_id` (nullable FK) eklenir; "tek hedef"
CHECK kısıtı ÜÇE genişler (test_run_id / roi_export_run_id /
graph_snapshot_id — TAM OLARAK biri dolu). `proof_room_goruntule` RPC'si
(GÜNCEL sürüm — grep doğrulandı, `20260720180000`, bu OTURUMUN kendi Faz 4
işi — TEMEL ALINACAK) yeni bir dal alır: `graphSnapshot` — `graf_hash`,
`spof_raporu` (zaten minimize, ham iddia YOK), `hesaplama_yontemi`,
`iliskiliRoiExportId` (varsa). Ham düğüm/kenar içeriği (`graf` tam objesi)
DE dönebilir çünkü zaten hiçbir hassas serbest metin taşımıyor (yalnız
kimlik/ad/tur alanları — assurance_claims'in `iddia_metni`/`guven_gerekcesi`
gibi ham gerekçe metni YOK burada, kural farklı: minimize edilecek bir şey
yok).

## 5. DORA export bağlantısı

`roi_export_runs`'a DOKUNULMAZ (guard'ı zaten Faz 4'te iki kez düzeltildi,
üçüncü bir CREATE OR REPLACE riski gereksiz). Bağlantı TERS yönde:
`impact_graph_snapshots.iliskili_roi_export_run_id` — bir anlık görüntü
isteğe bağlı olarak "bu export'un B_06.01 kritik fonksiyonlarına dair
dayanıklılık haritası budur" diyebilir. Trigger, dolu ise AYNI tenant'a ait
olduğunu doğrular (cross-tenant sızıntı guard'ı).

## 6. Kurallar (talimatın kendi listesi, motor+UI'da nasıl uygulanır)

- **"AI sonucu kesin gerçek olarak gösterilmemeli":** SPOF/yayılım sonuçları
  UI'da "Yapısal hesaplama (§ hesaplama yöntemi)" etiketiyle gösterilir,
  "doğrulanmış gerçek" ifadesi hiçbir yerde kullanılmaz.
- **"Varsayım, kaynak, kanıt ve hesaplama yöntemi ayrı gösterilmeli":** her
  snapshot'ın `hesaplama_yontemi` alanı ayrı bir UI bölümünde render edilir.
- **"Eksik veri bilinmiyor kalmalı":** `fourth_parties.bilinmiyor` deseni
  (M35) BİREBİR uygulanır — motor asla eksik veriyi "bağlantı yok" ya da
  varsayılan bir adla doldurmaz.

## 7. Kapsam dışı (talimatın kendi listesi + bu ADR'nin eklediği)

Yeni tedarikçi/kritik-hizmet modeli, sözleşme-düzeyi graf granülerliği,
29 alt kategori, RTO/RPO ölçüm bağlama, interaktif düğüm-seçerek-sorgu UI'ı
(otomatik açık-bulgu bazlı yayılım bu dilimde yeterli).
