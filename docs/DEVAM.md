# DEVAM TALİMATI — kaldığın yerden sürdür (18 Temmuz 2026 gece güncellemesi 2)

Bu dosya oturumlar arası devir içindir. **Kurucu kalıcı onay verdi:
"her bitişte onaya gerek yok, V2 PR sırasının SONUNA KADAR devam."** Her PR'ı
doğrula → commit → push → deploy health kontrol, duraksamadan sonrakine geç.

## 0. İLK İŞ (her yeni oturumun başında)
Yeşil taban doğrula (körlemesine güvenme):
```
pnpm check        # typecheck + lint + vitest  (beklenen: ~782 birim, 0 skip)
pnpm e2e          # gerçek Chromium            (beklenen: ~33 e2e, 0 skip)
cmd /c "pnpm build 2>&1"   # exit 0
curl.exe -s https://blue-yak-865668.hostingersite.com/health/ready  # hazir/erisilebilir
```
Bu üçlü 18 Temmuz gece oturumunda TAM koşuldu ve yeşildi (742→782 birim,
33 e2e, build exit 0). Kırmızı çıkarsa önce onu düzelt.

## 0b. ⚠️ BU OTURUMDAN DEVREDEN BLOKAJ (önce bunu çöz)
Gece oturumunda `git push` ve `pnpm db:push` (ve Supabase MCP yazma) izin
sınıflandırıcısı tarafından ENGELLENDİ. Sonuç:
- **main'de push edilmemiş 4 commit var**: `606a22a` (adım 1 provisions),
  `66178e3` (adım 2 obligations), `e5df2f9` (adım 3 applicability),
  `2432c8c` (adım 4 legal-basis motoru+snapshot şeması).
- **Canlıya uygulanmamış 4 migration var**: `20260718150000_provisions`,
  `20260718160000_obligations`, `20260718170000_applicability_decisions`,
  `20260718180000_execution_legal_snapshots`. Hepsi PGlite'ta gerçek
  migration olarak test edildi ama canlıda YOK; `pnpm db:types` da koşulmadı.
İLK İŞ: `pnpm db:push` → `pnpm db:types` (tip farkı çıkarsa commit) →
canlıya gerçek yazma smoke'u (geçici script, sonra sil) → `git push` →
deploy health. ANCAK ONDAN SONRA adım 4 rota bağlantısı + e2e yazılabilir
(e2e gerçek Supabase'e koşuyor; tablolar canlıda yokken PR-4b e2e'si yazılamaz).

## 1. NEREDE KALINDI
- **M16 üretim kapısı GEÇTİ** (kurucu onayı). Paralel borç: K1 staging, K2 dış cron.
- **V2 PR-0 / PR-2 (a-b-c) / PR-3 (CFO çekirdeği) / PR-4a**: TAMAM (ayrıntı
  CLAUDE.md + ROADMAP).
- **V2 PR-4b adım 1-4 ŞEMA+MOTOR KATMANI TAMAM (yerel):**
  1. `provisions` (M20, bitemporal, global) — rls-provisions 8/8.
  2. `obligations`+`obligation_control_mappings` (M21) — 6 doğrulama durumu;
     DB guard: VERIFIED doğamaz / yalnız LEGAL_REVIEW'den + dogrulayan atfıyla /
     VERIFIED içerik donuk. rls-obligations 9/9.
  3. `applicability_decisions` (M22, tenant'a özgü) — UNKNOWN != NOT_APPLICABLE
     DB invariant'ı (NA gerekçe+onay+kimlik-atfı ister), append-only karar
     zinciri (supersede), fact_snapshot + RFC8785 fingerprint; saf yardımcılar
     `src/lib/applicability.ts` (kural motoru UYDURULMADI — eksik olgu →
     UNKNOWN, tam olguda karar insanda). rls-applicability 10/10 + 6 birim.
  4. `src/lib/legal-basis.ts` (M23 saf motor): ALLOW/ALLOW_WITH_WARNING/BLOCK;
     V2 kabulü kodda — doğrulanmamış eşleme ZORUNLU kontrolü BLOKlar, rehberde
     uyarı; kapsam sorunları BLOK DEĞİL uyarı (kural 13 ruhu); dayanak iddiası
     olmayan kontrol bloklanmaz. `execution_legal_snapshots` tablosu: koşu
     başına tek değişmez fotoğraf, BLOCK=koşusuz check'i, tam immutability
     (service_role dahil). 11+4 test.
Test tabanı: **782 birim (60 dosya) + 33 e2e, 0 skip**; production build yeşil.
Migration sırası son: `20260718180000_execution_legal_snapshots` (CANLIDA DEĞİL, §0b).

## 2. SIRADAKİ İŞ — V2 PR-4b KALAN (blokaj çözülünce)
1. **Adım 4 rota bağlantısı**: `/api/kontrol-test/[id]/calistir` koşudan önce
   zinciri okur (SQL yalnız ham malzeme) → `legalBasisDegerlendir` → BLOCK ise
   409 + koşusuz snapshot; değilse koşu + snapshot aynı akışta. M12 motoruna
   DOKUNMA. Gerçek Chromium e2e: doğrulanmamış eşleme zorunlu kontrolü
   bloklar; V2 §akış: fixture ingest → doğrula → applicability → koş.
2. **Adım 5 citation bundle (M24)**: mevcut dört hash'e EK `legalSnapshotHash`/
   `sourceBundleHash`/`applicabilityDecisionHash` (mevcut hash sözleşmesini
   BOZMA — kural 15); bağımsız verify CLI'ya bağla.
3. UI dokunuşu (dar): kontrol detayındaki EvidenceTraceRail Hüküm/Yükümlülük
   düğümlerine gerçek veri (artık "bağlı değil" değil), `/regulasyon/kaynaklar`
   altına hüküm/yükümlülük listesi (salt-okur, doğrulama rozetli).
Her adım: migration (PGlite RLS testi) → canlı db:push+db:types → gerçek
Chromium e2e → commit. Kural 3'ü her adımda koru; hiçbir mevzuat uydurma.

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
