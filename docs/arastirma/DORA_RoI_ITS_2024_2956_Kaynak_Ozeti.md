# DORA Register of Information — ITS 2024/2956 Kaynak Özeti

**Amaç:** 37 Tez talimatı Dikey B ("resmî DORA Register of Information (RoI)
uyumu") §4'ün açık şartı: "Önce güncel ve resmî AB kaynaklarını repo
araştırma alanına al; bağlayıcı şema/sürüm/doğrulama durumunu kaydet. Tez
veya blogdan RoI alanı uydurma." Bu belge o adımı karşılar.

## Doğruluk durumu — ÜÇ KATMANLI (20 Temmuz 2026, ÜÇÜNCÜ geçiş)

Kurucunun 20 Temmuz talimatı §1'in "EUR-Lex 2024/2956 metnini satır satır
doğrula" şartı için bu belge ÜÇÜNCÜ kez gözden geçirildi. İkinci geçişte
(`.../eli/reg_impl/2024/2956/oj/eng`) tek bir WebFetch B_06.01'den önce
kesiliyordu. Bu geçişte **alternatif EUR-Lex render'ı**
(`https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202402956`)
kullanılıp HER kalan boşluk için AYRI, HEDEFLİ fetch'ler yapıldı — bu render
farklı sayfalama sınırlarına sahip olduğundan önceki geçişte SOURCE_PENDING
kalan bir dizi alan artık **LEGAL_REVIEW_REQUIRED**'a yükseldi (§3'e taşındı):
Annex III S01-S16 (S17-S19 hâlâ ulaşılamadı — aşağıda), B_01.02.0050
"Hierarchy" kapalı kümesinin 5 seçeneği, B_02.02.0090 "Reason of termination"
kapalı kümesinin 6 seçeneği, ve B_02.03/B_03.01/B_03.02/B_03.03/B_04.01/
B_06.01/B_07.01 şablonlarının TAM alan listeleri. **B_99.01 yalnız yapısal
olarak doğrulandı** (C0010-C0040 sütunları, R0010-R0190 satırları — serbest
terminoloji eşlemesi, geleneksel "mandatory" sütunu yok).

S17-S19 (bulut IaaS/PaaS/SaaS) için EUR-Lex HTML render'ı S16'da kesiliyor;
JC 2023 85 (ESAs'ın taslak ITS raporu, EUR-Lex'in dayandığı birincil
belge) PDF'leri de denendi — EBA/betterregulation.com sunucuları PDF'i
metne çevrilemez biçimde (font/stream encoded) döndürdü veya 403 verdi.
**S17-S19 hâlâ TODO_DOGRULA kalıyor** (yalnız ikincil kaynak, springlex.eu) —
uydurulmuyor, dürüstçe işaretli.
Üç durum kullanılıyor (obligations/cloud-pack dört-göz sözlüğüyle uyumlu,
bkz. mapping ADR §0):

- **SOURCE_PENDING** — bu şablon/alan için hiç kaynak metni bulunamadı
  (ne birincil ne ikincil). Aşağıda hiç görünmeyen şablonlar/alanlar bu
  kategoridedir (bkz. §5 "Hâlâ SOURCE_PENDING").
- **TODO_DOGRULA** — bir kaynak metni VAR (ikincil, çapraz doğrulanmamış)
  ama EUR-Lex birincil sayfasından doğrudan alıntılanmadı.
- **LEGAL_REVIEW_REQUIRED** — EUR-Lex'in birincil sayfasından WebFetch ile
  DOĞRUDAN alıntılandı (aşağıda tırnak içinde/tablo halinde). Bu, ikincil
  kaynaktan daha güçlü bir iddiadır ama **HÂLÂ VERIFIED DEĞİLDİR** — WebFetch
  bir AI özetleme katmanından geçiyor, satır satır insan karşılaştırması
  YERİNE GEÇMEZ (transkripsiyon hatası riski sıfır değildir). Kod bu listeyi
  hiçbir zaman VERIFIED olarak seed ETMEYECEK.

**Hiçbir madde bu belgede VERIFIED değildir.** VERIFIED'e geçiş yalnız bir
hukuk/uyum doğrulayıcısının EUR-Lex'in resmi PDF/HTML baskısıyla birebir
karşılaştırıp DB'deki `roi_kaynak_kayitlari` satırını LEGAL_REVIEW'den
VERIFIED'e taşımasıyla olur (dört-göz guard'lı — bkz. migration).

