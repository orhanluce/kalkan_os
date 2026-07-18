# Nihai Tek Talimat (v3.0) — Fark Analizi ve Gate ↔ Repo Eşlemesi

**Tarih:** 18 Temmuz 2026 (gece)
**Bağlayıcı belge:** `docs/arastirma/KALKAN_OS_Nihai_Tek_Talimat_2026.md`
(birebir kopya, `fc /b` doğrulı). Belge §0 gereği bundan böyle TEK kurucu
talimatıdır; önceki talimat dosyaları (QRegu sprinti dahil) tarihsel
materyaldir. Çelişki sırası: güvenlik/bütünlük invariant'ları → repo'da
onaylı ADR + çalışan testler → nihai talimat → diğer belgeler.

---

## 1. Belge §2 "bilinen durum" ↔ GERÇEK durum (belge emri: farkı raporla)

Belgedeki durum bilgisi ESKİ (581 birim + 17 e2e; "M16 CSV import sıradaki
iş"). Repo'nun ölçülmüş gerçeği (18 Temmuz gece):

| Belge §2 varsayımı | Gerçek |
|---|---|
| 581 birim + 17 e2e | **800 birim (63 dosya) + 36 e2e, 0 skip** (PR-Q2b' ile 37) |
| M16 CSV import sıradaki iş | M16 ÜRETİM KAPISI GEÇTİ (kurucu onayı; 12 madde + platform kapanışı + PR-3A..3D serisi TAMAM) |
| M19+ modüller "eklenecek" | **M19-M24 dikey dilimi KODDA ve CANLIDA** (V2 PR-4a/4b + QRegu Q0/Q1'/Q2a'/Q2b'): kaynak sicili+ingest+tazelik, bitemporal provisions, dört-göz doğrulamalı obligations/mappings, applicability (UNKNOWN≠NA invariant'ı + wizard), legal-basis guard (M12'ye bağlı, e2e'li), execution legal snapshot, citation bundle + bağımsız verifier |
| M17/M18 ADR/tasarım düzeyinde | Değişmedi (doğru) — M17 ADR hâlâ açık iş |
| JWS/TSA kurucu kararına bağlı | Değişmedi (doğru) — LocalDevSigner dev; TSA adapter açık |

## 2. Gate ↔ repo eşlemesi

| Gate | Durum | Not |
|---|---|---|
| **G0** Baseline + M16 kapanışı | ✅ **GEÇTİ** | Belgedeki G0 listesi (istisna uzatma, CSV 3 aşama, outbox, atama UI, tetikler, dashboard, güvenlik/IDOR, iki-kullanıcı e2e) tamamı kodda; tek açık: **M17 ADR kararı** (kapı-sonrası iş, hâlâ bekliyor) |
| **G1** SPK/7545 source-to-proof dikeyi | 🟡 **çekirdek kodda, 3 eksik** | VAR: immutable artifact (Storage+hash), temporal provision, dört-göz VERIFIED, profil+açıklanabilir applicability (wizard dahil), legal snapshot, evidence envelope, audit package, offline verifier ×2 (`verify-paket`, `verify-sitasyon`). EKSİK: (a) **≥20 uzman doğrulamalı kontrol = KURUCU İÇERİK TESLİMİ** (kural 3 — kod bloklamıyor, içerik uydurulmaz); (b) **≥5 connector/deterministik test** — M12 deterministik test motoru var, 5 gerçek test tanımı İÇERİKLE gelir; connector G3'le kesişir; (c) **Proof Room** — mevcut `paylasim` (token'lı denetçi görüntüleme) genişletilecek |
| **G2** M34 Policy Lifecycle | ❌ YENİ | Kod yok; G1 kapanışından sonra ilk yeni-kod alanı |
| **G3** M39 Connector Hub + Proof altyapısı | 🟡 Proof katmanı büyük ölçüde VAR | Envelope/JWS adapter/offline verifier/portable package ✅; TSA adapter interface + connector sözleşmesi + ilk 3 connector ❌ (pilot stack = kurucu kararı) |
| **G4** M35 TPRM/ICT | ❌ YENİ | — |
| **G5** M37 AI Assurance | ❌ YENİ | AI karar sınırı ADR taslağı (PRQ0 §4) buraya girdi olur |
| **G6** M36 PrivacyOps | ❌ YENİ | — |
| **G7** M38 Regulatory Engagement + M41 Partner | ❌ YENİ | `paylasim`/denetçi odası temeli mevcut |
| **G8** M13/M17/M18 genişleme + M40 | 🟡 kısmen | M17/M18 ADR-only (değişmedi); M13 impact-tolerance şeması yok; M40 yeni |

**M34-M41 numaralandırması repo ROADMAP'ine "planlanan modüller" olarak
eklendi (kod yok, gate sırasıyla).** Mevcut milestone numaraları DEĞİŞMEDİ.

## 3. QRegu sprintinin kalan işlerinin gate'lere devri

QRegu belgesi artık tarihsel; teslim edilmiş Q0/Q1'/Q2a'/Q2b' kaydı ROADMAP
§1.16-1.19'da duruyor. Kalan Q işleri şu gate'lere devredildi:

- Q3 (20-40 doğrulanmış kontrol) → **G1** (kurucu içerik blocker'ı aynı).
- Q4 (Proof Room + decision receipt + transparency ledger) → Proof Room
  **G1**; SCITT-tarzı ledger **G3** (nihai §10 öncelik sırası: canonical →
  hash → JWS → TSA → verifier → SCITT araştırması → opsiyonel anchor).
- Q5 (connector) → **G3** (ilk 3 connector pilot stack'iyle — kurucu kararı).
- Q6 (AI Gateway + RegBench-TR) → **G5** + nihai §9 ajan mimarisi.
- Q7 (pilot/metrik) → nihai §13 metrikleri (aynı hedefler: <60dk kapsam,
  <1 gün ilk kanıt, <24s etki, <1s paket, ≥3 tasarım ortağı).

## 4. Çelişki/terminoloji kararları (daha sıkı olan üstün)

1. **Applicability sözlüğü:** canlı şema `APPLICABLE/NOT_APPLICABLE/
   CONDITIONAL/UNKNOWN` (+DB guard'ları). Nihai §4.7 üç durumu "ayrı" sayar,
   CONDITIONAL'ı dışlamaz — uyumlu, DEĞİŞİKLİK YOK.
2. **§11 geniş navigasyon:** ölü-link yasağı (PR-0 ADR) DAHA SIKI kural
   olarak korunur — nav kalemleri modül geldikçe eklenir; §11 hedef bilgi
   mimarisidir, bugünkü zorunluluk değil.
3. **G0 CSV import aşamaları:** zaten PR-3A/3B/3C/3D olarak birebir bu
   sırayla teslim edilmişti — yeniden yapılmaz (belge §0: tamamlanmış özellik
   yeniden yazılmaz).
4. **Belge §12 done kapısı** mevcut kapıyla aynı; ek olarak §15 rapor formatı
   bundan sonra kullanılacak.

## 5. Açık kurucu kararları (nihai §14 — değişiklik: 2 ek)

PRQ0 §9 listesi aynen geçerli; nihai talimat İKİ karar ekledi:
**veri yerleşimi/yeni hosting sağlayıcısı** ve **müşteriye hukuki
garanti/SLA**. Hiçbiri G1 kapanış KODUNU bloklamıyor; G1'in tek gerçek
blocker'ı kurucu İÇERİK teslimi (≥20 kontrol + hukuk doğrulayıcı rolü).

## 6. Sonraki sıra (nihai §8 + repo gerçeği)

1. **G1 kapanış dilimi:** Proof Room (paylasim genişletmesi: süreli salt-okur
   denetçi alanında artifact/receipt/verifier sonucu) + kurucu içerik teslimi
   beklenirken temporal corpus iyileştirmesi (fragment/`repealed_at` alanları)
   opsiyonel.
2. **G2 M34 Policy Lifecycle** (yeni kod alanı — şema+state machine+dört-göz
   deseni hazır).
3. G3 connector sözleşmesi + TSA adapter interface (karar beklerken interface).
Her PR: migration+RLS+audit+güvenlik testleri+gerçek Chromium e2e; rapor §15
formatında.
