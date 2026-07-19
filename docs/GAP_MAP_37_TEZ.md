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

- **Modül/Gate:** M13 (`critical_business_services`/`impact_tolerances`/`service_dependencies`) + Dikey 5 (M21/M42, `control_resilience_domains`/`critical_service_controls`) + `src/lib/etki-analizi.ts`.
- **Dosyalar:** `20260719040000_critical_service.sql`, `20260719210000_resilience_taxonomy.sql`, `/kritik-hizmetler`, `/dayaniklilik`.
- **Durum: KISMİ.**
- **Eksik kullanıcı sonucu:** talimatın istediği tam zincir — kritik hizmet → **süreç** → **varlık** → **uygulama/altyapı** → **veri** → **kişi/tesis** → tedarikçi → kontrol/test — bugün TEK SEVİYE bir kenar: `service_dependencies.bagimlilik_turu` (SISTEM/EKIP/TESIS/TEDARIKCI/BULUT, düz metin `ad`, opsiyonel `third_party_id`). Çok-hoplu (multi-hop) graf yok; "süreç"/"varlık"/"uygulama" ayrı varlık tipleri olarak modellenmedi. Kapasite/kurtarma senaryosu bağı yok (simülasyon M7-M9 ile bağlanmadı).
- **Gerekli şema/RLS/invariant:** `service_dependencies`'i tip-bazlı ayrı tablolara bölmeden (kural: paralel graf kurma) kenar tipini genişletmek — yeni bir `depends_on` self-referencing kenar (bagimlilik→bagimlilik) ile çok-hoplu zincir; RTO/RPO ile GERÇEK test sonucu (kontrol testi/tatbikat) arasında fark raporu.
- **Mevzuat/kaynak statüsü:** 8 üst alan THESIS_DERIVED zaten VERIFIED disiplininde; **29 alt kategori KAYNAK BEKLİYOR** (talimat §4 Dikey G alt bölümü, kaynak repo'da yok — uydurulmayacak, aynen CLAUDE.md kararı).
- **Önerilen dikey:** Dikey G (bu talimatın sırasında Dikey A'dan SONRA) — çok-hoplu zincir + RTO/RPO-gerçek-test farkı; 29 kategori KAYNAK_BEKLİYOR olarak şemada yer tutar, seed edilmez.
- **Kabul testi:** dayaniklilik.spec.ts genişler (yeni kenar tipi + fark raporu).

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

- **Modül/Gate:** M37 AI eval/veri-soyağacı (§1.39) kısmen temel taşıyor; Claim Guard'ın kendisi yok.
- **Durum: YOK** (`grep`: `claim.guard`/`model.claim` hiçbir dosyada yok).
- **Eksik kullanıcı sonucu:** manifest (amaç/split/ablation/kalibrasyon/dış doğrulama) yok; 11 otomatik guard (look-ahead sızıntısı, split-öncesi SMOTE, vb.) yok.
- **Gerekli şema/RLS/invariant:** `ai_eval_manifests` (yeni, M37'nin mevcut eval tablosunu GENİŞLETİR — ayrı paralel motor kurulmaz, talimat açıkça uyarıyor) + `claim_guard_results` (PASSED/FAILED/UNKNOWN/NOT_APPLICABLE, kural 13 desenin aynısı).
- **Önerilen dikey:** talimatın Dikey C'si — bu oturumda YAPILMIYOR.
- **Kabul testi:** yeni birim (11 guard kuralı, deterministik) + e2e.

## KOS-8 — Üçüncü taraf, bulut ve AI tedarik zinciri

- **Modül/Gate:** M35 (`third_parties`/services/fourth_parties/contracts/exit_plans`) + M35 sonraki dilim (anket/değerlendirme/bulgu, §1.35) + Cloud Assurance Pack (§1.44 — **anket şablonu** biçiminde 11 bulut kategorisi) + **vendor-portal dış erişim (§1.54, salt-okur) + Dikey A (§1.56 ✅ TAMAMLANDI 19 Temmuz — anket YANITLAMA, token sertleştirme, durum makinesi, kurum incelemesi)**.
- **Durum: KISMİ (çekirdek + anket + portal + yanıtlama TAM; yapılandırılmış envanter alanları anket-metni seviyesinde, ayrı structured tablo değil — Dikey B'nin resmi şeması bekliyor).**
- **Eksik kullanıcı sonucu:** talimatın istediği bulut hizmet envanteri/ortak sorumluluk matrisi/IAM/merkezi log/DDoS testi bugün **serbest metin anket sorusu** olarak var (kategori etiketli), YAPILANDIRILMIŞ alan (ör. `rto_saat integer`, `ddos_test_tarihi date`) değil — bu bilinçli bir tasarım (kural 3: soru/cevap içeriği tenant girdisi, KALKAN_OS şema uydurmaz), talimat bunu yapılandırılmış istiyor ama hangi alanların "resmî" olduğu (DORA RoI şemasına bakılmadan) UYDURULAMAZ → **kısmen KAYNAK BEKLİYOR** (Dikey B'nin resmî şeması gelince yapılandırılabilir).
- **Gerekli şema/RLS/invariant:** Dikey A (bu oturum) mevcut. Dikey B (DORA RoI) resmi şema geldiğinde yapılandırılmış alanları ekler.
- **Önerilen dikey:** Dikey A ✅ TAMAMLANDI (§1.56) → **Dikey B keşfi BİTTİ, kod YOK** (§1.57 — kaynak özeti `docs/arastirma/DORA_RoI_ITS_2024_2956_Kaynak_Ozeti.md` + mapping ADR `docs/adr/PR0-37-tez-dikeyB-roi-mapping-2026-07-19.md`; en büyük boşluk: `tenants`'ta LEI/EUID/yasal kimlik hiç yok) → Dikey H (KOS-8 kalanı, bu oturumda YAPILMIYOR).
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
- **Eksik kullanıcı sonucu:** baz çizgi/ölçüm yöntemi/bağımsız onay şeması yok; Claim Guard'a (KOS-7) bağlı olması gerekiyor — KOS-7'den önce anlamlı başlanamaz.
- **Gerekli şema/RLS/invariant:** yeni `esg_claims` (baz çizgi, dönem, yöntem, belirsizlik, bağımsız onay) — KOS-7'nin guard motoru üzerine.
- **Önerilen dikey:** talimatın Dikey J'si — KOS-7 (Dikey C) TAMAMLANMADAN anlamlı değil; bu oturumda YAPILMIYOR.
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
| 7 | Model Claim Guard | YOK | Yok (Dikey C, sonraki) |
| 8 | 3.taraf/bulut/AI tedarik | KISMİ | **Dikey A ✅ TAMAMLANDI (§1.56); Dikey B keşif ✅ (§1.57) + ilk migration dilimi ✅ (§1.58 — kurum kimlik+kaynak kataloğu, içerik seed'i yok)** |
| 9 | Harici sinyal/tehdit | YOK | Yok (Dikey I, sonraki) |
| 10 | AI/ESG fayda iddiası | YOK | Yok (Dikey J, KOS-7 sonrası) |
| 11 | Gizlilik-koruyucu hesaplama | YOK | Yok (Dikey K, en son + kapı) |

**Bu oturumda tek iş: Dikey A (KOS-8 tamamlama — tedarikçi anket yanıtlama).**
Ayrıntı: `docs/adr/PR0-37-tez-kesif-2026-07-19.md`.
