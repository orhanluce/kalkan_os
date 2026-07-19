# PR-0 — 37 Tez Dikey B Keşfi: DORA RoI Mapping + Gap Raporu (19 Temmuz 2026)

**Kaynak belge:** `docs/arastirma/DORA_RoI_ITS_2024_2956_Kaynak_Ozeti.md`
(Commission Implementing Regulation (EU) 2024/2956). İkinci geçiş (aynı gün,
kurucu talimatıyla): EUR-Lex'in birincil sayfası WebFetch ile doğrudan
okundu, birçok şablon için birebir alıntı toplandı — **LEGAL_REVIEW_REQUIRED**
statüsüne yükseltildi (TODO_DOGRULA'dan daha güçlü, ama hâlâ VERIFIED
DEĞİL — insan hukuk incelemesi şart).

## 0. Durum sözlüğü — YENİDEN KULLANIM (kural: var olan mekanizmayı ikinci kez kurma)

Kurucunun istediği üç durum (TODO_DOGRULA/SOURCE_PENDING/LEGAL_REVIEW_REQUIRED)
repodaki **`obligations.dogrulama_durumu`** dört-göz sözlüğüyle (`20260718160000_
obligations.sql`) neredeyse birebir örtüşüyor: `DRAFT_RESEARCH → TODO_DOGRULA
→ LEGAL_REVIEW → VERIFIED` (+ `SUPERSEDED`/`REJECTED`). Bu ADR ve migration
İKİNCİL bir sözlük İCAT ETMEK yerine AYNEN bu altı durumu ve aynı guard
mantığını (VERIFIED doğamaz; VERIFIED'e geçiş yalnız LEGAL_REVIEW'den +
dogrulayan/zaman atfıyla; VERIFIED içerik donuk) yeniden kullanıyor.
Kurucunun "SOURCE_PENDING" dediği kavram = `DRAFT_RESEARCH` (kaynak metni
henüz yok/eksik); "LEGAL_REVIEW_REQUIRED" = `LEGAL_REVIEW` (inceleme
kuyruğunda). Bu eşleme kaynak özetinde de (§0) açıkça yazılı.

**Bu turda migration YAZILDI** (aşağıda §5) — kurucunun 19 Temmuz ikinci
talimatı, ADR'yi kabul edilmiş sayıp somut ilk dilimi (kurum yasal kimlik
profili + RoI kaynak durum tablosu, İÇERİK SEED'İ YOK) açıkça tarif etti.

## 1. Mevcut model → RoI şablonu eşlemesi

| Repo tablosu/alanı | RoI şablonu.kod | Not |
|---|---|---|
| `third_parties.ad` | B_05.01.0050 (Yasal ad) | Doğrudan eşleşir. |
| `third_parties.ulke` | B_05.01.0080 (Merkez ülkesi) | Doğrudan eşleşir (serbest metin → ülke koduna normalize gerekir). |
| `third_parties.tier` (KRITIK/ONEMLI/DUSUK) | — | RoI'de doğrudan karşılığı YOK; en yakını B_06.01.0060 (fonksiyon kritiklik değerlendirmesi) ama KAVRAMSAL FARKLI: bizimki tedarikçi seviyesinde, RoI'nin kritiklik değerlendirmesi FONKSİYON seviyesinde. **Uydurma yapılmaz — ayrı kavram olarak bırakılır, çeviri yapılmaz.** |
| `third_party_services.hizmet_adi` | — (serbest metin) | RoI'nin S01-S19 kapalı kümesine (Annex III) karşılık gelmiyor — bugün serbest metin. |
| `third_party_services.kritik` | B_06.01.0060 (kısmen) | Fonksiyon-seviyesi kritiklik kavramına en yakın ama tedarikçi hizmeti seviyesinde tutuluyor — birebir değil. |
| `third_party_services.veri_siniflari` | B_02.02.0170 (veri hassasiyet seviyesi) | KAVRAMSAL FARKLI: bizimki KVKK veri sınıfı listesi (serbest), RoI'nin beklediği kapalı küme (Düşük/Orta/Yüksek). |
| `fourth_parties.ad` | B_05.02 (tedarik zinciri, `rank>=2`) | Doğrudan eşleşir — ama `third_parties`↔`fourth_parties` arasında RoI'nin istediği "sağlayıcı kimlik kodu" (LEI/EUID) YOK, yalnız serbest ad. |
| `fourth_parties.bilinmiyor` | — | RoI'de "bilinmeyen alt yüklenici" için AÇIK bir alan YOK (TODO_DOGRULA — belki B_05.02 satırı hiç açılmaz demektir, teyit gerekir). Bizim kural 9 (M09) invariant'ımız RoI'den daha SIKI — bu iyi bir şey, gevşetilmez. |
| `third_party_contracts.sozlesme_ref` | B_02.01.0010 / B_02.02.0010 (Düzenleme referansı) | Doğrudan eşleşir. |
| `third_party_contracts.baslangic`/`bitis` | B_02.02.0070/0080 | Doğrudan eşleşir. |
| `third_party_contracts.denetim_hakki` | — | RoI'nin standart alanlarında karşılığı görünmüyor (TODO_DOGRULA) — muhtemelen anlatı/madde seviyesinde, template'te yok. |
| `third_party_contracts.durum` | — | RoI kavramı YOK; bizim iç yaşam döngümüz. |
| `exit_plans.*` | — | RoI'nin standart şablonlarında (B_01-B_07) doğrudan karşılığı YOK — çıkış planı DORA'nın madde 28 gereksiniminin BİR PARÇASI ama RoI'nin RAPORLANAN veri modeli değil (TODO_DOGRULA). |