## 1. Bağlayıcı kaynak (kimlik)

- **Regülasyon:** Commission Implementing Regulation (EU) 2024/2956 of 29
  November 2024, laying down implementing technical standards (ITS) for the
  application of Regulation (EU) 2022/2554 (DORA) with regard to standard
  templates for the register of information on ICT third-party arrangements.
- **Resmi Gazete'de yayın:** 2 Aralık 2024. **Yürürlük:** 17 Ocak 2025.
- **EUR-Lex kalıcı bağlantı:** `https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng`
- **Dayanak madde (ana regülasyon):** DORA Madde 28(3).
- İkincil kaynaklar (yalnız çapraz doğrulama için): EBA özet sayfası,
  ESMA/JC final report (JC 2023 85), springlex.eu Annex III özeti.

## 2. Şablon envanteri (LEGAL_REVIEW_REQUIRED — EUR-Lex'ten doğrudan doğrulandı: 13 şablon + Annex I-IV yapısı)

| Şablon | Amaç |
|---|---|
| B_01.01 | Kaydı tutan kuruluşun kimliği |
| B_01.02 | Kapsamdaki tüm kuruluşların listesi |
| B_01.03 | Ana ülke dışındaki şubeler |
| B_02.01 | Sözleşme düzenlemesi — genel bilgi |
| B_02.02 | Sözleşme düzenlemesi — özel bilgi |
| B_02.03 | Grup-içi ↔ dış düzenleme bağlantısı |
| B_03.01 | İmzalayan taraf kuruluşlar |
| B_03.02 | İmzalayan ICT sağlayıcılar |
| B_03.03 | Grup-içi ICT hizmeti sağlayan kuruluşlar |
| B_04.01 | ICT hizmetini fiilen kullanan kuruluşlar |
| B_05.01 | ICT üçüncü taraf sağlayıcı kimliği |
| B_05.02 | ICT tedarik zinciri |
| B_06.01 | Fonksiyon kimliği + kritiklik değerlendirmesi |
| B_07.01 | Kritik/önemli fonksiyon risk değerlendirmesi |
| B_99.01 | Kuruluş-içi tanım/terminoloji |

**Annex yapısı (LEGAL_REVIEW_REQUIRED):** Annex I = şablon doldurma
talimatları; Annex II = finansal kuruluş türüne göre lisanslı faaliyetlerin
dayandığı hukuki metinler; Annex III = "Type of ICT services" kapalı kümesi;
Annex IV = parasal değer raporlama rehberi.

**Veri kalitesi ilkeleri (LEGAL_REVIEW_REQUIRED, Madde 3(4) — birebir alıntı):**
> "accuracy; completeness; consistency; integrity; uniformity; validity"

**Şablon format kuralı (LEGAL_REVIEW_REQUIRED, Madde 4 — birebir alıntı):**
> "each template composing the register of information shall be a table
> with a predefined number of columns and an indefinite number of rows"

## 3. Alan bazlı detay — EUR-Lex'ten birebir alıntılanan şablonlar (LEGAL_REVIEW_REQUIRED)

### B_01.01 — Kaydı tutan kuruluş (Entity maintaining the register)

| Kod | Alan | Zorunluluk (birebir) |
|---|---|---|
| B_01.01.0010 | LEI of the financial entity maintaining the register | Mandatory |
| B_01.01.0020 | Name of the financial entity | Mandatory |
| B_01.01.0030 | Country of the financial entity | Mandatory |
| B_01.01.0040 | Type of financial entity (kapalı küme, §4) | Mandatory |
| B_01.01.0050 | Competent authority | "Mandatory in case of reporting" |
| B_01.01.0060 | Date of the reporting | "Mandatory in case of reporting" |

### B_01.02 — Kapsamdaki kuruluşlar listesi

