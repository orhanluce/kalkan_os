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
2. **G2 — M34 Policy Lifecycle:** yeni kod alanı (PolicyDocument/Version/
   Clause/Approval/Attestation/Exception/Impact; draft→review→approved→
   effective→retired state machine; preparer≠approver — dört-göz deseni
   hazır; clause→hüküm/kontrol bağı).
3. **G3:** connector sözleşmesi + RFC 3161 TSA adapter interface (kurucu
   kararları beklerken interface+test double) + SCITT-tarzı ledger (M5.5
   Merkle kodu yeniden kullanılır).
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
