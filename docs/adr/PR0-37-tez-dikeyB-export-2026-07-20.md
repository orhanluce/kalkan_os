# PR-0 — 37 Tez Dikey B, Faz 2-5: DORA RoI Export Motoru — Öncelik Sıfırlama + Faz 1 Kapanışı (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz ikinci talimatı. Özet: Dikey C (Claim Guard)
bitti; artık öncelik **tek dikey** olarak Dikey B'nin export dilimine
kayıyor. ML-eval'e özgü dar kapsam ve ileri AI özellikleri BEKLETİLİYOR.
Kurucunun önerdiği sıra: (1) Hukuk ve kaynak kilidi, (2) DORA RoI veri
modeli, (3) Export motoru, (4) Kanıt zinciri, (5) Kurumsal arayüz.

## 0. Harf çakışması — dürüstçe kayıt (kod değişikliği GEREKTİRMEZ)

Kurucunun bu talimattaki "Dikey D/E/F/G/H" listesi (dayanıklılık grafiği,
bulut/3.taraf, test/tatbikat, AI Assurance, regülasyon değişikliği) **19
Temmuz Gap Map'inin (`docs/GAP_MAP_37_TEZ.md`) mevcut Dikey D-K harflerinden
FARKLI bir kavramsal gruplamadır** — Gap Map'te D=KOS-6 (açıklama/itiraz,
DIŞ KARAR bekliyor), E=KOS-5 kalanı (AI Assurance), F=KOS-1, G=KOS-2
(dayanıklılık grafiği), H=KOS-8 kalanı. Kurucunun yeni D'si (dayanıklılık
grafiği) Gap Map'in G'sine, yeni E'si (bulut/3.taraf) Gap Map'in H'sine,
yeni G'si (AI Assurance) Gap Map'in E'sine karşılık geliyor gibi görünüyor
— ama birebir örtüşmüyor (yeni F "test/tatbikat kanıt motoru" ve yeni H
"regülasyon değişikliği etki analizi" Gap Map'te AYRI bir KOS numarasına
sahip değil, muhtemelen KOS-1/KOS-2'nin alt kırılımları).

**Karar: Gap Map'in KOS-numaralı harf ataması KORUNUR** (37 Tez talimatının
kendi kuralı: "KOS etiketleri yalnız bir eşleme katmanıdır, modül numaraları
değişmez" — harfler de aynı disipline tabi tutulur, karışıklığı önlemek
için). Kurucunun bu talimattaki sıralaması **KOS referanslarıyla** takip
edilecek: DORA RoI export (KOS-8/Dikey B'nin devamı) → dayanıklılık grafiği
(KOS-2/Dikey G) → bulut/3.taraf güvence (KOS-8 kalanı/Dikey H) → test/
tatbikat kanıt motoru (mevcut M7-M9 simülasyon altyapısının GENİŞLETİLMESİ,
yeni bir KOS'a karşılık gelmiyor — kod incelemesinde netleştirilecek) → AI
Assurance/model risk (KOS-5 kalanı/Dikey E) → regülasyon değişikliği etki
analizi (KOS-1/Dikey F'nin bir parçası olabilir). Bu ADR yalnız BİRİNCİ
maddeyi (DORA RoI export) kapsıyor; sıradaki dört madde kendi ADR'lerini
alacak.

## 1. Faz 1 — Hukuk ve kaynak kilidi (BU TESLİMDE)

### 1.1 EUR-Lex metnini satır satır doğrulama — ÜÇÜNCÜ geçiş tamamlandı

`docs/arastirma/DORA_RoI_ITS_2024_2956_Kaynak_Ozeti.md` üçüncü kez
güncellendi. Alternatif EUR-Lex HTML render'ı (`.../TXT/HTML/?uri=OJ:
L_202402956`) farklı sayfalama sınırına sahip olduğundan önceki SOURCE_
PENDING alanların ÇOĞU artık **LEGAL_REVIEW_REQUIRED** (EUR-Lex'ten birebir
alıntı, hâlâ VERIFIED değil — insan karşılaştırması gerekiyor):
- B_01.02.0050 "Hierarchy" kapalı kümesi (5 seçenek) — birebir.
- B_02.02.0090 "Reason of termination" kapalı kümesi (6 seçenek) — birebir.
- B_02.03, B_03.01, B_03.02, B_03.03, B_04.01, B_06.01, B_07.01 TAM alan
  listeleri — birebir.
- Annex III S01-S16 (16/19) — birebir kod+başlık+açıklama.
- B_99.01 yapısal doğrulama (sütun/satır şeması).

**Hâlâ TODO_DOGRULA/SOURCE_PENDING (dürüstçe, uydurulmadı):** Annex III
S17-S19 (bulut IaaS/PaaS/SaaS — üç WebFetch denemesi + iki JC 2023 85 PDF
denemesi başarısız: EUR-Lex render'ı S16'da kesiliyor, PDF'ler metne
çevrilemez biçimde döndü veya 403 verdi), B_05.01/B_05.02 (ICT sağlayıcı
kimliği/tedarik zinciri, bu geçişte hedeflenmedi), Annex II/IV tam metni,
EUID'in resmi statüsü.

### 1.2 "RoI şablonlarını VERIFIED yapmadan hukuk onayı zorunlu tut"

**Mekanizma ZATEN VAR, yeni kod GEREKMEDİ:** `roi_kaynak_kayitlari`
(migration `20260719310000`, dört-göz forward-fix `20260720000001`)
DB guard'ı VERIFIED'e geçişi zaten dört-göz + hukuk incelemesi olmadan
ENGELLİYOR (kural 3). **Faz 3'te (export motoru) eklenecek YENİ invariant:**
export bir alanı DOLDURURKEN o alanın dayandığı `roi_kaynak_kayitlari`
satırı VERIFIED DEĞİLSE, export o alanı BOŞ bırakır ve "doğrulanmamış
kaynak" uyarısı üretir — export ASLA LEGAL_REVIEW/TODO_DOGRULA/DRAFT_
RESEARCH durumundaki bir şablon tanımını sessizce kullanmaz. Bu, Dikey C'nin
`verifiedOnKosulDegerlendir` desenine benzer bir ÖNİZLEME fonksiyonu olacak
(Faz 3 ADR'sinde detaylandırılacak).

### 1.3 `guven_seviyesi` ve `jurisdiction` kriterleri — v1 taslak rubrik

Dikey C ADR'sinde açık kurucu kararı olarak bırakılmıştı. Bu talimat
"netleştir" diyor ama somut sayı vermiyor — **bu bir metodoloji kararı
(hukuki içerik DEĞİL, kural 3 kapsamına girmiyor)**, o yüzden burada bir v1
taslak öneriliyor; kurucu değiştirebilir:

**`guven_seviyesi` (assurance_claims, zaten var):**
- **YÜKSEK** — kaynak `roi_kaynak_kayitlari` VERIFIED VE kanıt referansı bir
  gerçek test koşusuna/imzalı dosyaya bağlı (`kanit_referanslari` içinde en
  az bir `evidences`/`test_runs` referansı).
- **ORTA** — kaynak VERIFIED ama kanıt yalnız serbest metin referansı
  (yapılandırılmış bağlantı yok), VEYA kaynak LEGAL_REVIEW'de (hukuk
  incelemesi sürüyor).
- **DÜŞÜK** — kaynak TODO_DOGRULA/DRAFT_RESEARCH VEYA hiç kaynak yok.

Bu rubrik KOD ZORLAMASI DEĞİL (guven_seviyesi hâlâ serbest seçim + zorunlu
gerekçe) — yalnız UI'da bir öneri/ipucu olarak gösterilebilir (Faz 5).

**`jurisdiction` (assurance_claims.yargi_alani, `regulatory_sources.
jurisdiction` ile DB-seviyesi tutarlılık):** **ZORLANMAYACAK** (Dikey C
ADR'sindeki orijinal karar korunuyor) — bir iddianın yargı alanı beyanı ile
kaynağının yargı alanı FARKLI olabilir (ör. TR kurumu bir AB düzenlemesine
gönüllü uyum iddiası taşıyabilir); DB kısıtı yanlış pozitif üretir. UI
tutarsızlık varsa UYARI gösterir (Faz 5), BLOK etmez.

## 2. Sıradaki (bu ADR'nin kapsamadığı, ayrı dilimler)

Faz 2 (DORA RoI veri modeli: kurum kimliği genişletmesi, ICT hizmet/
sözleşme/üçüncü taraf/alt yüklenici, kritik fonksiyon eşlemesi, S01-S19
kataloğu) kendi ADR'sini alacak — küçük, test edilebilir dilimlere
bölünecek (kurucunun kendi talimatı). İlk aday dilim: **ICT hizmet türü
kataloğu (S01-S19, global referans tablo, roi_kaynak_kayitlari deseninin
aynısı) + sözleşme düzenlemesi çekirdeği (B_02.01/02.02'nin en kritik
alanları)** — üçüncü taraf/alt yüklenici için mevcut `third_parties`/
`fourth_parties` tablolarının GENİŞLETİLMESİ tercih edilir (kural: var olan
yapı yeniden kullanılır, KOS-8 Gap Map notu). Faz 3 (export motoru), Faz 4
(kanıt zinciri), Faz 5 (kurumsal arayüz) bu sıralamayı takip eder.
