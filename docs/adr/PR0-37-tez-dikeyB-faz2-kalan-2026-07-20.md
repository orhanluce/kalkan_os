# PR-0 — 37 Tez Dikey B, Faz 2 kalan dilimi: kurum kimliği + tedarikçi/sözleşme RoI alanları + kritik-fonksiyon eşlemesi (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz üçüncü talimatı. Kapsam: (1) `tenant_legal_
identity` genişlemesi, (2) `third_parties`/`third_party_contracts`
genişlemesi, (3) `fourth_parties` genişlemesi (yeni paralel model kurmadan),
(4) `third_parties.tier` ile DORA fonksiyon-kritikliği ASLA birleştirilmez —
ayrı alanlar + açık mapping tablosu.

## 0. Önce mevcut yapı (talimat kural 7 — eski kopya deseni kullanma)

`docs/DEVAM.md`, `docs/ROADMAP.md` §1.60 ve şu dört migration okundu:
`20260719000000_third_party_risk.sql` (third_parties/third_party_services/
fourth_parties/third_party_contracts/exit_plans — TAMAMI zaten var),
`20260719040000_critical_service.sql` (critical_business_services/
impact_tolerances/service_dependencies — DORA'nın "kritik/önemli fonksiyon"
kavramına karşılık gelen mevcut tablo BU), `20260719310000_...` (tenant_
legal_identity — Faz 1'de kurulan kurum kimliği), `20260720100000_...`
(ict_service_types — Faz 2 ilk dilimde kurulan S01-S19 kataloğu) ve
`20260720110000_dort_goz_insert_bypass_duzelt.sql` (GÜNCEL, düzeltilmiş
dört-göz deseni — bir sonraki dört-göz tablosu yazılırsa bu BİREBİR
kopyalanacak, ESKİ 20260718160000/20260718210000-öncesi biçim DEĞİL).

**Sonuç: bu dilimde YENİ bir tablo AİLESİ kurulmuyor.** third_parties/
third_party_contracts/fourth_parties/critical_business_services hepsi
GENİŞLETİLİYOR (ALTER TABLE); yalnız BİR yeni tablo açılıyor — açıkça
istenen "mapping tablosu" (aşağıda §3).

## 1. `tenant_legal_identity` genişlemesi

Faz 1 zaten LEI/EUID/ülke/para birimi/kuruluş türü/hiyerarşi seviyesini
(≈konsolidasyon seviyesi, B_01.02.0050) taşıyor. Eksik iki kavram:

| Yeni kolon | DORA karşılığı | Not |
|---|---|---|
| `ticaret_sicil_no` | "ulusal kurum kimliği" (EUID'nin AB-dışı muadili) | Serbest metin, SOURCE_PENDING — EUID Directive (EU) 2017/1132 madde 16'ya bağlı, TR ticaret sicili AB kurumu değil; format uydurulmuyor. |
| `kayit_tutan_kurulus_lei` + `kayit_tutan_kurulus_adi` | B_01.01 "Entity maintaining the register" | NULL = tenant kendi kaydını kendi tutuyor (yaygın durum — bağımsız kuruluş). Dolu ise: bu tenant'ın kaydı BAŞKA bir kuruluş (örn. grup ana ortaklığı) tarafından konsolide tutuluyor. LEI format kontrolü VAR (uluslararası standart), İÇERİK doğrulaması YOK. |

`hiyerarsi_seviyesi` (konsolidasyon seviyesi) zaten var — yeni kolon
AÇILMADI, yorum güncellendi.

## 2. `third_party_contracts` genişlemesi (B_02.01/B_02.02'nin çekirdek alt kümesi)

Kurucunun istediği "ICT hizmet sağlayıcısı bilgileri / hizmet türü kodu /
veri lokasyonu / sözleşme sona erme" — hepsi RoI şablonlarında SÖZLEŞME
(contractual arrangement) düzeyinde, `third_party_contracts` zaten sözleşme
kaydı — genişletilen tablo bu, yeni paralel tablo YOK:

| Yeni kolon | DORA karşılığı |
|---|---|
| `tedarikci_kimlik_kodu` | B_02.02.0030 "Identification code of the ICT third-party service provider" |
| `tedarikci_kimlik_kodu_turu` | B_02.02.0040 "Type of code" (serbest — kapalı küme SOURCE_PENDING) |
| `ict_hizmet_turu_kod` (FK → `ict_service_types.kod`) | B_02.02.0060 "Type of ICT services" — Faz 2 ilk dilimin kataloğuna GERÇEK bağ |
| `veri_saklaniyor_mu` | B_02.02.0140 "Storage of data" |
| `veri_saklama_ulkesi` (ISO 3166-1 format check) | B_02.02.0150 |
| `veri_isleme_ulkesi` (ISO 3166-1 format check) | B_02.02.0160 |
| `sona_erme_nedeni` | B_02.02.0090 (6 seçenek BİREBİR bilinir — Faz 1'de kaydedildi — ama CHECK constraint YAPILMADI: kural 3, "type of financial entity" 22-madde listesiyle AYNI ilke) |
| `bildirim_suresi_kurum_gun` / `bildirim_suresi_saglayici_gun` | B_02.02.0100/0110 "Notice period" |

**Kapsam dışı bırakılan RoI alanları (bilinçli, sonraki dilim):**
B_02.01.0020 sözleşme türü, para birimi/yıllık gider (B_02.01.0040/0050),
governing-law/provision-country (B_02.02.0120/0130), veri hassasiyeti/
güvenme seviyesi (B_02.02.0170/0180) — kurucunun bu turki listesinde
YOKTU, eklemek kapsam genişletmesi olurdu.

## 3. `fourth_parties` genişlemesi (B_05.02 tedarik zinciri)

| Yeni kolon | DORA karşılığı |
|---|---|
| `third_party_contract_id` (FK → `third_party_contracts`, nullable) | Alt yüklenicinin HANGİ sözleşmeye bağlı olduğu (B_05.02.0010 düzenleme referansı) |
| `sira` (rank, `>= 2` veya NULL) | B_05.02.0050 — doğrudan sağlayıcı=1 (third_party'nin kendisi, örtük), alt yüklenici=2+ |
| `ict_hizmet_turu_kod` (FK → `ict_service_types.kod`) | B_05.02.0020 — alt yüklenicinin sağladığı hizmet türü |

Yeni paralel tablo AÇILMADI (talimat kural 3) — mevcut `fourth_parties`
genişletildi.

## 4. Açık mapping tablosu — `third_party_contract_critical_services`

**KURAL (talimat madde 4, kesin):** `third_parties.tier` (iş riski tiering'i
— KRİTİK/ÖNEMLİ/DÜŞÜK, M35'in kendi iç skoru) DORA'nın "kritik/önemli
fonksiyon" kavramıyla (B_06.01, kurumun KENDİ iş fonksiyonunun RTO/RPO'lu
kritiklik değerlendirmesi — `critical_business_services`, M13) OTOMATİK
BİRLEŞTİRİLMEZ. Bunlar FARKLI SORULAR: tier "bu tedarikçi ne kadar riskli"
sorusuna, kritik fonksiyon eşlemesi "bu sözleşme HANGİ iş fonksiyonuna
hizmet ediyor" sorusuna cevap verir — bir tedarikçi DÜŞÜK tier'lı olabilir
ama KRİTİK bir fonksiyona hizmet edebilir (ya da tersi), sessiz bir eşitleme
YANLIŞ POZİTİF/NEGATİF üretir.

Yeni, dar tablo (mevcut `service_dependencies`'in genel dayanıklılık-
grafiği semantiğiyle KARIŞTIRILMADI — o Dikey 5'in impact-graph motorunun
girdisi, burada RoI'ye özgü sözleşme↔fonksiyon bağı ayrı tutuluyor):

```sql
third_party_contract_critical_services (
  id, tenant_id,
  third_party_contract_id → third_party_contracts,
  critical_service_id → critical_business_services,
  created_at,
  unique (third_party_contract_id, critical_service_id)
)
```

Tenant-scoped RLS, admin/uyum yazar. `third_parties.tier` bu tabloda HİÇ
REFERANS EDİLMİYOR — iki kavram şemada da ayrı kalıyor.

## 5. Dört-göz — bu dilimde YENİ bir guard YOK (dürüst gerekçe)

Talimat madde 5/6 dört-göz disiplinini hatırlatıyor ve INSERT-bypass'ının
tekrarlanmamasını istiyor. Bu dilimde eklenen HİÇBİR alan/tablo yeni bir
"regülasyon iddiası" taşımıyor:

- `tenant_legal_identity`/`third_party_contracts`/`fourth_parties` yeni
  kolonları TENANT'IN KENDİ OPERASYONEL GERÇEĞİ (kendi ticaret sicil no'su,
  kendi tedarikçisinin ülkesi, kendi sözleşmesinin bitiş bildirim süresi) —
  "kanun ne diyor" iddiası DEĞİL, LEI/ülke/tier gibi mevcut alanlarla AYNI
  kategori (yalnız kimlik atfı + RLS, dört-göz YOK, tıpkı `third_parties.
  ulke`'nin hiç dört-göz taşımaması gibi).
- `ict_hizmet_turu_kod` YENİ regülasyon içeriği YARATMIYOR — Faz 2 ilk
  dilimde kurulan, ZATEN dört-göz korumalı `ict_service_types` kataloğuna
  FK ile bağlanıyor (var olan mekanizma yeniden kullanılıyor, kural 1).
- Yeni mapping tablosu (`third_party_contract_critical_services`) da
  tenant'ın kendi eşleme kararı — dört-göz gerektirmiyor.

**Sonuç: bu dilimde kopyalanacak yeni bir guard fonksiyonu YOK — dolayısıyla
INSERT-bypass sınıfı bir hatanın tekrarlanma riski bu dilimde YAPISAL OLARAK
YOK.** Bir sonraki dilimde regülasyon-içerikli yeni bir tablo açılırsa,
`20260720110000`'daki GÜNCEL (düzeltilmiş) guard deseni BİREBİR kopyalanacak.

## 6. Kapsam dışı (bu dilimde YAPILMAYACAK, talimatın kendi listesi)

DORA export motoru, S17-S19'u VERIFIED yapmak, RoI alanlarını hukuk onayı
olmadan seed etmek, `third_parties.tier` ile fonksiyonel kritikliği sessizce
eşitlemek (§4'te açıkça ENGELLENDİ).
