# PR-Q0 — QRegu Rekabet Sprinti: Baseline, Boşluk Analizi ve ADR'ler

**Tarih:** 18 Temmuz 2026 (gece)
**Kaynak belgeler (öncelik sırasıyla):**
1. `docs/arastirma/KALKAN_OS_QRegu_Rekabet_Sprinti_Talimati_2026.md` (ÖNCELİKLİ)
2. `docs/arastirma/KALKAN_OS_Urun_Gelistirme_Yol_Haritasi_2026.md`
3. `docs/arastirma/KALKAN_OS_Regulasyon_Zekasi_ve_Tam_Uyum_Modulleri_2026.md`
4. `docs/arastirma/KALKAN_OS_AI_Blockchain_Strateji_Raporu_2026.md`
5. `docs/arastirma/KALKAN_OS_V2_MVP_Strateji_Ek_Talimat_2026.md`
6. `docs/arastirma/KALKAN_OS_Master_Talimat_UI_Regulasyon_2026.md`

Çelişkide QRegu talimatı önceliklidir; güvenlik/tenant izolasyonu/hukuk
doğrulamasında DAHA SIKI kural üstündür (QRegu §0).

---

## 1. Baseline doğrulaması (ölçülmüş, 18 Temmuz gece)

Eski ilerleme notuna güvenilmedi; tam takım fiilen koşuldu:

