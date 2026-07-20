# 37 Tez Gap Map (KOS-1..11)

**Kaynak:** `docs/arastirma/KALKAN_OS_37_Tez_Nihai_Uygulama_Talimati_2026.md`
§3. Bu doküman koddan/migration'lardan ÖLÇÜLDÜ (19 Temmuz 2026) — tahmin
değil. Numaralandırma: KOS-N etiketleri yeni modül numarası DEĞİLDİR, mevcut
M-numaralarına eşlemedir (bkz. `docs/adr/PR0-37-tez-kesif-2026-07-19.md` §3).

Durum sözlüğü: **TAM** (kullanıcı sonucu uçtan uca teslim + test edilmiş) ·
**KISMİ** (bir kısmı var, belgelenmiş açık madde var) · **YOK** (hiç kod yok)
· **DIŞ KARAR** (kurucu/hukuk/altyapı kararı bekliyor, bilinçli açık) ·
**KAYNAK BEKLİYOR** (şema hazırlanabilir ama doğrulanmış içerik kaynağı yok).

---

## KOS-1 — Regülasyon ve uygulanabilirlik grafiği

- **Modül/Gate:** M11 (kanıt çekirdeği) + provisions/obligations (V2 PR-4b) + M14 (`applicability_decisions`) + Proof Room (G1) + M24 (sitasyon paketi).
- **Dosyalar:** `supabase/migrations/2026071819*` (provisions/obligations/applicability/legal-basis), `src/lib/applicability.ts`, `src/lib/legal-basis.ts`, `src/lib/citation-bundle.ts`, `/regulasyon/*`, `/proof/[token]`.
- **Durum: TAM (mühendislik tarafı) — G1 içerik kapanışı DIŞ KARAR.**
- **Eksik kullanıcı sonucu:** zincirin kendisi (kaynak→hüküm→uygulanabilirlik→kontrol/test→kanıt→proof) çalışıyor ve test edilmiş; eksik olan ≥20 uzman doğrulamalı SPK/7545 kontrolü + ≥5 gerçek test tanımı içeriği — bu bir mühendislik borcu değil, K8 hukuk doğrulayıcı teslimi (CLAUDE.md "G1 durumu").
- **Gerekli şema/RLS/invariant:** yok — mevcut.
- **Mevzuat/kaynak statüsü:** mekanizma VERIFIED disiplinini zaten uyguluyor (TODO_DOGRULA→LEGAL_REVIEW→VERIFIED, dogrulayan≠incelemeye_alan); içerik doldurulmadı.
- **Önerilen dikey:** yok (kod tarafı kapalı) — kurucudan içerik/K8 hukuk kapısı bekleniyor.
- **Kabul testi:** zaten var (uygulanabilirlik.spec.ts, legal-basis.spec.ts, proof-room.spec.ts, kontrol-test-manifest.spec.ts).

## KOS-2 — Kritik hizmet ve dayanıklılık grafiği