| Kod | Alan | Zorunluluk (birebir) |
|---|---|---|
| B_01.02.0010 | LEI of the financial entity | Mandatory |
| B_01.02.0020 | Name of the financial entity | Mandatory |
| B_01.02.0030 | Country of the financial entity | Mandatory |
| B_01.02.0040 | Type of financial entity (kapalı küme, §4) | Mandatory |
| B_01.02.0050 | Hierarchy of the financial entity within the group (kapalı küme, 5 seçenek — **birebir metin §3b'de**) | Mandatory |
| B_01.02.0060 | LEI of the direct parent undertaking | Mandatory |
| B_01.02.0070 | Date of last update | Mandatory |
| B_01.02.0080 | Date of integration in the register | Mandatory |
| B_01.02.0090 | Date of deletion in the register (silinmemişse '9999-12-31') | Mandatory |
| B_01.02.0100 | Currency (ISO 4217) | "Mandatory only if B_01.02.0110 is reported" |
| B_01.02.0110 | Value of total assets | "Mandatory if the entity is a financial entity" |

### B_01.03 — Şubeler

| Kod | Alan | Zorunluluk |
|---|---|---|
| B_01.03.0010 | Identification code of the branch (LEI veya iç kod) | Mandatory |
| B_01.03.0020 | LEI of the financial entity head office of the branch | Mandatory |
| B_01.03.0030 | Name of the branch | Mandatory |
| B_01.03.0040 | Country of the branch (ISO 3166-1 alpha-2) | Mandatory |

### B_02.01 — Sözleşme düzenlemesi (genel)

| Kod | Alan | Zorunluluk |
|---|---|---|
| B_02.01.0010 | Contractual arrangement reference number — "unique and consistent over time at entity, sub-consolidated and consolidated level" | Mandatory |
| B_02.01.0020 | Type of contractual arrangement — kapalı küme: standalone / overarching-master / subsequent-associated | Mandatory |
| B_02.01.0030 | Overarching contractual arrangement reference number | Mandatory (koşullu — standalone/overarching'in kendisiyse N/A) |
| B_02.01.0040 | Currency (ISO 4217) | Mandatory |
| B_02.01.0050 | Annual expense/estimated cost | Mandatory |

### B_02.02 — Sözleşme düzenlemesi (özel) — TAM LİSTE

| Kod | Alan | Zorunluluk (birebir) |
|---|---|---|
| B_02.02.0010 | Contractual arrangement reference number (B_02.01.0010'dan) | Mandatory |
| B_02.02.0020 | LEI of the financial entity making use of the ICT service(s) | Mandatory |
| B_02.02.0030 | Identification code of the ICT third-party service provider | Mandatory |
| B_02.02.0040 | Type of code to identify the ICT third-party service provider | Mandatory |
| B_02.02.0050 | Function identifier (B_06.01.0010'dan) | Mandatory |
| B_02.02.0060 | Type of ICT services (Annex III kapalı kümesi) | Mandatory |
| B_02.02.0070 | Start date of the contractual arrangement (ISO 8601) | Mandatory |
| B_02.02.0080 | End date of the contractual arrangement (ISO 8601) | Mandatory |
| B_02.02.0090 | Reason of the termination or ending (kapalı küme, 6 seçenek — **birebir metin §3b'de**) | "Mandatory if the contractual arrangement is terminated" |
| B_02.02.0100 | Notice period for the financial entity (takvim günü) | "Mandatory if...critical or important function" |
| B_02.02.0110 | Notice period for the ICT third-party service provider | "Mandatory if...critical or important function" |
| B_02.02.0120 | Country of the governing law (ISO 3166-1 alpha-2) | "Mandatory if...critical or important function" |
| B_02.02.0130 | Country of provision of the ICT services | "Mandatory if...critical or important function" |
| B_02.02.0140 | Storage of data (Yes/No) | "Mandatory if...critical or important function" |
| B_02.02.0150 | Location of the data at rest (storage) | "Mandatory if 'Yes' is reported in B_02.02.0140" |
| B_02.02.0160 | Location of management of the data (processing) | "Mandatory if...data processing" |
| B_02.02.0170 | Sensitiveness of the data stored — kapalı küme: Low/Medium/High | "Mandatory if...stores data AND...critical or important" |
| B_02.02.0180 | Level of reliance on the ICT service — kapalı küme (4 seçenek, "Not significant" → "Full reliance") | "Mandatory if...critical or important" |

### Type of financial entity (B_01.01.0040 / B_01.02.0040) — kapalı küme, 22 madde

1. credit institutions
2. payment institutions (Directive (EU) 2015/2366 muafları dahil)
3. account information service providers
4. electronic money institutions (Directive 2009/110/EC muafları dahil)
5. investment firms
6. crypto-asset service providers (Regulation (EU) 2023/1114)
7. issuers of asset-referenced tokens (Regulation (EU) 2023/1114)
8. central securities depositories
9. central counterparties
10. trading venues
11. trade repositories
12. managers of alternative investment funds
13. management companies
14. data reporting service providers
15. insurance and reinsurance undertakings
16. insurance/reinsurance/ancillary insurance intermediaries
17. institutions for occupational retirement provision
18. credit rating agencies
19. administrators of critical benchmarks
20. crowdfunding service providers
21. securitisation repositories
22. other financial entity

## 3b. YENİ (20 Temmuz, üçüncü geçiş) — alternatif EUR-Lex render'ından birebir alıntı (LEGAL_REVIEW_REQUIRED)

### B_01.02.0050 — "Hierarchy of the financial entity within the group" (kapalı küme, birebir)

> "1. The financial entity is the ultimate parent undertaking in the
> consolidation; 2. The financial entity is the parent undertaking of a
> sub-consolidated part in the consolidation; 3. The financial entity is a
> subsidiary in the consolidation and is not a parent undertaking of a
> sub-consolidated part; 4. The financial entity is not part of a group;
> 5. The financial entity is a service provider to which the financial
> entity (or the third-party service provider acting on its behalf) is
> outsourcing all its operational activities."

### B_02.02.0090 — "Reason of the termination or ending" (kapalı küme, birebir)

> "1. Termination not for cause: The contractual arrangement has
> expired/ended and has not been renewed by any of the parties;
> 2. Termination for cause: The contractual arrangement has been
> terminated, the ICT third-party service provider being in a breach of
> applicable law, regulations or contractual provisions; 3. Termination
> for cause: ...impediments of the ICT third-party service provider
> capable of altering the supported function have been identified;
> 4. Termination for cause: ...weaknesses of the ICT third-party service
> provider regarding the management and security of sensitive data or
> information of any of the counterparties; 5. Termination following a
> request by a competent authority; 6. Other: ...for any other reason than
> the reasons referred to in points 1 to 5."

### B_02.03 — Grup-içi sözleşme düzenlemeleri listesi

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_02.03.0010 | Contractual arrangement reference number | Mandatory |
| B_02.03.0020 | Contractual arrangement linked to the contractual arrangement referred in B_02.03.0010 | Mandatory |

### B_03.01 — ICT hizmeti almak için sözleşmeyi imzalayan kuruluşlar

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_03.01.0010 | Contractual arrangement reference number | Mandatory |
| B_03.01.0020 | LEI of the entity signing the contractual arrangement | Mandatory |

### B_03.02 — Sözleşmeyi imzalayan ICT üçüncü taraf sağlayıcılar

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_03.02.0010 | Contractual arrangement reference number | Mandatory |
| B_03.02.0020 | Identification code of ICT third-party service provider | Mandatory |
| B_03.02.0030 | Type of code to identify the ICT third-party service provider | Mandatory |

### B_03.03 — ICT hizmeti sağlamak için sözleşmeyi imzalayan kuruluşlar

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_03.03.0010 | Contractual arrangement reference number | Mandatory |
| B_03.03.0020 | LEI of the financial entity providing ICT services | Mandatory |

### B_04.01 — ICT hizmetini fiilen kullanan kuruluşlar

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_04.01.0010 | Contractual arrangement reference number | Mandatory |
| B_04.01.0020 | LEI of the financial entity making use of the ICT service(s) | Mandatory |
| B_04.01.0030 | Nature of the financial entity making use of the ICT service(s) | Mandatory |
| B_04.01.0040 | Identification code of the branch | Conditional |

### B_06.01 — Fonksiyon kimliği + kritiklik değerlendirmesi (TAM liste, birebir)

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_06.01.0010 | Function Identifier | Mandatory |
| B_06.01.0020 | Licenced activity | Mandatory |
| B_06.01.0030 | Function name | Mandatory |
| B_06.01.0040 | LEI of the financial entity | Mandatory |
| B_06.01.0060 | Criticality or importance assessment | Mandatory |
| B_06.01.0070 | Reasons for criticality or importance | Optional |
| B_06.01.0080 | Date of the last assessment of criticality or importance | Mandatory |
| B_06.01.0090 | Recovery time objective of the function | Mandatory |
| B_06.01.0100 | Recovery point objective of the function | Mandatory |
| B_06.01.0110 | Impact of discontinuing the function | Mandatory |

### B_07.01 — ICT hizmetlerinin değerlendirilmesi (TAM liste, birebir)

| Kod | Alan (birebir) | Zorunluluk |
|---|---|---|
| B_07.01.0010 | Contractual arrangement reference number | Mandatory |
| B_07.01.0020 | Identification code of the ICT third-party service provider | Mandatory |
| B_07.01.0030 | Type of code to identify the ICT third-party service provider | Mandatory |
| B_07.01.0040 | Type of ICT services | Mandatory |
| B_07.01.0050 | Substitutability of the ICT third-party service provider | Mandatory |
| B_07.01.0060 | Reason where the ICT third-party service provider is considered not substitutable or difficult to be substitutable | Conditional |
| B_07.01.0070 | Date of the last audit on the ICT third-party service provider | Mandatory |
| B_07.01.0080 | Existence of an exit plan | Mandatory |
| B_07.01.0090 | Possibility of reintegration of the contracted ICT service | Mandatory |
| B_07.01.0100 | Impact of discontinuing the ICT services | Mandatory |
| B_07.01.0110 | Are there alternative ICT third-party service providers identified? | Mandatory |
| B_07.01.0120 | Identification of alternative ICT TPP | Optional |

### B_99.01 — Kuruluş-içi terminoloji (yapısal olarak doğrulandı)

Sütunlar `B_99.01.C0010`-`C0040`, satırlar `B_99.01.R0010`-`R0190` — diğer
şablonlardaki kapalı-küme göstergelerinin kuruma özgü tanım eşlemesini
tutan serbest-terminoloji tablosu (geleneksel "mandatory" sütunu yok).

### B_05.01 — ICT üçüncü taraf sağlayıcı kimliği (TODO_DOGRULA — yalnız ikincil kaynak)

| Kod | Alan | Tip |
|---|---|---|
| B_05.01.0010 | Kimlik kodu | Alfanümerik |
| B_05.01.0020 | Kod türü | Desen (LEI/EUID/Ülke_Tür) |
| B_05.01.0050 | Yasal ad | Alfanümerik |
| B_05.01.0080 | Merkez ülkesi | Ülke kodu |
| B_05.01.0100 | Toplam yıllık gider | Parasal |
| B_05.01.0110 | Nihai ana şirket kimliği | Alfanümerik |

### B_05.02 — ICT tedarik zinciri (TODO_DOGRULA — yalnız ikincil kaynak)

| Kod | Alan | Tip |
|---|---|---|
| B_05.02.0010 | Düzenleme referans numarası | Alfanümerik |
| B_05.02.0020 | ICT hizmet türü | Kapalı küme (S01-S19) |
| B_05.02.0030 | Sağlayıcı kimlik kodu | Alfanümerik |
| B_05.02.0050 | Sıra (rank) — doğrudan sağlayıcı=1, alt yüklenici=2+ | Doğal sayı |
| B_05.02.0060 | Alt yüklenici alıcı kimliği | Alfanümerik |

### ICT hizmet türü kapalı kümesi — Annex III (S01-S16 birebir, S17-S19 hâlâ TODO_DOGRULA)

| Kod | Hizmet türü (birebir başlık) | Açıklama (birebir) |
|---|---|---|
| S01 | ICT project management | "Provision of services related to Project Management Officer (PMO)." |
| S02 | ICT Development | "Provision of services related to: business analysis, software design and development, testing." |
| S03 | ICT help desk and first level support | "Provision of services related to: helpdesk support and first level support on ICT incident" |
| S04 | ICT security management services | "Provision of services related to: ICT security (protection, detection, response and recovering), including security incident handling and forensics." |
| S05 | Provision of data | "Subscription to the services of data providers. (digital data service)" |
| S06 | Data analysis | "Provision of services related to the support for data analysis. (digital data service)" |
| S07 | ICT, facilities and hosting services (excluding Cloud services) | "Provision of ICT infrastructure, facilities and hosting services, including...utilities...telecom access and physical security (excluding cloud services), payment-processing activities, or operating payment infrastructures" |
| S08 | Computation | "Provision of digital processing capabilities (including data computation), excluding...cloud environment." |
| S09 | Non-Cloud Data storage | "Provision of data storage platform (excluding cloud services)." |
| S10 | Telecom carrier | "Operations for telecommunication systems and flow management." |
| S11 | Network infrastructure | "Provision of network infrastructure" |
| S12 | Hardware and physical devices | "Provision of workstations, phones, servers, data storage devices, appliances, etc. in a form of a service" |
| S13 | Software licencing (excluding SaaS) | "Provision of software run on premises." |
| S14 | ICT operation management (including maintenance) | "Provision of services related to: infrastructure...configuration, maintenance, installing, capacity management, business continuity management, etc." |
| S15 | ICT Consulting | "Provision of intellectual / ICT expertise services." |
| S16 | ICT Risk management | "Verification of compliance with ICT risk management requirements in accordance with Article 6(10) of Regulation (EU) 2022/2554" |
| S17 | Bulut hizmetleri: IaaS (**TODO_DOGRULA — ikincil kaynak**) | springlex.eu özetinden, EUR-Lex birebir metni ULAŞILAMADI |
| S18 | Bulut hizmetleri: PaaS (**TODO_DOGRULA — ikincil kaynak**) | springlex.eu özetinden, EUR-Lex birebir metni ULAŞILAMADI |
| S19 | Bulut hizmetleri: SaaS (**TODO_DOGRULA — ikincil kaynak**) | springlex.eu özetinden, EUR-Lex birebir metni ULAŞILAMADI |

**NOT (kural 3 dürüstlüğü, güncellendi 20 Temmuz):** S01-S16 artık EUR-Lex'in
alternatif HTML render'ından BİREBİR alıntılandı. S17-S19 (bulut IaaS/PaaS/
SaaS — KALKAN_OS'un müşterileri için en yüksek isabet olasılıklı üçü) hâlâ
ulaşılamadı: EUR-Lex render'ı S16'da kesiliyor, JC 2023 85 (ESAs'ın taslak
ITS raporu — EUR-Lex'in dayandığı birincil belge) PDF'leri EBA/betterregulation
sunucularından metne çevrilemez biçimde döndü (font/stream encoded) veya 403
verdi. **S17-S19 dürüstçe TODO_DOGRULA kalıyor** — uydurulmadı; export motoru
(Dikey B faz 3) bu üçünü VERIFIED bir kaynağa dayanmadan export'a sokmayacak
(bkz. ADR güncellemesi).

## 4. Hâlâ SOURCE_PENDING/TODO_DOGRULA (20 Temmuz sonrası kalan)

- **S17-S19** (yukarıda) — TODO_DOGRULA, ikincil kaynak.
- **B_05.01/B_05.02** (ICT üçüncü taraf sağlayıcı kimliği + tedarik zinciri) —
  hâlâ yalnız ikincil kaynaktan (TODO_DOGRULA), EUR-Lex birincil metinle
  KARŞILAŞTIRILMADI (bu geçişte hedeflenmedi — sıradaki geçişin adayı).
- Annex II (lisanslı faaliyet dayanakları), Annex IV (parasal değer rehberi)
  tam metinleri.
- EUID'in (Directive (EU) 2017/1132 Madde 16) B_01.01/B_01.02'deki LEI'ye
  ALTERNATİF bir kimlik kodu olarak kabul edilip edilmediği — EUR-Lex'ten
  fetch edilen B_01.01/B_01.02 metninde yalnız LEI isteniyor gibi görünüyor;
  EUID kavramı yalnız B_05.01.0020 (sağlayıcı kimlik kodu türü) bağlamında
  ikincil kaynakta geçti. **Bu tutarsızlık ADR'de açıkça not edildi — EUID
  alanı şemaya eklenir ama "kurum kimliği" bağlamındaki resmi zorunluluğu
  SOURCE_PENDING kalır.**

## 5. Sıradaki adım

Bu belge KAYNAK ÖZETİDİR — şema/mapping kararı
`docs/adr/PR0-37-tez-dikeyB-roi-mapping-2026-07-19.md`'de, export motoru
kararı `docs/adr/PR0-37-tez-dikeyB-export-2026-07-20.md`'de. İlk migration
dilimi (kurum yasal kimlik profili + RoI kaynak durum tablosu, İÇERİK
SEED'İ YOK) ROADMAP §1.58'de teslim edildi; bu geçiş (üçüncü, 20 Temmuz)
kurucunun "önce hukuk ve kaynak kilidi" talimatının §1 maddesini karşılar —
ROADMAP §1.60.