## 2. Eksik alanlar (repo modelinde YOK, RoI zorunlu kılıyor)

**Kurum kimliği (B_01.01) — EN BÜYÜK BOŞLUK:** `tenants` tablosunda LEI,
EUID, yasal ad (Latin alfabe), merkez ülkesi YOK. RoI'nin "kaydı tutan
kuruluş" kimliği hiç modellenmemiş. Bu alan olmadan hiçbir export
üretilemez — Dikey B'nin migration'ı BUNU İLK önce açmalı.

**Sağlayıcı kimlik kodu (LEI/EUID) — third_parties/fourth_parties:** ikisi
de yalnız serbest `ad` taşıyor, resmi tanımlayıcı kod alanı yok.

**Fonksiyon kavramı (B_06.01) — hiç yok:** RoI'nin "fonksiyon" (F1, F2, ...)
birimi bizim modelde karşılığı olmayan YENİ bir kavram — bugünkü
`third_party_services` ona en yakın ama 1:1 değil (bir fonksiyon birden çok
hizmetten beslenebilir, RoI modelinde ayrı varlık).

**ICT hizmet türü (S01-S19) kapalı kümesi:** `third_party_services.hizmet_adi`
serbest metin; RoI'nin kapalı kümesine eşlemek İNSAN KARARI ister (kural 3 —
otomatik/AI eşleme yapılmaz, tenant kullanıcısı kendi hizmetini S01-S19'dan
birine bilinçli atar).

**Veri lokasyonu (saklama/işleme ülkesi) alanları:** hiç yok.

**Bağımlılık seviyesi (reliance level), fesih bildirim süreleri, uygulanacak
hukuk:** hiçbiri modellenmemiş.

## 3. Sonraki dikey — BU TURDA teslim edilen ilk dilim + ertelenen kalan

**1. BU TURDA TESLİM (§5, migration `20260719310000`):** `tenant_legal_
identity` (tenant-scoped, tek satır/tenant: LEI/EUID/ülke/para birimi/
hiyerarşi/ana kuruluş LEI — hepsi NULLABLE, format-seviyesi CHECK'ler
DIŞINDA hiçbir alan zorlanmaz) + `roi_kaynak_kayitlari` (GLOBAL referans,
`obligations` deseninin AYNISI — şablon/alan bazlı kaynak+doğrulama durumu
takibi). **İÇERİK SEED'İ YOK** — migration hiçbir RoI alan/kod satırı
INSERT etmiyor, yalnız tabloyu açıyor.

**2. ERTELENEN (Dikey B'nin sonraki dilimleri):**
- `third_party_services`/`fourth_parties`'a S01-S19 kodu + sağlayıcı
  kimlik kodu (LEI/EUID/diğer) alanları (nullable kolon genişletmesi).
- Export mekanizması — YENİ bir mühürleme deseni İCAT EDİLMEZ: mevcut
  `citation-bundle.ts`/`audit-worm-export.ts` deseninin AYNISI (RFC 8785
  kanonik hash, service_role mühürler, bağımsız CLI doğrular). Snapshot +
  delta (önceki export'a göre fark) + "eksik/çelişkili alan raporu" (saf
  fonksiyon, hangi zorunlu RoI alanının hangi tenant kaydında boş olduğunu
  listeler — kural 11).
- Dört-göz yayın/onay: mevcut obligations/independence-declaration
  desenlerinin AYNISI (roi_kaynak_kayitlari zaten bu guard'ı taşıyor —
  export'un KENDİSİNİN onayı ayrı bir adım).
- Resmi şema değişince impact queue: mevcut `IMPACT_REVIEW_REQUIRED` deseni
  (uygulanabilirlik kararları için zaten var, Dikey F'de de kullanılacak) —
  YENİ bir kuyruk mekanizması icat edilmeden aynı deseni RoI şema
  sürümüne bağlamak.

## 4. Açık kurucu/hukuk kararı

- Bu ADR'deki alan listesi **VERIFIED değildir** — bir hukuk/uyum
  doğrulayıcısının EUR-Lex birebir metniyle karşılaştırıp onaylaması
  gerekir (kural 3). Migration bu onaydan ÖNCE yazılmaz.
- `third_parties.tier` ile RoI'nin fonksiyon-seviyesi kritiklik kavramının
  birleştirilip birleştirilmeyeceği (yoksa iki ayrı kavram olarak mı
  kalacağı) kurucu kararı bekliyor.
- LEI/EUID doğrulama (format ötesi, gerçek kayıt sorgusu — GLEIF API vb.)
  bu ADR kapsamı DIŞINDA; format-seviyesi kontrol (20 karakter, ISO 17442)
  yeterli görülüyor, gerçek kayıt doğrulaması AÇIK KARAR.