- **Modül/Gate:** M13 (`critical_business_services`/`impact_tolerances`/`service_dependencies`) + Dikey 5 (M21/M42, `control_resilience_domains`/`critical_service_controls`) + **Dikey D ilk dilim ✅ (§1.65, 20 Temmuz) — birleşik etki grafı projeksiyonu + mühürlü snapshot + Proof Room bağlantısı.**
- **Dosyalar:** `20260719040000_critical_service.sql`, `20260719210000_resilience_taxonomy.sql`, `20260720200000_impact_graph_snapshots.sql`, `20260720210000_proof_room_graph_snapshot_dali.sql`, `src/lib/impact-graph.ts`, `/kritik-hizmetler`, `/dayaniklilik`.
- **Durum: KISMİ → İLERLEDİ (çok-hoplu birleşik graf + SPOF + yayılım VAR; süreç/varlık/uygulama ayrı varlık tipleri hâlâ YOK).**
- **Dikey D'nin kapattığı boşluk:** artık kritik hizmet → bağımlılık/üçüncü-taraf/kontrol → mevzuat/test → bulgu/kanıt TEK bir kanonik grafta (`etkiGrafiProjekteEt`), ÇOK-ATLAMALI SPOF tespiti (`tekNoktaTespitiTamGraf` — `tekilNoktaAnalizi`+`konsantrasyonAnalizi`'nin ilkesini tüm düğüm türlerine genelleştirir) ve otomatik yayılım (`etkiYayilimi`, açık kritik/yüksek bulgulu kontrollerden başlar) VAR. Sonuç mühürlü bir Proof Room artefaktı (`impact_graph_snapshots`, immutable).
- **Hâlâ eksik kullanıcı sonucu:** "süreç"/"varlık"/"uygulama/altyapı"/"veri"/"kişi/tesis" AYRI varlık tipleri olarak modellenmedi (bugün tek `BAGIMLILIK` düğüm türü, `service_dependencies.bagimlilik_turu` etiketiyle); sözleşme-düzeyi graf granülerliği yok (vendor→ICT-hizmet-türü özetlenmiş); RTO/RPO ile GERÇEK test sonucu (tatbikat, M7-M9) arasında fark raporu yok; interaktif düğüm-seçerek-sorgu UI'ı yok (yayılım şimdilik yalnız otomatik, açık-bulgu tetiklemeli).
- **Mevzuat/kaynak statüsü:** 8 üst alan THESIS_DERIVED zaten VERIFIED disiplininde; **29 alt kategori KAYNAK BEKLİYOR** (talimat §4 Dikey G alt bölümü, kaynak repo'da yok — uydurulmayacak, aynen CLAUDE.md kararı).
- **Önerilen dikey:** Dikey D sonraki dilim — süreç/varlık/uygulama ayrı düğüm tipleri (self-referencing çok-hoplu zincir), sözleşme-düzeyi granülerlik, RTO/RPO-gerçek-test farkı, interaktif sorgu; 29 kategori KAYNAK_BEKLİYOR olarak şemada yer tutar, seed edilmez.
- **Kabul testi:** dayaniklilik.spec.ts genişledi (SPOF tespiti + Proof Room anlık görüntü akışı) — sonraki dilimde yeni kenar tipi + fark raporu için TEKRAR genişler.

## KOS-3 — Kontrol/test/kanıt motoru

- **Modül/Gate:** M2 (kanıt) + M11 (v2 kanıt çekirdeği) + M12 (kontrol test motoru + durum makinesi + V2 manifest).
- **Durum: TAM.** Failed≠Unknown≠Stale≠Exception, append-only kanıt+audit, verified-closure guard, freshness cron, V2 manifest + ledger otomatik mühür — hepsi canlıda kanıtlı.
- **Eksik kullanıcı sonucu:** yok — bu talimatın kendisi de bu motoru "yeniden kullan, ikinci motor kurma" diye referans veriyor (Dikey A, C, vb.).
- **Önerilen dikey:** yok.

## KOS-4 — Kurumsal yönetişim ve politika yaşam döngüsü

- **Modül/Gate:** politikalar (madde→bağla→incele→dört-göz onay→yürürlük), M10 (YK Beyanı — şema+motor var, **UI yok**), M38 (regülatör).
- **Durum: KISMİ.**
- **Eksik kullanıcı sonucu:** YK Beyanı ekranı yok (`scripts/generate-yk-beyani.ts` hâlâ mock-data okuyor — CLAUDE.md açık borç); AI Governance Board maddesi (talimat Dikey E) henüz hiçbir yerde.
- **Gerekli şema/RLS/invariant:** `board_declarations` zaten var (§1.42'de ledger'a bağlandı) — UI eksik, yeni şema gerekmiyor.
- **Önerilen dikey:** ayrı bir "M10 UI" dikeyi (bu talimatın Dikey A-K sırasında AÇIKÇA yok — talimat listesine dahil değil, mevcut backlog'ta kalır).
- **Kabul testi:** yeni e2e (henüz yok).

## KOS-5 — AI Assurance ve AI Act motoru

- **Modül/Gate:** M37 (`ai_systems`/`ai_agents`/`ai_execution_receipts`) + Dikey 4 (rich lineage + drift) + Dikey 4 kalanı (segment drift + rollback + ISO 42001↔27001 crosswalk) + AI olay/eval (§1.36).
- **Durum: KISMİ (çekirdek TAM, kenar maddeler eksik).**
- **Eksik kullanıcı sonucu (talimat §4 Dikey E listesi karşı repo):**
  - AI envanteri + rol + risk sınıfı + FRIA/DPIA bağı: **VAR** (`ai_systems.dpia_assessment_id`).
  - İnsan gözetimi/override/kill-switch: **VAR**.
  - Drift/performance/fairness eval: **KISMİ** — drift/segment VAR (Dikey 4 kalanı); **fairness/adalet YOK** (bkz. KOS-6).
  - Ciddi olay + bildirim saati: **VAR** (§1.38).
  - Geri alma/rollback: **VAR** (Dikey 4 kalanı).
  - **AI Governance Board (toplantı+karar+muhalefet+aksiyon grafına bağ): YOK.**
  - **Tedarik AI sözleşmelerinin KOS-8'e (M35) bağı: YOK** — `third_party_contracts`'ta AI'a özgü madde (veri kullanımı/model değişikliği/alt sağlayıcı/açıklama/olay bildirimi) alanı yok.
- **Gerekli şema/RLS/invariant:** `ai_systems` ↔ `third_party_contracts` opsiyonel FK (bir AI sistemi bir tedarikçi sözleşmesinden geliyorsa); AI Governance Board = `board_declarations`'ın AI'a özgü genişlemesi (yeni tablo değil, mevcut deseni genişlet).
- **Önerilen dikey:** talimatın Dikey E'si — bu oturumda YAPILMIYOR (yalnız Dikey A).
- **Kabul testi:** ai-guvence.spec.ts / ai-drift-rollback-crosswalk.spec.ts genişler.

## KOS-6 — Açıklama, adalet ve itiraz

- **Modül/Gate:** yok.
- **Durum: YOK.** (`grep`: `explanation_bundle`/`fairness`/`adalet`/`itiraz`/`xai` kod tabanında AI/hukuk bağlamında hiçbir yerde yok; yalnız genel "gerekce" alanları var, talimatın istediği yapılandırılmış ExplanationBundle/adalet taraması/itiraz iş akışı hiç kurulmadı.)
- **Eksik kullanıcı sonucu:** üç ayrı artefakt (teknik/iş sahibi/etkilenen kişi açıklaması), hassas-grup/proxy taraması, itiraz SLA'sı — hiçbiri yok.
- **Gerekli şema/RLS/invariant:** yeni `explanation_bundles` + `fairness_assessments` + `appeals` tabloları (tenant'a özgü, AI sistemine FK).
- **Mevzuat/kaynak statüsü:** talimat §4 Dikey D kendisi "SFIX/S-SFIX akademik çerçevesini doğrudan kopyalama, önce bağımsız replikasyon/ADR" diyor — **DIŞ KARAR** (bağımsız değerlendirme + lisans/IP ADR'si olmadan başlanmaz).
- **Önerilen dikey:** talimatın Dikey D'si — bu oturumda YAPILMIYOR.
- **Kabul testi:** yeni e2e (henüz yok).

## KOS-7 — Model Claim Guard ve Eval Sicili

- **Modül/Gate:** M37 AI eval/veri-soyağacı (§1.39) kısmen temel taşıyor; **§1.59 (20 Temmuz) genel amaçlı bir Claim Guard TESLİM ETTİ** — `assurance_claims` + `src/lib/claim-guard.ts` + `/guvence`.
- **Durum: KISMİ (genel iddia güvencesi VAR; ML-eval'e ÖZGÜ dar kapsam HÂLÂ YOK — dürüst not aşağıda).**
- **Kapsam notu (dürüstçe):** kurucunun 20 Temmuz talimatı Dikey C'yi bu bölümün ORİJİNAL tarifinden (M37 AI eval sicili + 11 ML-spesifik otomatik guard) daha GENİŞ bir soruya yöneltti — "AI/kural motorunun ürettiği HERHANGİ BİR uyum/risk/kontrol/mevzuat iddiası" (yalnız ML eval değil). `assurance_claims` bu genel soruyu çözer: kaynak+kanıt+dört-göz+staleness+çatışma görünürlüğü. **Bu bölümün orijinal dar hedefi (manifest amaç/split/ablation/kalibrasyon/dış doğrulama + 11 otomatik guard: look-ahead sızıntısı, split-öncesi SMOTE, vb.) HÂLÂ YOK** — `ai_eval_manifests`/`claim_guard_results` (PASSED/FAILED/UNKNOWN/NOT_APPLICABLE, kural 13) inşa edilmedi. Kurucu isterse bu ayrı, dar bir dilim olarak açılabilir; `assurance_claims`'in `kaynak_obligation_id`/`hedef_tablo`/`hedef_id` polimorfik yapısı gerekirse bir `ai_evaluations` satırını da hedef alabilir (yeniden kullanılabilir), ama ML-spesifik 11 guard kuralı KENDİ motorunu ister.
- **Gerekli şema/RLS/invariant (kalan dar kapsam için):** `ai_eval_manifests` (M37'nin mevcut eval tablosunu GENİŞLETİR) + `claim_guard_results`.
- **Önerilen dikey:** genel Claim Guard ✅ TAMAMLANDI (§1.59, 20 Temmuz) → ML-eval-özgü dar dilim kurucu onayı beklerse ayrı bir dikey.
- **Kabul testi:** `claim-guard.test.ts` (19) + `rls-assurance-claims.test.ts` (21) + `guvence.spec.ts` e2e (mevcut, §1.59) — ML-özgü 11 guard kuralı testi HÂLÂ YOK.

## KOS-8 — Üçüncü taraf, bulut ve AI tedarik zinciri

- **Modül/Gate:** M35 (`third_parties`/services/fourth_parties/contracts/exit_plans`) + M35 sonraki dilim (anket/değerlendirme/bulgu, §1.35) + Cloud Assurance Pack (§1.44 — **anket şablonu** biçiminde 11 bulut kategorisi) + **vendor-portal dış erişim (§1.54, salt-okur) + Dikey A (§1.56 ✅ TAMAMLANDI 19 Temmuz — anket YANITLAMA, token sertleştirme, durum makinesi, kurum incelemesi)**.
- **Durum: KISMİ (çekirdek + anket + portal + yanıtlama TAM; yapılandırılmış envanter alanları anket-metni seviyesinde, ayrı structured tablo değil — Dikey B'nin resmi şeması bekliyor).**
- **Eksik kullanıcı sonucu:** talimatın istediği bulut hizmet envanteri/ortak sorumluluk matrisi/IAM/merkezi log/DDoS testi bugün **serbest metin anket sorusu** olarak var (kategori etiketli), YAPILANDIRILMIŞ alan (ör. `rto_saat integer`, `ddos_test_tarihi date`) değil — bu bilinçli bir tasarım (kural 3: soru/cevap içeriği tenant girdisi, KALKAN_OS şema uydurmaz), talimat bunu yapılandırılmış istiyor ama hangi alanların "resmî" olduğu (DORA RoI şemasına bakılmadan) UYDURULAMAZ → **kısmen KAYNAK BEKLİYOR** (Dikey B'nin resmî şeması gelince yapılandırılabilir).
- **Gerekli şema/RLS/invariant:** Dikey A (bu oturum) mevcut. Dikey B (DORA RoI) resmi şema geldiğinde yapılandırılmış alanları ekler.
- **Önerilen dikey:** Dikey A ✅ TAMAMLANDI (§1.56) → Dikey B keşfi ✅ (§1.57) →
  ilk migration dilimi ✅ (§1.58) → Faz 1+2-ilk-dilim ✅ (§1.60) → Faz 2-kalan
  ✅ (§1.61) → Faz 3 ilk dilim ✅ (§1.62, motor+şema+API — HTTP doğrulanmamış)
  → **§1.63 (20 Temmuz): Faz 3 kalan dilimi ✅ — gerçek HTTP+UI+e2e, CSV/XLSX
  serileştirme (jszip ile elle yazılmış OOXML, yeni bağımlılık yok), Proof
  Room kablolaması.** Bu turda `proof_room_goruntule` RPC'sinin bir önceki
  forward-fix'i (`ledgerDurumu` alanı) yanlışlıkla geri alınmış, TAM e2e
  koşusu yakalamış ve aynı turda düzeltilmiştir (§1.63 detayı). **DORA RoI
  export motoru (Faz 1-3) artık uçtan uca çalışır durumda: veri modeli →
  export üretimi → maker-checker onay → CSV/XLSX indirme → Proof Room
  paylaşımı.** → **§1.64 (20 Temmuz): Faz 4 ✅ — alan bazlı kanıt zinciri
  (provenance).** Her export alanı, INSERT anında mühürlenen bir provenance
  raporuna sahip: kaynak durumu (`roi_kaynak_kayitlari`/`ict_service_types`)
  + ilişkili `assurance_claims`'in EN KÖTÜSÜ — kanıtsız/doğrulanmamış alan
  YAPISAL OLARAK VERIFIED gösterilemez. SCITT deftere `ROI_EXPORT_PUBLISHED`
  olarak bağlandı (ledgerDurumu canlı hesaplanır, sahte ANCHORED yok);
  kaynak sonradan düşerse export `yeniden_inceleme_gerekli` işaretlenir
  (durum geriye dönük değişmez). Proof Room'a minimize provenance özeti +
  ledgerDurumu eklendi. **37 Tez Dikey B (Faz 1-4) artık TAM: hukuk/kaynak
  kilidi → veri modeli → export motoru → kanıt zinciri.** Sıradaki adım
  kurucu kararını bekliyor (Dikey H/D/E/F/G gibi bağımsız bir sıradaki
  dikey, ya da M17/M18/M19+ — M16 kapı disiplini korunuyor).
- **Kabul testi:** tedarikciler.spec.ts + tedarikci-degerlendirme.spec.ts + tedarikci-anket-sablonu.spec.ts + tedarikci-signoff-ledger.spec.ts (mevcut) + bu oturumun yeni testleri.

## KOS-9 — Harici sinyal, tehdit, fraud ve AML güvencesi

- **Modül/Gate:** yok.
- **Durum: YOK** (`grep`: `external_observation`/`threat_intel`/`fraud_signal`/`aml_signal` hiçbir yerde yok).
- **Eksik kullanıcı sonucu:** ortak `ExternalObservation` sözleşmesi yok; harici sinyalden bulgu/inceleme tetikleme akışı yok.
- **Gerekli şema/RLS/invariant:** yeni `external_observations` (kaynak/URL/lisans/güven derecesi/içerik hash'i/eşleştirme güveni/insan doğrulaması) — kural 8 (otomatik suç isnadı/yaptırım YASAK, yalnız gözlem+inceleme tetikleyicisi).
- **Mevzuat/kaynak statüsü:** kavramsal sözleşme kurulabilir ama gerçek connector/veri kaynağı **DIŞ KARAR**.
- **Önerilen dikey:** talimatın Dikey I'sı — bu oturumda YAPILMIYOR.
- **Kabul testi:** yeni birim+e2e.

## KOS-10 — AI/ESG fayda iddiası güvencesi

- **Modül/Gate:** yok.
- **Durum: YOK** (`grep`: `esg`/`emisyon`/`karbon` sıfır eşleşme).
- **Eksik kullanıcı sonucu:** baz çizgi/ölçüm yöntemi/bağımsız onay şeması yok. **KOS-7'nin genel guard motoru artık VAR** (§1.59, `assurance_claims`+`claim-guard.ts`) — bu blokör kalktı; kalan iş yalnız ESG'ye özgü alanlar (baz çizgi/dönem/yöntem/belirsizlik).
- **Gerekli şema/RLS/invariant:** yeni `esg_claims` (baz çizgi, dönem, yöntem, belirsizlik) — `assurance_claims`'in polimorfik `hedef_tablo`/`hedef_id` + dört-göz + çatışma-görünürlüğü altyapısını YENİDEN KULLANABİLİR (kural 1), tamamen yeni bir guard gerekmeyebilir.
- **Önerilen dikey:** talimatın Dikey J'si — KOS-7 (Dikey C) TAMAMLANDI (§1.59), bu artık başlanabilir durumda; bu oturumda YAPILMIYOR.
- **Kabul testi:** yeni birim+e2e.

## KOS-11 — Mahremiyet-koruyucu hesaplama laboratuvarı

- **Modül/Gate:** yok.
- **Durum: YOK** (`grep`: `fhe`/`smpc`/`zkp`/`tee` sıfır gerçek eşleşme).
- **Eksik kullanıcı sonucu:** talimat kendisi bunu P0/P1 kapıları kapanmadan ve gerçek iş ihtiyacı seçilmeden BAŞLATMAMAYI emrediyor (§4 Dikey K).
- **Gerekli şema/RLS/invariant:** yok (henüz).
- **Önerilen dikey:** talimatın Dikey K'sı — **DIŞ KARAR + kapı** (P0/P1 kapanmadan başlanmaz). Bu oturumda YAPILMIYOR, uzun vadede en son sıra.
- **Kabul testi:** yok (henüz).

---

## Özet tablo

| KOS | Ad | Durum | Bu turdaki iş |
|---|---|---|---|
| 1 | Regülasyon/uygulanabilirlik | TAM (mühendislik) | Yok — K8 hukuk içeriği bekliyor |
| 2 | Dayanıklılık grafiği | KISMİ | Yok (Dikey G, sonraki) |
| 3 | Kontrol/test/kanıt | TAM | Yok |
| 4 | Yönetişim/politika | KISMİ | Yok (M10 UI, backlog'ta) |
| 5 | AI Assurance | KISMİ | Yok (Dikey E, sonraki) |
| 6 | Açıklama/adalet/itiraz | YOK | Yok (Dikey D, DIŞ KARAR bekliyor) |
| 7 | Model Claim Guard | KISMİ | **Dikey C ✅ TAMAMLANDI (§1.59 — genel iddia güvencesi: kaynak+kanıt+dört-göz+staleness+çatışma); ML-eval'e özgü dar kapsam (manifest+11 guard) hâlâ yok** |
| 8 | 3.taraf/bulut/AI tedarik | KISMİ | **Dikey A ✅ TAMAMLANDI (§1.56); Dikey B keşif ✅ (§1.57) + ilk migration dilimi ✅ (§1.58 — kurum kimlik+kaynak kataloğu, içerik seed'i yok)** |
| 9 | Harici sinyal/tehdit | YOK | Yok (Dikey I, sonraki) |
| 10 | AI/ESG fayda iddiası | YOK | Yok (Dikey J, KOS-7 sonrası) |
| 11 | Gizlilik-koruyucu hesaplama | YOK | Yok (Dikey K, en son + kapı) |

**Bu oturumda tek iş: Dikey A (KOS-8 tamamlama — tedarikçi anket yanıtlama).**
Ayrıntı: `docs/adr/PR0-37-tez-kesif-2026-07-19.md`.
