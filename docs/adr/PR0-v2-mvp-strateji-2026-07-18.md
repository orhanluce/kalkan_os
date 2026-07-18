# PR-0 (V2) — MVP Strateji Keşfi, M16 Kanıt Dökümü, Fark Analizi ve ADR Taslakları

**Kaynak belgeler:** `docs/arastirma/KALKAN_OS_V2_MVP_Strateji_Ek_Talimat_2026.md`
(V2, 18 Temmuz — diff-doğrulı arşiv) + `KALKAN_OS_Master_Talimat_UI_Regulasyon_2026.md`
(V1 — Downloads'taki "(1)" kopyası arşivle BİREBİR AYNI, diff temiz).
**Öncelik kuralı uygulanır:** segment/MVP/entitlement/PR-sırasında V2; güvenlik/
RLS/hukuk/kapıda iki belgeden SIKI olan. **Bu turda kod yazılmadı.**

---

## 1. Repository durumu (doğrulanmış)

- Branch `main`, çalışma alanı temiz (yalnız bu PR-0'ın doküman dosyaları).
- Son 8 commit bugünün işi: PR-3B→PR-3D + #3/#5/#6/#8/#9 (aşağıda kanıt tablosu).
- 44 migration canlıda; canlı sağlık: `/health/ready` → `{"durum":"hazir",
  "supabase":"erisilebilir"}` (bu tur içinde yeniden ölçüldü).
- **Test tabanı (bu turda yeniden koşuldu — V1 §1.1'deki "581+17" İKİ KEZ
  bayat):** sonuçlar §2'de; V2 belgesinin yazıldığı andaki durumla bugünkü repo
  arasında BÜYÜK fark var — V2 PR-1'in ("M16 üretim kapanışı") işlevsel
  maddelerinin TAMAMI bu belge yazılırken zaten bitmişti (kanıt aşağıda).

## 2. M16 üretim kapısı — kanıtlı döküm

### 2.1 V2 PR-1 listesi ↔ repo kanıtı (hepsi BİTTİ)

| V2 PR-1 maddesi | Kanıt (migration / test / commit) |
|---|---|
| İstisna uzatma | `20260718080000` zincir guard'ı; `rls-sod-istisna-uzatma.test.ts` (6); sod.spec REOPENED→uzatma→ikinci-kullanıcı onayı e2e; commit `466072d` |
| CSV atama importu | PR-3A `20260718030000` (parser/formula-injection/BOM/limitler); `sod-import.test.ts` (35) |
| Dry-run/apply/hash/idempotency | PR-3B `20260718040000` atomik RPC + stale 409 + 3 katman idempotency; canlı smoke (çift-apply reddi canlıda); `rls-sod-import-apply.test.ts` (7) |
| Outbox değerlendirme | `sod_outbox` apply ile aynı tx; drenaj rotası + `/sod` oto-drenaj + #5 tetikleri `20260718070000` (debounce; `rls-sod-tetikler.test.ts` 4) |
| Rollback/sona erdirme | PR-3C `20260718060000` ters-set apply anında + maker-checker DB guard'ı (service_role dahil); canlı smoke; `rls-sod-import-rollback.test.ts` (9) |
| UI + gerçek Chromium e2e | `/sod/import` + `sod-import.spec.ts` A–E (import/idempotency/stale-409/iki-kullanıcı-rollback/outbox→gerçek çatışma); canlı Hostinger'da giriş yapılıp doğrulandı (`354308e` kanıt görüntüsü) |
| Güvenlik/tenant testleri | `rls-guvenlik-sod.test.ts` — migration'suz KIRMIZI koşulup **3 gerçek açık kanıtlandı ve kapatıldı** (`20260718070001`: sahte talep_eden / sahte onaylayan / sahte resolved_by → kimlik atfı auth.uid()'e sabit); IDOR denemeleri |
| Domain event + dashboard | Outbox `SOD_*` olayları (dar — e-posta/Slack bilinçli yok) + `/sod` Üretim Panosu (saf `sod-metrikler.ts`, 7 test; §9.1: tek skor yok) + `/sod/atamalar` salt-okur liste |

### 2.2 Bugünkü doğrulama koşusu (bu PR-0 turunda ölçüldü)

Sonuçlar §8'e işlendi (koşu bu belge yazılırken tamamlandı) — hedef taban:
**677 birim + 25 e2e, 0 skip, production build yeşil.**

### 2.3 Kapının AÇIK kalan maddeleri (V1 §32 + V2 §3.3/§14 — sıkı olan geçerli)

| Madde | Durum | Not |
|---|---|---|
| **Staging ortamı** | ✗ | Migration'lar tek ortamda (canlı) deneniyor; V2 §14 "aynı staging ortamında" diyor → İKİNCİ Supabase projesi + Hostinger staging app gerekir (maliyet kararı → §7 Açık Karar K1) |
| **Yazılı threat model** | ✗ | Yok — M16 kapanış PR'ının parçası (§6 plan) |
| **Backup/restore + deploy rollback prosedürü** | ✗ | Yazılı değil (Supabase yedekleri var ama restore hiç prova edilmedi) — kapanış PR'ı |
| **WCAG AA kontrolleri** | KISMEN | Palet AA hedefli, klavye çalışır; ölçüm yok — kapanış PR'ında otomatik axe taraması |
| **Dış cron (drenaj ucu)** | ADR'lik | Bugün oto-drenaj + buton; servis-token'lı uç güvenlik kararı (K2) |
| Pool/limit ölçümü | KISMEN | Session pooler kullanılıyor; sayısal ölçüm kaydı yok — kapanış PR'ında not |

**Sonuç:** M16'nın İŞLEVSEL kapsamı kanıtlarıyla tamam; kapı, PLATFORM
maddeleri kapanınca geçer. İlk implementasyon PR'ı = bu maddeler (§6).

---

## 3. V2 ↔ repository fark analizi

### 3.1 V2'nin İSTEYİP repo'da OLMAYANLAR

| V2 kavramı | Repo bugün | Fark/karar |
|---|---|---|
| `OrganizationProfile` + `organizationType` (REGULATED_FINANCIAL_INSTITUTION / CORPORATE_FINANCE / MIXED_GROUP) | `tenants.segment` dar check: `araci_kurum/pys/kvhs/diger` — regulated'a eğik | YENİ tablo `organization_profiles` (tenant 1:1); `tenants.segment` DOKUNULMAZ (mevcut davranış), organizationType yeni tabloda — ADR-V2-1 |
| Yükümlülük dayanak türü (LEGAL_MANDATORY/CONTRACTUAL/BOARD_POLICY/BEST_PRACTICE) | Yok — `controls` çerçeve-kaynaklı, dayanak alanı yok | Pack-bağı seviyesinde (kontrolün kendisinde değil — aynı kontrol iki pakette farklı dayanakla yaşayabilir) — ADR-V2-2 |
| Plan/entitlement (`ProductPlan…EntitlementDecision`) | HİÇ yok; yetki = rol (admin/uyum/denetci_misafir) + RLS | Sürümlü plan tabloları + server-side entitlement kontrolü; UI gizleme yetki DEĞİL — ADR-V2-3 |
| `ControlPack*` | `frameworks`+`controls` (data/controls/*.yaml seed) var; "pack" kavramı yok | Pack, framework'ün ÜSTÜNE audience+sürüm katmanı; kontrol DUPLICATE edilmez (PackControl köprü) |
| CFO onboarding wizard | Yok; ama **self-serve tenant bootstrap RLS'i VAR** (`tenants_insert_authenticated` + `profiles_insert_self` boş-tenant guard'ı — canlıda) | Wizard bu zemine oturur; sıfırdan kayıt akışı değil |
| `SupplierBankChangeVerification` | Yok | Maskeli değer + hash referansı; TAM IBAN SAKLANMAZ — ADR-V2-4 |
| Partner rolü/delegation | Yok | profiles.role genişletmesi DEĞİL — ayrı membership/delegation modeli (V2 §10: global service-role verilmez); PR-2'nin sonuna |
| Activation/TTV metrikleri | Yok | Ayrı tablo ailesi, kanıt içeriği TAŞIMAZ — ADR-V2-5 |
| Coverage Ledger | Yok | Internal admin görünümü — ADR-V2-6 |

### 3.2 V2'nin İSTEDİĞİ ve repo'da GÜÇLÜ ZEMİNİ OLANLAR (yeniden kullanılır, yeniden yazılmaz)

- **SoD motoru + import + rollback + maker-checker** → CFO Kalkanı'nın çekirdek
  temaları (dual control, talep/onay ayrılığı, ERP/banka erişim review importu
  = mevcut CSV import hattının yeni bir `kaynak`ı).
- **M12 test motoru** → BEC/deepfake tatbikatı V2 §5.3'ün emrettiği gibi mevcut
  simülasyon/test altyapısıyla (5 canlı senaryo + puanlama + öneri→bulgu).
- **Kanıt kasası (M11)**: içerik-adresli Storage, zarf, JWS, ZIP + bağımsız
  verify CLI → "kanıt/denetim paketi" MVP maddeleri hazır.
- **Kural 13/14 durum makineleri** → failed→finding→action→retest→verified
  closure zinciri CANLIDA e2e'li (Regulated MVP'nin orta halkası hazır).
- **Tema/AppShell/StatusBadge** → V2 §6.4 dayanak etiketi = mevcut StatusBadge
  deseninin yeni bir eşlemesi (ikon+metin+renk zaten zorunlu).

### 3.3 Çelişki taraması

- V2 §9 "PR-1 M16 kapanışı" ↔ repo: işlevsel maddeler bitmiş → PR-1'in kalan
  gerçek içeriği platform kapısıdır (§6). Aynı iş TEKRAR yapılmaz (V1 §28).
- V2 CFO "düşük fiyat ama güvenlik zayıflamaz" ↔ kural 1/7: uyumlu, çelişki yok.
- V2 `MIXED_GROUP` çoklu tüzel kişi ↔ bugünkü tek-tenant modeli: MVP'de
  MIXED_GROUP = tek tüzel kişi tenant'ı + profile bayrağı; çoklu-entity
  konsolidasyonu KAPSAM DIŞI (V2 §4.1 uyarısına uygun; ADR-V2-1'de sınır).

---

## 4. ADR taslakları (kurucu onayına)

### ADR-V2-1 — Organization Segmentation
`organization_profiles` (tenant_id 1:1, RLS): `organization_type`
(REGULATED_FINANCIAL_INSTITUTION | CORPORATE_FINANCE | MIXED_GROUP) + V2 §4.1
alanları (sektörler[], regulatedStatus, jurisdictions[], employeeBand,
finance* alanları, erp_systems[], band'ler…). `tenants.segment` OLDUĞU GİBİ
kalır (mevcut davranış/e2e bozulmaz); okuma tarafı organization_type'a geçer.
Onboarding sorusu ("hangi amaçla?") profil yazımıdır; **değişiklik kilitli
değildir** — yetkili değiştirir, scope-recalculation outbox olayı + audit
düşer. MIXED_GROUP MVP sınırı: tek tüzel kişi; çoklu-entity ayrı taş.

### ADR-V2-2 — Obligation Basis Types
Dayanak, kontrolün KENDİSİNE değil pack-bağına (`pack_controls.basis`) yazılır:
LEGAL_MANDATORY | CONTRACTUAL | BOARD_POLICY | BEST_PRACTICE. DB check +
UI'da `StatusBadge` eşlemesi (ikon+metin; BEST_PRACTICE asla mevzuat gibi
gösterilmez — ayrı semantik). Guard'lar: CONTRACTUAL→VERIFIED ancak sözleşme
referansı doluysa; BOARD_POLICY karar/politika sürüm alanı ister;
LEGAL_MANDATORY doğrulanmış hüküm referansı ister (M21 gelene dek
`TODO_DOGRULA` disipliniyle — kural 3). Dayanak DEĞİŞİMİ audit trigger'ı üretir.

### ADR-V2-3 — Versioned Plan/Entitlement
Tablolar: `product_plans` + `plan_versions` (yetenek matrisi JSONB — limitler
KODA GÖMÜLMEZ, V2 §7) + `tenant_subscriptions` (aktif plan_version FK) +
`subscription_events` (append-only) + `entitlement_decisions` (opsiyonel karar
izi). **Yetki zorlaması server-side:** rotalar `entitlementVar(tenant, "yetenek")`
yardımcısından geçer; kritik yetenekler için DB'de de kontrol (RLS'e plan
katmak yerine SECURITY DEFINER yardımcı fonksiyon — RLS politikalarını
şişirmemek bilinçli; en hassas yüzeylerde policy'ye eklenebilir, PR'da
belirlenir). Downgrade veri SİLMEZ: yetenek dışı kalan veri read-only'ye düşer
(yazma rotası entitlement reddi; SELECT serbest). Trial DB zamanıyla
(`now()`), istemci saatine güven yok. **Billing provider = OPEN-DECISION (K3):**
MVP'de manuel/mock provisioning (admin script + subscription_events kaydı) —
V2 §4.3'ün açıkça izin verdiği yol.

### ADR-V2-4 — Read-only Finance Integration Boundary
MVP'de ERP/banka/IAM'e HİÇBİR yazma, HİÇBİR credential saklama, HİÇBİR
scraping. Veri girişi: CSV import (mevcut güvenli hat — formula-injection/
MIME/boyut korumaları AYNEN) + kullanıcı beyanı/kanıt yükleme.
`supplier_bank_change_verifications`: maskeli eski/yeni değer (`TR** **** 1234`
biçimi) + `sha256(normalize(iban))` referans hash'i — TAM IBAN SAKLANMAZ
(veri minimizasyonu); out-of-band kanal, bağımsız doğrulayan (maker-checker
guard'ları SoD istisna desenindekiyle aynı: kimlik atfı auth.uid()'e sabit),
kanıt referansı (`evidences` FK). ERP/banka erişim review'u = mevcut SoD import
hattına yeni kaynak türü; ayrı motor YAZILMAZ.

### ADR-V2-5 — Product Analytics Privacy
`activation_events` (tenant_id, event_type, occurred_at, meta JSONB) —
**kanıt içeriği, kişi adı, IBAN, serbest metin TAŞIMAZ** (kural 7 + V2 §4.5);
meta yalnız sayısal/enum. TTV metrikleri (`time_to_first_evidence` vb.) bu
olaylardan TÜRETİLİR (saf fonksiyon, panoda). Saklama: 24 ay, sonra toplulaştır
(öneri — K6). Üçüncü taraf analytics YOK (MVP'de kendi tablomuz). Kurucu
finansal hedefleri (125 logo, ARR) ürün koduna/fixture'a GİRMEZ.

### ADR-V2-6 — Compliance Capability Coverage Ledger
`compliance_capabilities` + `capability_coverage` (durum: NOT_PLANNED…
PARTNER_DEPENDENT) + `coverage_evidence` (test/e2e/dokümana bağ) +
`coverage_gaps` + `replacement_candidates`. INTERNAL admin görünümü (yeni rol
değil: admin); son kullanıcı roadmap'i DEĞİL. PRODUCTION_READY geçişi kanıt
referansı İSTER (test dosyası/ADR linki olmadan geçilemez — DB guard).
İlk seed: bugünkü gerçek durum (SoD=PRODUCTION_READY, evidence=PRODUCTION_READY,
regulation-monitoring=PLANNED, training=DESIGN_ONLY, audit-workpapers=
DESIGN_ONLY vb.) — abartısız.

---

## 5. Migration planı (sıra — her biri kendi PR'ında, PGlite+canlı doğrulı)

1. **M16 kapanış PR'ı:** migration YOK (yalnız doküman/test/ölçüm — §6).
2. **PR "Segment+Entitlement":** `202607XX_organization_profiles.sql`
   (tablo+RLS+audit+scope-recalc outbox tetiği) →
   `202607XX_plan_entitlement.sql` (5 tablo + seed: 5 plan × v1 matris) →
   `202607XX_pack_iskeleti.sql` (control_packs/pack_versions/pack_controls
   + basis check + audit) — üç ayrı migration, tek PR.
3. **PR "CFO MVP":** `..._supplier_bank_change.sql` + baseline pack seed'i
   (data/packs/*.yaml — kural 3 disiplini: BEST_PRACTICE etiketiyle, uydurma
   mevzuat YOK) + activation_events.
4. **PR "Regulated dikey dilim":** M19–M24'ün TEK dikey dilimi (V1 planındaki
   kaynak sicili iskeleti + manuel ingest + provision/obligation + basit
   applicability + legal-basis guard + citation) — V2 §9 PR-4 kapsamı.

## 6. İLK PR — "M16 Üretim Kapanışı (platform maddeleri)" dosya planı

| İş | Dosyalar | Not |
|---|---|---|
| Yazılı threat model | `docs/guvenlik/THREAT_MODEL.md` (yeni) | Yüzey-bazlı (auth/RLS/import/rollback/storage/cron/outbox); bugünkü 3 kapatılmış açık vaka çalışması olarak girer |
| Backup/restore prosedürü + PROVA | `docs/operasyon/YEDEKLEME_GERI_YUKLEME.md` (yeni) | Supabase yedek durumu doğrulanır; restore provası STAGING kararına bağlı (K1) — staging yoksa sınırlı prova (yeni boş projeye şema restore) yazılır |
| Deploy rollback prosedürü | `docs/operasyon/DEPLOY_ROLLBACK.md` (yeni) | Hostinger: `git revert`+push akışı, health doğrulama adımları, migration geri alma İLKESİ (expand/contract) |
| AA otomatik tarama | `e2e/erisilebilirlik.spec.ts` (yeni) + `@axe-core/playwright` (devDependency) | Kritik 6 ekran light+dark axe taraması; ihlaller düzeltilir veya kanıtla istisna |
| Pool/limit ölçüm notu | `docs/operasyon/LIMITLER.md` (yeni) | Supabase plan limitleri + bugünkü kullanım ölçümü |
| Dış cron ADR | `docs/adr/ADR-dis-cron.md` (taslak, karar K2) | Seçenekler: pg_cron+pg_net→route (servis token) / Supabase Edge schedule / mevcut oto-drenaj yeterli |
| Kapı kapanış kaydı | ROADMAP M16 bölümü | Kanıt linkleriyle "kapı geçti" — yalnız kurucu onayından sonra |

Staging (K1) "evet" ise plana eklenir: ikinci Supabase projesi kurulum scripti
+ `db:push:staging` + e2e'nin staging'e karşı koşan varyantı.

## 7. Açık kurucu kararları (uydurulmadı — V2 §12 + platform)

1. **K1 — Staging ortamı:** ikinci Supabase projesi (+Hostinger staging app)
   açılsın mı? Kapının "migration staging'de denenmiş" ve V2 §14 "staging'de
   gerçek kullanıcı akışı" maddeleri buna bağlı. (Maliyet kararı.)
2. **K2 — Dış cron:** drenaj için servis-token'lı uç / Edge schedule /
   mevcut oto-drenaj yeterli.
3. **K3 — Billing provider:** Stripe/Paddle/iyzico/manuel fatura (MVP mock
   provisioning ile ilerler).
4. **K4 — Plan fiyatları, KDV/para birimi, trial süresi.**
5. **K5 — Partner komisyonu + delegation kapsamı.**
6. **K6 — Analitik saklama süresi (öneri: 24 ay).**
7. **K7 — İlk read-only ERP/banka connector hedefleri** (hangi ERP/banka).
8. Süregelenler: KMS/HSM, RFC 3161 TSA, hukuk doğrulama rolü, üçüncü taraf
   mevzuat lisansları, dış otorite gönderimi.

## 8. Bu turun doğrulama koşusu (ÖLÇÜLDÜ — 18 Temmuz gecesi)

- **Birim: 677 geçti / 0 başarısız / 0 skip** (44 dosya; typecheck+lint temiz).
- **e2e (gerçek Chromium + gerçek Supabase): 25 geçti / 0 başarısız / 0 skip.**
- **Production build: exit 0.**
- Flaky: bu koşuda yok (bugünkü PGlite yük-flake sınıfı 60sn global timeout
  ile sertleştirilmişti; not düşülür).
- Canlı sağlık: `/health/ready` → hazır/erisilebilir.

## 9. PR sırası (V2 §9 + repo gerçeği birleşik — bağlayıcı)

1. **M16 Üretim Kapanışı** (§6 — platform maddeleri; kod değil doküman/test/ölçüm ağırlıklı)
2. **Organization Segment + Entitlement Foundation** (ADR-V2-1/2/3; gerçek ödeme YOK)
3. **CFO Kalkanı MVP** (ADR-V2-4; profil wizard → baseline pack → SoD/ödeme
   kontrolleri → IBAN doğrulama kaydı → kanıt/test/bulgu → CFO dashboard →
   yönetim özeti; self-service e2e)
4. **Regulated Regulation→Evidence MVP** (tek dikey dilim; M19–M24 paralel açılmaz)
5. M17 Audit Workspace MVP → 6. M18 Training MVP → 7. Connector+Consolidation
   → 8. Product Analytics (V2 §9 sırası).