| Kapı | Sonuç |
|---|---|
| `pnpm check` (typecheck+lint+vitest) | **789 birim, 61 dosya, 0 başarısız, 0 skip** |
| `pnpm e2e` (gerçek Chromium, gerçek Supabase) | **34/34, 0 skip** |
| `pnpm build` (production) | exit 0 |
| Canlı deploy `/health/ready` | `hazir` / `erisilebilir` (Hostinger) |
| Migration durumu | 45 migration canlıda; son: `20260718190000_els_delete_alignment` |
| **M16 üretim kapısı** | **GEÇTİ (kurucu onayı, 18 Temmuz "geçir")** — paralel borç: K1 staging + veri restore provası, K2 dış cron (ADR'li, kapıyı bloklamıyor) |

QRegu §4 PR-Q0 çıkış koşulu ("tüm testler yeşil, sıfır beklenmeyen skip;
M16 kapısı kapanmış") **sağlanmıştır**.

---

## 2. Boşluk analizi — QRegu PR sırası ↔ repo gerçekliği

QRegu talimatı yazıldığı anda repo'nun V2 PR-4b'yi bitirmiş olduğunu
bilmiyordu. Gerçek durum: **PR-Q1..Q4'ün çekirdeği büyük ölçüde kodda ve
canlıda mevcut.** Aynı işi yeniden yapmak yerine eksik parçalar eşlendi
(master §28: "kısmen uygulanmış PR'ları tekrar yapma").

### PR-Q1 (M19/M20 kaynak + temporal corpus) — ÇEKİRDEK VAR, ingest eksik

| İstenen | Durum | Kanıt |
|---|---|---|
| Source registry + access policy | ✅ | `regulatory_sources` (+`erisim_politikasi_durumu`), `20260718140000` |
| Immutable raw artifact + SHA-256 + künye + predecessor | ✅ şema | `source_artifacts` (sha256 check'li, `raw_object_path` alanı hazır) |
| Bitemporal madde sürümü | ✅ | `provisions` (valid+system time, düzeltme=yeni kayıt; rls-provisions 8/8) |
| Kaynak sicili UI | ✅ dar | `/regulasyon/kaynaklar` (salt-okur, e2e'li) |
| Güvenli ingestion (Storage'a ham artifact yükleme + manifest) | ❌ | `raw_object_path` hep null; `regulatory-source-artifacts` bucket yok |
| Fragment düzeyi (fıkra/bent ayrı nesne) | ❌ bilinçli | `provision_ref` serbest metin; parser YOK (izole parser ayrı iş) |
| Staleness cron + retrieval failure kaydı | ❌ | `source_fetch_runs` yok |
| Malicious-file/parser testleri | ❌ | parser olmadığı için kapsam dışı; upload sınırları ingest'le gelecek |

### PR-Q2 (M21/M22 obligation + applicability) — ÇEKİRDEK VAR, iş akışı eksik

| İstenen | Durum | Kanıt |
|---|---|---|
| Obligation/provision ilişkisi + 6 doğrulama durumu | ✅ | `20260718160000`; DB guard: VERIFIED doğamaz / yalnız LEGAL_REVIEW'den + `dogrulayan` atfı / VERIFIED içerik donuk (canlı smoke'ta kanıtlı) |
| Versioned kurum profili + fact snapshot + fingerprint | ✅ | `applicability_decisions` + `src/lib/applicability.ts` (RFC 8785, sıra-bağımsız) |
| UNKNOWN ≠ NOT_APPLICABLE invariant'ı | ✅ DB'de | NA = gerekçe+onay+kimlik-atfı zorunlu (service_role bile); rls-applicability 10/10 |
| Determinism/order-independence testleri | ✅ | applicability.test.ts + legal-basis.test.ts |
| Dört-göz doğrulama İŞ AKIŞI (hazırlayan ≠ onaylayan) | ❌ | Bugün geçişler service/route'suz; hazırlayan≠dogrulayan DB guard'ı YOK → PR-Q2' işi |
| Applicability wizard UI + eksik bağlamda soru üretme | ❌ | `eksikProfilAlanlari()` motoru hazır, UI yok |

**Terminoloji çelişkisi (kayıt):** QRegu Q2 `REVIEW_REQUIRED` durumunu sayar;
canlı şema master §16/V2 ile uyumlu `CONDITIONAL`ı kullanıyor ve CONDITIONAL
şart metnini DB'de ZORLUYOR. Mevcut sözlük daha sıkı ve canlıda — korunur;
"inceleme gerekli" ihtiyacı durum sözlüğüne yeni değer olarak DEĞİL,
yeniden-değerlendirme kuyruğu (supersede akışı) olarak karşılanır. QRegu §0
"daha sıkı kural üstün" hükmü gereği sapma değildir.

### PR-Q3 (M23 + Control Compiler dikeyi) — GUARD CANLI, içerik bekliyor

| İstenen | Durum | Kanıt |
|---|---|---|
| Legal-basis execution guard + M12 yeniden kullanımı | ✅ | `legal-basis.ts` + `legal-basis-server.ts`; `/api/kontrol-test/[id]/calistir` koşu öncesi değerlendirir; İKİNCİ MOTOR YOK |
| Doğrulanmamış eşleme zorunlu kontrolü çalıştıramaz | ✅ e2e'de | `legal-basis.spec.ts`: 409 BLOCK → doğrula → uyarılı → APPLICABLE → ALLOW |
| Execution legal snapshot (her koşuda, immutable) | ✅ | `execution_legal_snapshots` (BLOCK=koşusuz check'i; UPDATE herkese kapalı) |
| failed→finding→retest→independent closure | ✅ (M12) | verified-closure DB guard'ı + kontrol-test e2e |
| 20–40 uzman doğrulamalı SPK/7545 kontrolü | ❌ **İÇERİK** | Kural 3: içerik `data/controls/*.yaml` + kurucu/küratör onayı ister — KOD DEĞİL, kurucu teslimi (aşağıda blocker) |

### PR-Q4 (M24 Proof Vault/Receipt/Proof Room) — HASH ZİNCİRİ VAR, ledger eksik

| İstenen | Durum | Kanıt |
|---|---|---|
| Citation bundle + üç ek hash + bağımsız verifier | ✅ | `citation-bundle.ts` + `/api/kontrol-test/run/[runId]/sitasyon` + `scripts/verify-sitasyon.ts` (e2e'de ayrı süreçte VERIFIED=0/kurcalı=1) |
| Deterministik canonical veri | ✅ | kendi RFC 8785 uygulamamız (`canonical.ts`, uygunluk külliyatlı) |
| JWS provider interface (üretim anahtarı yokken dev signer) | ✅ (M11) | `ManifestSigner`/`LocalDevSigner`; KMS/HSM AÇIK KARAR |
| Audit package + verify CLI | ✅ (M11) | ZIP + `verify-paket.ts` (Chromium e2e'de bağımsız süreç) |
| Denetçi salt-okur alanı | ✅ kısmen | `paylasim` token'lı görüntüleme (RPC'li) — "Proof Room"a genişletme adayı |
| SCITT-tarzı append-only Merkle transparency log + receipt | ❌ | RFC 6962 Merkle + proof KODU VAR (M5.5) ama statement log'u yok → PR-Q4' işi |
| RFC 3161 TSA adapter | ❌ AÇIK | Kamu SM test endpoint'i olmadan kör ASN.1 yazılmaz (mevcut ADR-M11-02) |
| AI Decision Receipt | ❌ | AI yok (PR-Q6'yla birlikte); şema bu belgede ADR-3'te |

### PR-Q5 (connector'lar) — YOK; desen kanıtlı

Read-only import YOLU kanıtlı (SoD CSV import: dry-run/apply/manifest/
rollback; IBAN doğrulama). Gerçek connector seçimi **kurucu kararı #7**
(müşteri görüşmesi ister) — bloklanmadan önce karar gerekmez.

### PR-Q6 (AI Gateway + RegBench-TR) — YOK

Sınırlar hazır (kural 11 deterministik motorlar, kural 3 DB guard'ları AI'yı
da bağlar: hiçbir kayıt VERIFIED doğamaz — bu, "AI VERIFIED yapamaz"ın DB
kanıtıdır). Model sağlayıcı/veri bölgesi **kurucu kararı #1-2**.

### PR-Q7 (ürünleştirme) — PLATFORM VAR, paket içerik bekliyor

Entitlement (server-side, e2e'li) ✅, CFO dashboard + TTV/activation ✅,
dark/light + AA + responsive ✅. SPK/7545 hazır paketi İÇERİĞE bağlı;
CFO Lite paketleme + pilot ölçümü Q7'de.

---

## 3. ADR-1 — Rekabet konumu: radar değil, source-to-proof (TASLAK — kurucu onayı bekler)

**Karar:** KALKAN_OS "AI mevzuat takip/radar" ürünü olarak konumlanmaz
(QRegu §1). Ürün, AI/Blockchain raporunun terimleriyle **Provable Compliance
Operating System**'dir: resmî kaynak → sürümlü hüküm → doğrulanmış yükümlülük
→ applicability → kontrol → deterministik test → kanıt → bulgu/retest →
bağımsız doğrulanabilir makbuz.

**Neden savunulabilir (bugün kodda olan farklar):** çalışan M12 test motoru
+ M16 SoD invariant'ları; hukuk sınırlarının DB guard'ı olması (route değil);
bitemporal hukuk verisi; DÖRT bağımsız verifier yolu (`verify-paket`,
`verify-sitasyon`, `/dogrula/[hash]`, zarf doğrulama) — rakip radar ürünleri
özet üretir, KALKAN_OS koşturur ve İSPATLAR.

**Sonuç:** İlk 90 gün QRegu PR sırası izlenir; her yeni özellik (AI dahil)
ancak kanıt zincirine bağlanarak eklenir. "%100 uyum", "garanti" dili yasak
(mevcut kural — değişmedi).

## 4. ADR-2 — AI karar sınırı (TASLAK — kurucu onayı bekler)

- **AI önerir:** bölümleme, özet/diff, yükümlülük ADAYI, eşleme ADAYI,
  eksik-bağlam soruları, kanıt yeterlilik itirazı, taslak metin.
- **Deterministik motor uygular:** durum geçişleri, guard'lar, test sonucu
  (M12), kapsam ön-değerlendirmesi (eksik olgu → UNKNOWN).
- **İnsan karar verir:** VERIFIED, PASSED-dışı durum kabulleri, istisna,
  NOT_APPLICABLE, kapanış. **DB bunu bugün bile zorluyor** — `obligation_
  dogrulama_guard` kayıt kaynağından bağımsız olarak VERIFIED doğumunu ve
  atıfsız geçişi reddeder; AI eklendiğinde ayrıca gevşetilecek bir şey yok.
- AI'ya `service_role` verilmez; her ajan ayrı kimlik + tenant-scope + dar
  tool listesi taşır (AI raporu §7.3). Untrusted belge/kanıt içeriği tool
  talimatı olarak çalıştırılmaz (QRegu kural 10).
- **AI Decision Receipt asgari şeması** (AI raporu §4.4'ten): tenantId,
  agentId, purpose, modelProvider/Id/Version, prompt hash+sürüm, retrieval
  policy sürümü, kullanılan artifact id+hash'leri, context snapshot hash,
  output şema sürümü, confidence + belirsizlik nedenleri, tool çağrı özeti,
  reviewer + karar, zaman damgaları, supersedes zinciri, deterministik
  fingerprint (kendi RFC 8785'imizle). Kişisel veri/ham prompt log'a yazılmaz
  (kural 7); receipt hash/commitment taşır.
- Prompt/model/retrieval değişikliği RegBench-TR gold-set regression kapısı
  olmadan üretime çıkamaz (PR-Q6'da kurulur).

## 5. ADR-3 — Proof receipt ve transparency ledger sınırı (TASLAK — kurucu onayı bekler)

- **Canonical veri:** tek kaynak `src/lib/canonical.ts` (kendi RFC 8785
  uygulamamız; bağımsız CLI'ların varlık sebebi). Receipt/statement'lar da
  bunu kullanır.
- **İmza:** mevcut `ManifestSigner` interface'i genişletilir; üretim anahtarı
  **AÇIK KARAR #4** (KMS/HSM). `LocalDevSigner` yalnız dev; `signer_ad`
  etiketiyle dürüstçe işaretli (mevcut M11 davranışı).
- **TSA:** RFC 3161 adapter interface'i; gerçek sağlayıcı (Kamu SM/ESHS)
  **AÇIK KARAR #5**. Mock yalnız test fixture'ında; "production signed"
  numarası yapılmaz (master §18 uyarısı).
- **Transparency ledger (PR-Q4' hedefi):** SCITT-tarzı (RFC 9943 mantığı)
  append-only statement log'u Postgres'te; Merkle inclusion/consistency
  proof'ları için M5.5'teki RFC 6962 kodu YENİDEN KULLANILIR (ikinci Merkle
  yazılmaz). Statement türleri: test koşuldu / kanıt kabul-red / bulgu
  açıldı-kapandı / istisna / hukuk doğrulaması / AI önerisi kararı / paket
  üretildi. Verifier, KALKAN_OS kapalıyken fixture receipt'i doğrulayabilmeli.
- **Blockchain sınırı (ilk 90 gün):** public chain YOK, token/NFT YOK, ZKP
  üretim bağımlılığı YOK (QRegu §7). İleride yalnız günlük Merkle root için
  chain-agnostic `TrustAnchorAdapter`; core akış anchor'sız çalışır.
- **Hash sözleşmesi:** mevcut dörtlü + üç regülasyon hash'i DEĞİŞMEZ; receipt
  yeni AYRI alanlar ekler (kural 15).

## 6. Resmî kaynak erişim/lisans matrisi (başlangıç — connector öncesi yeniden doğrulanacak)

| Kaynak | Seviye | Erişim yöntemi (bilinen) | Lisans/koşul durumu |
|---|---|---|---|
| EUR-Lex / CELEX / ELI | A | Webservice (kayıtlı), CELLAR dump | Yeniden kullanım serbest; atıf + değişiklik beyanı ŞART — connector öncesi güncel koşul teyidi |
| Resmî Gazete | A | HTML/PDF arşiv; kararlı API VARSAYILMAZ | `TODO_DOGRULA` — SourceAccessPolicy onayı olmadan otomatik çekim yok |
| SPK Mevzuat Sistemi + duyurular | A/B | HTML; API yok varsayımı | `TODO_DOGRULA`; SPL çalışma notları = D seviyesi (araştırma girdisi, bağlayıcı hukuk DEĞİL) |
| BDDK / TCMB / MASAK / KVKK | A/B | HTML/PDF | `TODO_DOGRULA` — kaynak başına ayrı politika kaydı |
| Siber Güvenlik Başkanlığı (7545) | A/B | HTML/PDF; ikincil düzenlemeler beklemede | İkincil düzenleme çıkmadan ilgili kontroller `CONDITIONAL`/`TODO_DOGRULA` |
| Adalet Bakanlığı Mevzuat | A | HTML | `TODO_DOGRULA` |
| TSE/ISO/NIST standart metinleri | C | Lisanslı | Tam metin İZİNSİZ KOPYALANMAZ; yalnız lisanslı metadata (**AÇIK KARAR #8**) |

Şema karşılığı bugün var: `regulatory_sources.erisim_politikasi_durumu`
(`onay_bekliyor/onaylandi/manuel/reddedildi`). Kural: connector, politika
`onaylandi` olmadan üretime çıkmaz; manuel ingest için `manuel` yeterli.

## 7. SPK/7545 pilot kapsam ÇERÇEVESİ (içerik değil — kural 3)

Hedef: 20–40 **uzman doğrulamalı** kontrol (QRegu Q3). Bugün katalogda 2
çerçeve / 17 kontrol seed'li (VII-128.10 ağırlıklı). Çerçeve:

1. İçerik YALNIZ `data/controls/*.yaml` + `data/packs/*.yaml` yolundan,
   kurucu/küratör (hukuk doğrulayıcı rolü **AÇIK KARAR #3**) teslimiyle girer;
   AI/parser/Claude içerik ÜRETMEZ (kural 3).
2. Her kontrol: hüküm referansı (provision), dayanak türü (LEGAL_MANDATORY/
   ...), kanıt beklentisi, test yöntemi (M12 türleri), sıklık.
3. Zincir kodda hazır: provision→obligation→mapping→guard→test→citation —
   içerik geldiği gün yüklenebilir, doğrulama iş akışı PR-Q2'/Q3'te.
4. **BLOCKER kaydı:** 20–40 kontrollük doğrulanmış içerik teslimi kurucu/
   hukuk tarafındadır; kod tarafında bloker yok.

## 8. Tasarım ortağı ölçüm sözleşmesi taslağı (3 partner)

Partner profilleri (Yol Haritası §10): (A) aracı kurum — SPK VII-128.10 +
denetim paketi; (B) banka/fintech — connector + incident; (C) kurumsal finans
— CFO Kalkanı (IBAN/SoD/BEC).

Her partnerle yazılı ölçüm sözleşmesi şu metrikleri içerir (baseline → 90.
gün; `activation_events` + TTV metrikleri ZATEN kodda):

- kurum profili → ilk applicability kararı: hedef < 60 dk
- hazır import/connector → ilk kanıt: hedef < 1 iş günü
- resmî kaynak değişikliği → onaylı etki kararı: hedef < 24 saat (M25 radar
  gelince ölçülür; öncesinde manuel süreç ölçümü)
- audit package üretimi: hedef < 1 saat
- denetim kanıt toplama insan-saati (öncesi/sonrası beyanı)
- win/loss nedeni kaydı: QRegu / Regvion / Excel-iç geliştirme / danışmanlık

## 9. Açık kurucu kararları (QRegu §9 — uydurulmadı)

| # | Karar | Bloke ettiği iş |
|---|---|---|
| 1 | Üretim AI modeli/sağlayıcısı + veri bölgesi | PR-Q6 üretim |
| 2 | Müşteri verisinin dış AI'a gönderim politikası | PR-Q6 üretim |
| 3 | Hukuk doğrulayıcı kişi/kurum (+ sorumluluk) | PR-Q3 İÇERİK doğrulaması |
| 4 | JWS/COSE üretim anahtarı (KMS/HSM) | Receipt'in "production signed" ilanı |
| 5 | Türkiye ESHS / RFC 3161 TSA | TSA adapter'ın gerçek ucu |
| 6 | Public/permissioned chain + anchor sıklığı | 90 gün sonrası pilot |
| 7 | İlk üç üretim connector'ı | PR-Q5 kapsam seçimi |
| 8 | Ücretli mevzuat/standart lisansları | Standart metni içeriği |
| 9 | Gerçek regülatör gönderim entegrasyonu | M32 (kapsam dışı) |
| 10 | Paket fiyatı / billing provider / trial (K3-K4) | Gerçek tahsilat |
| — | K1 staging + restore provası, K2 dış cron (M16 borcu) | Paralel, kapı geçti |

Hiçbiri PR-Q1'/Q2' KOD işini bloklamıyor (adapter/OPEN-DECISION ile).

## 10. Sonraki tek PR — PR-Q1' (dar kaynak ingest dilimi)

Kapsam (QRegu Q1'in repo'da EKSİK kalan parçaları):

1. `regulatory-source-artifacts` private bucket + ham artifact'ın Storage'a
   içerik-adresli yüklenmesi (kanıt bucket'ı deseni: `{sha256}` yol, imzalı
   URL, private); `source_artifacts.raw_object_path` doldurulur; DB hash =
   Storage nesne hash'i doğrulaması.
2. Manuel güvenli ingest rotası (admin/uyum): dosya + künye → hash hesapla →
   artifact satırı + Storage nesnesi tek akışta; MIME/boyut sınırları
   (`csvDosyasiKabulEdilebilirMi` deseni genişletilir); parser YOK.
3. `source_fetch_runs` (append-only koşu kaydı) + staleness türetimi +
   `kaynak_bayatligi_isle` pg_cron işi (idempotent, mevcut cron deseni) —
   "kaynak erişilemiyorsa güncellik iddia edilemez" (QRegu kural 8) görünür
   sinyale bağlanır.
4. `/regulasyon/kaynaklar` genişletmesi: artifact listesi + son çekim/
   staleness rozeti + admin ingest formu.
5. Testler: RLS (PGlite) + birim + gerçek Chromium e2e (ingest → listede
   hash görünür → staleness sinyali); Storage RLS canlıda smoke (PGlite
   Storage'ı taklit edemez — bilinen sınır).

Kabul: tüm mevcut testler + yeniler yeşil, 0 skip; build; canlı smoke;
ROADMAP/DEVAM güncel.
