# DORA Register of Information — ITS 2024/2956 Kaynak Özeti

**Amaç:** 37 Tez talimatı Dikey B ("resmî DORA Register of Information (RoI)
uyumu") §4'ün açık şartı: "Önce güncel ve resmî AB kaynaklarını repo
araştırma alanına al; bağlayıcı şema/sürüm/doğrulama durumunu kaydet. Tez
veya blogdan RoI alanı uydurma." Bu belge o adımı karşılar.

## Doğruluk durumu — ÜÇ KATMANLI (19 Temmuz 2026, ikinci geçiş)

Kurucunun talimatıyla bu belge ikinci kez gözden geçirildi: ilk sürüm
tamamen ikincil kaynaklardan derlenmişti; bu sürümde **EUR-Lex'in birincil
sayfası** (`https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng`)
WebFetch ile doğrudan okunup birçok şablon için BİREBİR alıntı toplandı.
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
| B_01.02.0050 | Hierarchy of the financial entity within the group (kapalı küme, **5 seçenek — SOURCE_PENDING, metin bulunamadı**) | Mandatory |
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
| B_02.02.0090 | Reason of the termination or ending (kapalı küme, **6 seçenek — SOURCE_PENDING, metin bulunamadı**) | "Mandatory if the contractual arrangement is terminated" |
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

## 4. Alan bazlı detay — yalnız ikincil kaynaklardan (TODO_DOGRULA, EUR-Lex birincil metinle henüz karşılaştırılmadı)

### B_05.01 — ICT üçüncü taraf sağlayıcı kimliği

| Kod | Alan | Tip |
|---|---|---|
| B_05.01.0010 | Kimlik kodu | Alfanümerik |
| B_05.01.0020 | Kod türü | Desen (LEI/EUID/Ülke_Tür) |
| B_05.01.0050 | Yasal ad | Alfanümerik |
| B_05.01.0080 | Merkez ülkesi | Ülke kodu |
| B_05.01.0100 | Toplam yıllık gider | Parasal |
| B_05.01.0110 | Nihai ana şirket kimliği | Alfanümerik |

### B_05.02 — ICT tedarik zinciri

| Kod | Alan | Tip |
|---|---|---|
| B_05.02.0010 | Düzenleme referans numarası | Alfanümerik |
| B_05.02.0020 | ICT hizmet türü | Kapalı küme (S01-S19) |
| B_05.02.0030 | Sağlayıcı kimlik kodu | Alfanümerik |
| B_05.02.0050 | Sıra (rank) — doğrudan sağlayıcı=1, alt yüklenici=2+ | Doğal sayı |
| B_05.02.0060 | Alt yüklenici alıcı kimliği | Alfanümerik |

### B_06.01 — Fonksiyon kimliği + kritiklik

| Kod | Alan | Tip |
|---|---|---|
| B_06.01.0010 | Fonksiyon kimliği | Desen (F+sayı) |
| B_06.01.0030 | Fonksiyon adı | Alfanümerik |
| B_06.01.0060 | Kritiklik değerlendirmesi | Kapalı küme: Yes/No/Assessment not performed |
| B_06.01.0070 | Değerlendirme gerekçesi | Alfanümerik (≤300 karakter) |
| B_06.01.0080 | Son değerlendirme tarihi | Tarih |
| B_06.01.0090 | Kurtarma zaman hedefi (RTO) | Doğal sayı (saat) |

### ICT hizmet türü kapalı kümesi — Annex III

| Kod | Hizmet türü |
|---|---|
| S01 | ICT proje yönetimi |
| S02 | ICT geliştirme |
| S03 | ICT yardım masası / birinci seviye destek |
| S04 | ICT güvenlik yönetim hizmetleri |
| S05 | Veri sağlama |
| S06 | Veri analizi |
| S07 | ICT, tesis ve barındırma hizmetleri (bulut hariç) |
| S08 | Hesaplama |
| S09 | Bulut-dışı veri depolama |
| S10 | Telekom taşıyıcı |
| S11 | Ağ altyapısı |
| S12 | Donanım ve fiziksel cihazlar |
| S13 | Yazılım lisanslama (SaaS hariç) |
| S14 | ICT operasyon yönetimi (bakım dahil) |
| S15 | ICT danışmanlığı |
| S16 | ICT risk yönetimi |
| S17 | Bulut hizmetleri: IaaS |
| S18 | Bulut hizmetleri: PaaS |
| S19 | Bulut hizmetleri: SaaS |

**NOT (kural 3 dürüstlüğü):** Annex III'ün BİREBİR EUR-Lex metni iki ayrı
WebFetch denemesinde de sayfa kesitine dahil olmadı ("Annex III...not
included in this excerpt" — aracın kendi ifadesi). S01-S19 listesi yalnız
ikincil kaynaktan (springlex.eu) geliyor — **TODO_DOGRULA**, birincil metin
hâlâ SOURCE_PENDING sayılmalı bu liste için.

## 5. Hâlâ SOURCE_PENDING (hiç kaynak metni yok — ne birincil ne ikincil detaylı)

- B_02.03, B_03.01, B_03.02, B_03.03, B_04.01, B_07.01, B_99.01 şablonlarının
  TAM alan listeleri (yalnız şablonun VAR OLDUĞU ve amacı §2'de doğrulandı,
  sütun bazlı detay yok).
- B_01.02.0050 "Hierarchy" kapalı kümesinin 5 seçeneği.
- B_02.02.0090 "Reason of termination" kapalı kümesinin 6 seçeneği.
- Annex II (lisanslı faaliyet dayanakları), Annex IV (parasal değer rehberi)
  tam metinleri.
- EUID'in (Directive (EU) 2017/1132 Madde 16) B_01.01/B_01.02'deki LEI'ye
  ALTERNATİF bir kimlik kodu olarak kabul edilip edilmediği — EUR-Lex'ten
  fetch edilen B_01.01/B_01.02 metninde yalnız LEI isteniyor gibi görünüyor;
  EUID kavramı yalnız B_05.01.0020 (sağlayıcı kimlik kodu türü) bağlamında
  ikincil kaynakta geçti. **Bu tutarsızlık ADR'de açıkça not edildi — EUID
  alanı şemaya eklenir ama "kurum kimliği" bağlamındaki resmi zorunluluğu
  SOURCE_PENDING kalır.**

## 6. Sıradaki adım

Bu belge KAYNAK ÖZETİDİR — şema/mapping kararı
`docs/adr/PR0-37-tez-dikeyB-roi-mapping-2026-07-19.md`'dedir. İlk migration
dilimi (kurum yasal kimlik profili + RoI kaynak durum tablosu, İÇERİK
SEED'İ YOK) bu araştırmayla birlikte teslim edildi — ayrıntı ROADMAP §1.58.
