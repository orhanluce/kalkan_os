# DEVAM TALİMATI — kaldığın yerden sürdür (18 Temmuz 2026 gecesi)

Bu dosya oturumlar arası devir içindir. **Kurucu kalıcı onay verdi:
"her bitişte onaya gerek yok, V2 PR sırasının SONUNA KADAR devam."** Her PR'ı
doğrula → commit → push → deploy health kontrol, duraksamadan sonrakine geç.

## 0. İLK İŞ (her yeni oturumun başında)
Yeşil taban doğrula (körlemesine güvenme):
```
pnpm check        # typecheck + lint + vitest  (beklenen: ~730+ birim, 0 skip)
pnpm e2e          # gerçek Chromium            (beklenen: ~33 e2e, 0 skip)
cmd /c "pnpm build 2>&1"   # exit 0
curl.exe -s https://blue-yak-865668.hostingersite.com/health/ready  # hazir/erisilebilir
```
NOT: son commit `bca975b` (PR-4a) sonrası TAM `pnpm check`+`pnpm e2e`+`pnpm build`
kombine koşusu YAPILMADI (oturum bitti). PR-4a parçaları tek tek yeşildi
(rls-regulatory-source 4/4, e2e 1/1, typecheck+lint temiz, migration+seed
canlıda). İlk iş bu üçlüyü tam koşup gerçekten yeşil olduğunu teyit et; kırmızı
çıkarsa önce onu düzelt.

## 1. NEREDE KALINDI
Bugün canlıya çıkanlar (hepsi `main`'de, Hostinger otomatik deploy):
- **M16 üretim kapısı GEÇTİ** (kurucu onayı). Paralel borç: K1 staging, K2 dış cron.
- **V2 PR-0** (keşif/ADR — `docs/adr/PR0-v2-mvp-strateji-2026-07-18.md`, 6 ADR taslağı)
- **V2 PR-2** TAMAM: 2a organization_profiles+onboarding, 2b control_packs+basis,
  2c plan/entitlement+server-side zorlama.
- **V2 PR-3 (CFO MVP) çekirdeği**: 3a IBAN değişikliği doğrulama (maskeli+hash,
  maker-checker), 3b CFO dashboard+aktivasyon/TTV+org-type duyarlı nav.
- **V2 PR-4a**: resmî kaynak sicili iskeleti (global referans, küratör seed).
- Ek: PGlite test snapshot hızlandırması (~66s→~34s), AA taraması.

Migration sırası son: `20260718140000_regulatory_source_registry`.
Test tabanı: ~730 birim + ~33 e2e (PR-4a e2e dahil), 0 skip.

## 2. SIRADAKİ İŞ — V2 PR-4b (task #41, in-progress DEĞİL)
**Regulated dikey dilim: provision→obligation→applicability→legal-guard→citation**
(M20-M24, TEK yeşil dikey dilim — paralel yarım subsystem AÇMA, V2 §9 PR-4).
Öneri dilimleme:
1. **provisions** (M20 bitemporal: source_artifact'a bağlı hüküm; valid_time +
   system_time; effective_from/to). Global referans (tenant'sız, ADR-T3).
2. **obligations + obligation_control_mappings** (M21): hüküm→yükümlülük→kontrol;
   doğrulama durumları (DRAFT_RESEARCH/TODO_DOGRULA/LEGAL_REVIEW/VERIFIED/
   SUPERSEDED/REJECTED); **VERIFIED ayrı hukuk yetkisi ister** (bugün admin;
   hukuk rolü K8 açık). Kural 3: AI/parser/seed VERIFIED yapamaz.
3. **applicability_decisions** (M22, TENANT'A ÖZGÜ): kurum profilinden 4 durum
   (APPLICABLE/NOT_APPLICABLE/CONDITIONAL/UNKNOWN); `UNKNOWN != NOT_APPLICABLE`
   DB+UI invariant'ı; fact snapshot + fingerprint + insan onayı.
4. **legal-basis guard** (M23): M12 kontrol testi ÇALIŞMADAN ÖNCE mapping
   doğrulanmış mı / hüküm yürürlükte mi / applicability güncel mi → ALLOW/
   ALLOW_WITH_WARNING/BLOCK; her koşuda immutable `execution_legal_snapshot`.
   M12 test motorunu YENİDEN KULLAN (ikinci motor yok).
5. **citation bundle** (M24): mevcut dört hash'e EK alanlar `legalSnapshotHash`/
   `sourceBundleHash`/`applicabilityDecisionHash` (mevcut hash sözleşmesini
   BOZMA — kural 15). Bağımsız verify CLI'ya bağlanabilir.
Her adım: migration (PGlite'ta RLS testi) → canlı db:push+db:types → gerçek
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
Spawn'lanan "PGlite snapshot" görevi (task_f4c09120) kurucu tarafından ayrı bir
worktree'de başlatılmıştı; ben ana oturumda çözüp commit ettim (`b637a5c`). O
worktree'nin sonucu artık gereksiz — güvenle discard edilebilir.
