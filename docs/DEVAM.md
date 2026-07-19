# DEVAM TALİMATI — kaldığın yerden sürdür (18 Temmuz 2026 gece güncellemesi 2)

Bu dosya oturumlar arası devir içindir. **Kurucu kalıcı onay verdi:
"her bitişte onaya gerek yok, V2 PR sırasının SONUNA KADAR devam."** Her PR'ı
doğrula → commit → push → deploy health kontrol, duraksamadan sonrakine geç.

## 0. İLK İŞ (her yeni oturumun başında)
Yeşil taban doğrula (körlemesine güvenme):
```
pnpm check        # typecheck + lint + vitest  (beklenen: ~789 birim, 0 skip)
pnpm e2e          # gerçek Chromium            (beklenen: ~34 e2e, 0 skip)
cmd /c "pnpm build 2>&1"   # exit 0
curl.exe -s https://blue-yak-865668.hostingersite.com/health/ready  # hazir/erisilebilir
```
Bu üçlü 18 Temmuz gece oturumunda TAM koşuldu ve yeşildi (742→782 birim,
33 e2e, build exit 0). Kırmızı çıkarsa önce onu düzelt.

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

## 0c. GERÇEK DURUM (19 Temmuz — Dikey 5 + Dikey 4 kalanı + M17 §1.29 TAMAMEN KAPANDI)
- **Remote (origin/main) HEAD:** `ec73851` (§1.51: M17 sonraki dilim madde 4/4
  SON — WORM export → §1.29 KAPANDI) + DEVAM SHA commit'i.
  Öncesi `8eb3517` (§1.50: madde 3/4 — formal independence bağı),
  `8618a64` (§1.49: madde 2/4 — PBC/request), `b73f51d`
  (§1.48: M17 sonraki dilim madde 1/4 — workpaper→bulgu/kontrol bağı),
  `c3320aa`/`4200c75` (§1.47: Dikey 4 kalanı — segment drift + insan override +
  model rollback + ISO 42001↔27001 crosswalk), `c44a954`/`b074bbc` (Dikey 5:
  M21/M42 dayanıklılık taksonomisi + etki grafiği, §1.46), `91efb68`
  (Dikey 4: AI veri/model güvence), `15831b9` (Dikey 3: bulut paketi), `e73fd20`
  (Dikey 2: M12 V2 manifest), `5df9176` (Dikey 1: G3 defter kapsamı), `b6283bc`
  (M38 toplantı), `65767b7` (M35 anket şablonu), `2e5efea` (AI eval soyağacı),
  `4007aad` (AI olay bildirim saati), `7c548e6` (transactional outbox → SCITT),
  `88df93e` (M37 AI olay/eval), `be073f3` (M35 değerlendirme), `2a40eca` (M36
  DSAR), `94e4748` (G3 tutarlılık), `ed62f49` (G3 SCITT), `64d9a35` (G8/M40).
  Push edilmemiş commit YOK.
