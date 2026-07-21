# ADR — Dikey F, F2: Kritik Hizmet Test Paketi (mühürlü, tek kritik hizmet)

**Tarih:** 21 Temmuz 2026
**Durum:** KABUL EDİLDİ (kurucu kararı, bu belgede birebir yansıtılıyor)

## 1. Bağlam

F1'in Karar 2'si şunu açıkça F2'ye erteledi:

> "Yeni bir test motoru veya 'test programı/kampanya' tablosu KURULMAZ...
> REDDEDİLDİ (kurucu Karar 2) — F2'ye ertelendi."
> (`docs/adr/PR0-dikeyF-f1-...md` §2, §8, §10)

F2'nin sorusu: *"Bu kritik hizmet için yapılan dayanıklılık testinin bütün
kapsamı, bağlı kontrolleri, koşuları, bulguları ve yeniden testleri tek
mühürlü paket olarak nedir?"*

Grep sweep (bu oturum) repo'da ZATEN kurulu bir "mühürlü snapshot" ailesi
olduğunu doğruladı: `cloud_assurance_profile_snapshots` (Dikey E1),
`impact_graph_snapshots` (Dikey D), `roi_export_runs` (37 Tez Dikey B Faz 3).
F2 bu ailenin DÖRDÜNCÜ üyesi olacak — yeni bir desen icat edilmeyecek.

## 2. Karar

### 2.1 İsim
Tablo: `kritik_hizmet_test_paketi_snapshots`. UI: "Kritik Hizmet Test Paketi".
`test_kampanyasi_snapshots`/"kampanya" kelimesi KULLANILMADI — M8 simülasyon/
tatbikat diliyle karışma riski (kurucu kararı). Manifest şeması sabiti:
`WARDPROOF_CRITICAL_SERVICE_TEST_PACKAGE_V1` — repo genelinde `KALKAN_*`
öneki kullanılıyor (`KALKAN_CONTROL_TEST_RUN_MANIFEST_V3`,
`KALKAN_AUDIT_WORM_EXPORT_V1` vb.); kurucunun `WARDPROOF_` önerisi mevcut
standartla çelişiyor, bu yüzden **`KALKAN_CRITICAL_SERVICE_TEST_PACKAGE_V1`**
olarak uyarlandı (kurucunun kendi talimatı: "mevcut standarda uyarlayın; yeni
bir isimlendirme standardı icat etmeyin").

### 2.2 Kapsam
Snapshot TEK bir `critical_service_id` içindir. Çoklu-hizmet kampanyası
kapsam dışı.

### 2.3 Kapsam çözümleme (kural 11)
İki güvenilir kaynak, deterministik birleşim:
1. Doğrudan: `control_test_definitions.critical_service_id = X`
2. Dolaylı: `control_test_definitions.control_id ∈ (select control_id from
   critical_service_controls where critical_service_id = X)`

Aynı tanım iki yoldan da geliyorsa TEK kayıt, `bagTuru = 'BOTH'`.
`kritik_hizmet_adi` (serbest metin) ile otomatik eşleştirme YOK.

### 2.4 Koşu seçimi — iki katman
**A. Güncel güvence görünümü**: her test tanımı için EN GÜNCEL koşu; worst-of
YALNIZ bu görünüm üzerinden hesaplanır.
**B. Tarihsel iz özeti**: tam geçmiş KOPYALANMAZ — yalnız sayaçlar (toplam/
PASSED/FAILED/UNKNOWN/STALE/EXCEPTION), ilk/son koşu tarihi, kabul edilmiş
bulgu kimlikleri, kapanış retest kimlikleri.

### 2.5 Genel durum sınıflandırması (sayısal skor YOK)
`DOGRULANMIS | INCELEME_GEREKLI | ENGELLENDI | VERI_EKSIK | TEST_YOK` — tam
kural seti §6'da (kurucunun prompt'unda), motor implementasyonuna birebir
taşınacak. Belirsiz durumda `INCELEME_GEREKLI` (uydurma yok).

### 2.6 Motor
`src/lib/kritik-hizmet-test-paketi.ts` — saf, DB/ağ/AI/Date.now() çağrısı yok,
`asOf` girdiden gelir, deterministik.

### 2.7 Tablo ve immutability
`impact_graph_snapshots` deseninin BİREBİR AYNISI: `olusturan` sunucu
tarafında `auth.uid()`'e sabitlenir (istemciden asla güvenilmez), UPDATE
service_role dahil koşulsuz reddedilir, DELETE policy'si yok (RLS zaten
authenticated'a açmıyor), cross-tenant guard `critical_service_id` için,
audit trigger `after insert`. Maker-checker YOK — yeni bir uyum iddiası değil,
zaten guard'lı verilerin fotoğrafı.

### 2.8 Proof Room — 5. dal
`proof_room_links_tek_hedef` (güncel sürüm: `20260720250000`) 5 terime çıkar.
`proof_room_link_target_guard()` (güncel: `20260720280000`) 5. hedefi
doğrular. `proof_room_goruntule()` (güncel: `20260720330000`) yeni bir dal
alır — diğer dört dal DEĞİŞMEZ.

## 3. Reddedilen alternatifler
- Yeni test motoru/orkestrasyon: REDDEDİLDİ (F1 Karar 2'nin devamı).
- Çoklu kritik hizmet kampanyası: REDDEDİLDİ, sonraki dilim.
- Tam koşu geçmişini pakete gömmek: REDDEDİLDİ — snapshot şişer, kurucu
  açıkça "sınırlı tarihsel özet" istedi.
- Sayısal güven skoru: REDDEDİLDİ (kural: sahte kesinlik yok).
- impact-graph.ts genişletmesi: REDDEDİLDİ bu dilimde — ayrı F2.1 adayı.

## 4. Veri sahipliği/RLS/audit
Tenant-scoped select; insert yalnız admin/uyum; `olusturan` sunucu atfı;
`paket_hash` RFC 8785 `canonicalHash()`'ten (mevcut, yeniden uygulanmaz);
audit_log `after insert`.

## 5. Bilinçli kapsam dışı
Test programı/kampanya orkestrasyonu, M17 örnekleme köprüsü, M9/M12 manifest
birleşimi, RTO/RPO/`impact_tolerances`, impact-graph genişlemesi, yeni
connector, AI-üretilmiş sonuç, eski manifest mutasyonu.