- **Deploy health:** `/health/ready` → `{"durum":"hazir","supabase":"erisilebilir"}`.
- **Test tabanı: 1067 birim (106 dosya) + 58 e2e, 0 skip; build exit 0.**
  (Bu oturumda tam takım ALTI kez uçtan uca yeşil koşuldu — `tema.spec` dahil
  hiçbir izole-flake tekrarlamadı. Yol boyunca iki gerçek e2e çakışması
  yakalandı ve düzeltildi (bkz. §1.49/§1.50 notları). AYRICA: `.next` dizini
  bir noktada bozuldu (`pnpm check`/`pnpm build` tsc'de anlamsız hata verdi —
  kod DEĞİL, dev sunucusunun eşzamanlı yazdığı stale bir type-validator
  dosyası); `rm -rf .next` ile temizlenip yeniden koşuldu, temiz geçti — kayıt
  için: bu sınıf hata görülürse önce `.next`'i temizle.)
- Migration sırası son: `20260719260000_audit_worm_exports.sql` (canlıda,
  guard'lar gerçek Supabase'e karşı smoke ile doğrulandı — PGlite≠Supabase
  disiplini korundu).
- **E2E LEDGER TEMİZLİK KURALI (kayıt için):** kontrol testleri artık auto-anchor
  ediyor → `artifact_ledger_links` entries'e ON DELETE RESTRICT'li. Ledger'a
  dokunan HER e2e spec temizliğinde links+outbox ÖNCE silinmeli (yoksa toplu
  entry-delete sessizce başarısız olur, paylaşımlı E2E kiracısında birikir).
  seffaflik/proof-room/dsar/tedarikci-signoff/kontrol-test-manifest hepsi bu
  sıraya uyar.
- **Dikey 5 ilk yarı BİTTİ** (ROADMAP §1.46): M21/M42 dayanıklılık taksonomisi
  (`control_resilience_domains`, GLOBAL katalog, 8 üst alan check-kısıtlı,
  obligations dört-göz deseninin AYNISI — VERIFIED seed YOK) + etki grafiği
  (`critical_service_controls`, M13 grafının kontrol kenarıyla genişlemesi;
  saf motor `src/lib/etki-analizi.ts`: zincirleme etki yolu, en çok kritik
  hizmet etkileyen kontrol, 8-alan kapsam özeti, açıklanabilir iyileştirme
  önceliği — TEK SAHTE SKOR YOK). UI `/dayaniklilik` + `/kritik-hizmetler/[id]`
  "Koruyan kontroller" kartı. Testler: rls-resilience 12 + etki-analizi 10 saf +
  `dayaniklilik.spec.ts` e2e (iki-kullanıcı dört-göz, regulasyon-dogrulama
  deseniyle) + canlı guard smoke.
- **Dikey 4 kalan dilimi BİTTİ** (ROADMAP §1.47): segment-bazlı drift sonucu
  (`ai_drift_readings.segment`, saf `driftSegmentGrupla` — segmentler
  birleştirilmez) + insan override gerekçesi (guard: gerekçesiz/kimliksiz red,
  bir kez override edilince donuk) + `ai_model_rollbacks` (M35 exit_plans
  deseni — kanıtsız "tamamlandı" yok) + `iso_42001_27001_crosswalk` (GLOBAL,
  dört-göz, standart METNİ seed EDİLMEZ — yalnız kısa madde kodu + küratör
  gerekçesi). UI `/ai-guvence` genişledi (segment durumu + override aksiyonu +
  Model rollback + ISO Crosswalk kartı), rota `/api/ai-guvence/crosswalk`.
  Testler: rls-ai-drift-rollback-crosswalk 16 + ai-olay 4 yeni saf +
  `ai-drift-rollback-crosswalk.spec.ts` e2e (iki-kullanıcı dört-göz) + canlı
  guard smoke.
- **M17 sonraki dilim KISMEN BİTTİ** (ROADMAP §1.48): workpaper→bulgu/kontrol
  bağı — `audit_workpaper_controls`/`audit_workpaper_findings`, Dikey 5'teki
  `critical_service_controls` deseninin aynısı; ONAYLANDI çalışma kağıdının
  bağları da DONUK (mevcut icerik-donukluğunun kenarlara genişlemesi). UI
  `/denetim/[id]` çalışma kağıdı satırına bağ seçici + rozetler eklendi.
  Testler: rls-audit-workpaper-links 7 + mevcut `denetim.spec.ts` genişletildi
  (bağla→sign-off→donukluk+DB reddi) + canlı guard smoke.
- **M17 sonraki dilim madde 2/4 BİTTİ** (ROADMAP §1.49): PBC/request —
  `audit_pbc_requests`, `regulatory_requests`'in (M38) sadeleştirilmiş yeniden
  kullanımı: ACIK→ALINDI (kanıt+tarih zorunlu)→KAPANDI (yalnız ALINDI'dan,
  kural 14 ruhu), ALINDI/KAPANDI'da kanıt DONUK. UI `/denetim/[id]`'ye "PBC
  Talepleri" kartı eklendi. Testler: rls-audit-pbc-requests 6 + mevcut
  `denetim.spec.ts` genişletildi (aynı testte talep→alındı→kapat) + canlı
  guard smoke.
- **M17 sonraki dilim madde 3/4 BİTTİ** (ROADMAP §1.50): formal independence
  bağı — YENİ tablo AÇILMADI, mevcut G7 tablosu (`independence_declarations`,
  M38) genelleştirildi: `matter_id` artık nullable, `engagement_id` eklendi,
  "tam olarak bir bağlam" check constraint'i. M38'in mevcut akışı (matter_id
  ile beyan) regresyonsuz — `rls-regulatory-engagement.test.ts` değişmeden
  geçti. UI `/denetim/[id]`'ye "Bağımsızlık Beyanları" kartı eklendi. Testler:
  rls-audit-independence 6 + mevcut `denetim.spec.ts` genişletildi (aynı
  testte beyan ekleme adımı) + canlı guard smoke.
- **M17 sonraki dilim madde 4/4 SON BİTTİ — §1.29 TAMAMEN KAPANDI**
  (ROADMAP §1.51): WORM export — `audit_worm_exports`, `simulation_result_
  manifests`'in (M9) mühür deseninin AYNISI: INSERT/UPDATE/DELETE authenticated/
  anon'dan revoke, immutable trigger service_role dahil reddeder. Saf motor
  `src/lib/audit-worm-export.ts` (citation-bundle.ts deseni): denetim işinin
  tam anlık görüntüsü → RFC 8785 TEK `paketHash`. Rota `POST /api/denetim/
  [id]/worm-export` session client'la okur, service_role ile mühürler.
  BAĞIMSIZ CLI `scripts/verify-audit-worm.ts` (DB'siz, VERIFIED/FAILED çıkış
  0/1). UI `/denetim/[id]`'ye "WORM Export" kartı. Canlı uçtan uca doğrulandı:
  tarayıcıda mühürle → gerçek paketi çek → ayrı process'te CLI VERIFIED verdi.
  Testler: audit-worm-export 6 saf + rls-audit-worm-export 7 + mevcut
  `denetim.spec.ts` genişletildi (mühürle→CLI VERIFIED→kurcalanmış paket
  CLI'da FAILED→DB mühür donukluk reddi) + canlı guard smoke.
  **M17'nin (§1.29) DÖRT maddesi de TAMAMLANDI.**
- **Sıradaki (bilinçli sonraki dilim, bu oturumda YAPILMADI):** tezin 29 alt
  kategorisi + kaynak künyesi/tez sayfa referansı (Dikey 5 kalanı); ROADMAP
  §1.24-1.30'un diğer "sonraki dilim" borçları (M13/M35/M36/M38). Nihai
  talimat v3.3 §8.0'ın BEŞ dikeyi + M17'nin TÜM sonraki-dilim borcu bitti —
  kurucudan yeni belge gelene kadar bu borç listesinden mantıklı bir sonraki
  madde seçilerek devam edilebilir (v3.2 tamamlandığında izlenen desenin
  aynısı), ya da kurucudan yeni yön beklenir.
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
