# DORA Register of Information — ITS 2024/2956 Kaynak Özeti

**Amaç:** 37 Tez talimatı Dikey B ("resmî DORA Register of Information (RoI)
uyumu") §4'ün açık şartı: "Önce güncel ve resmî AB kaynaklarını repo
araştırma alanına al; bağlayıcı şema/sürüm/doğrulama durumunu kaydet. Tez
veya blogdan RoI alanı uydurma." Bu belge o adımı karşılar.

**DOĞRULUK DURUMU (dürüstçe, kural 3 disiplini):** Bu belgedeki alan/kod
listeleri WebSearch + WebFetch ile İKİNCİL kaynaklardan (springlex.eu,
intellectumlab.com, EBA'nın kendi özet sayfası, ESMA final report PDF'i)
19 Temmuz 2026'da derlendi — **EUR-Lex'teki birebir resmî metinle (Annex I-IV
tam tablo + tüm sütun listesi) satır satır KARŞILAŞTIRILMADI**. Bu nedenle
aşağıdaki her madde **TODO_DOGRULA** statüsündedir: bir hukuk/uyum
doğrulayıcısının EUR-Lex'teki (`https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng`)
birebir Annex metniyle karşılaştırıp VERIFIED'e çevirmesi gerekir. Kod bu
listeyi VERIFIED olarak seed ETMEYECEK (mevcut obligations/cloud-pack dört-göz
deseni aynen uygulanacak — bkz. mapping ADR'si).

## 1. Bağlayıcı kaynak (kimlik)

- **Regülasyon:** Commission Implementing Regulation (EU) 2024/2956 of 29
  November 2024, laying down implementing technical standards (ITS) for the
  application of Regulation (EU) 2022/2554 (DORA) with regard to standard
  templates for the register of information on ICT third-party arrangements.
- **Resmi Gazete'de yayın:** 2 Aralık 2024.
- **Yürürlük/uygulama tarihi:** 17 Ocak 2025.
- **EUR-Lex kalıcı bağlantı:** `https://eur-lex.europa.eu/eli/reg_impl/2024/2956/oj/eng`
- **Dayanak madde (ana regülasyon):** DORA Madde 28(3) — finansal kuruluşların
  ICT üçüncü taraf sözleşme düzenlemeleri kaydını tutma yükümlülüğü.
- İkincil kaynaklar (çapraz doğrulama için, birebir metin DEĞİL):
  - EBA özet sayfası: `https://www.eba.europa.eu/activities/single-rulebook/regulatory-activities/operational-resilience/implementing-technical-standards-establish-templates-register-information`
  - ESMA/JC final report (JC 2023 85): `https://www.esma.europa.eu/sites/default/files/2024-01/JC_2023_85_-_Final_report_on_draft_ITS_on_Register_of_Information.pdf`
  - Springlex Annex III özeti: `https://www.springlex.eu/en/packages/dora/its-roi-regulation/annex-3/`

## 2. Şablon envanteri (TODO_DOGRULA — ikincil kaynaktan derlendi)

| Şablon | Amaç |
|---|---|
| B_01.01 | Kaydı tutan kuruluşun kimliği |
| B_01.02 | Konsolidasyon kapsamındaki tüm kuruluşlar |
| B_01.03 | Ana ülke dışındaki şubeler |
| B_02.01 | Genel sözleşme düzenlemesi bilgisi |
| B_02.02 | Düzenleme + ICT hizmeti özel detayları |
| B_02.03 | Grup-içi ↔ dış düzenleme bağlantısı |
| B_03.01 | ICT hizmeti alan taraf kuruluşlar (imzalayan) |
| B_03.02 | ICT sağlayıcı taraf (imzalayan) |
| B_03.03 | Grup-içi ICT hizmeti sağlayan kuruluşlar |
| B_04.01 | ICT hizmetini fiilen kullanan kuruluşlar |
| B_05.01 | ICT üçüncü taraf sağlayıcı kimliği |
| B_05.02 | ICT tedarik zinciri (alt yüklenici haritası) |
| B_06.01 | Fonksiyon kimliği + kritiklik değerlendirmesi |
| B_07.01 | Kritik/önemli fonksiyon risk değerlendirmesi |
| B_99.01 | Kuruluş-içi tanım/terminoloji (kapalı küme açıklamaları) |

## 3. Anahtar alanlar (TODO_DOGRULA — en yüksek güvenle derlenen çekirdek alt küme)

### B_02.02 — Sözleşme düzenlemesi (özel)

| Kod | Alan | Tip | Zorunluluk |
|---|---|---|---|
| B_02.02.0010 | Düzenleme referansı | Alfanümerik | Zorunlu |
| B_02.02.0020 | Hizmeti kullanan kuruluşun LEI'si | Alfanümerik | Zorunlu |
| B_02.02.0030 | Sağlayıcı kimlik kodu | Alfanümerik | Zorunlu |
| B_02.02.0050 | Fonksiyon kimliği | Desen (F+sayı) | Zorunlu |
| B_02.02.0060 | ICT hizmet türü | Kapalı küme (S01-S19, bkz. §4) | Zorunlu |
| B_02.02.0070 | Başlangıç tarihi | Tarih (ISO 8601) | Zorunlu |
| B_02.02.0080 | Bitiş tarihi | Tarih (ISO 8601) | Zorunlu |
| B_02.02.0100 | Fesih bildirim süresi (kuruluş) | Doğal sayı | Kritik/önemliyse zorunlu |
| B_02.02.0110 | Fesih bildirim süresi (sağlayıcı) | Doğal sayı | Kritik/önemliyse zorunlu |
| B_02.02.0120 | Uygulanacak hukuk ülkesi | Ülke kodu | Kritik/önemliyse zorunlu |
| B_02.02.0130 | Hizmet sunum ülkesi | Ülke kodu | Kritik/önemliyse zorunlu |
| B_02.02.0140 | Veri saklama var mı | Evet/Hayır | Kritik/önemliyse zorunlu |
| B_02.02.0150 | Veri saklama lokasyonu | Ülke kodu | Saklama varsa zorunlu |
| B_02.02.0160 | Veri işleme lokasyonu | Ülke kodu | İşleme hizmetinde zorunlu |
| B_02.02.0170 | Veri hassasiyet seviyesi | Kapalı küme: Düşük/Orta/Yüksek | Kritik/önemliyse zorunlu |
| B_02.02.0180 | Bağımlılık seviyesi | Kapalı küme: Önemsiz/Düşük/Maddi/Tam | Kritik/önemliyse zorunlu |

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
| B_05.02.0050 | Sıra (rank) | Doğal sayı — doğrudan sağlayıcı=1, alt yüklenici=2+ |
| B_05.02.0060 | Alt yüklenici alıcı kimliği | Alfanümerik |

### B_06.01 — Fonksiyon kimliği + kritiklik

| Kod | Alan | Tip | Zorunluluk |
|---|---|---|---|
| B_06.01.0010 | Fonksiyon kimliği | Desen (F+sayı) | Zorunlu |
| B_06.01.0030 | Fonksiyon adı | Alfanümerik | Zorunlu |
| B_06.01.0060 | Kritiklik değerlendirmesi | Kapalı küme: Evet/Hayır/Değerlendirilmedi | Zorunlu |
| B_06.01.0070 | Değerlendirme gerekçesi | Alfanümerik (≤300 karakter) | Opsiyonel |
| B_06.01.0080 | Son değerlendirme tarihi | Tarih | Zorunlu |
| B_06.01.0090 | Kurtarma zaman hedefi (RTO) | Doğal sayı (saat) | Koşullu |

## 4. ICT hizmet türü kapalı kümesi — Annex III (TODO_DOGRULA)

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

## 5. Veri kalitesi ilkeleri (TODO_DOGRULA, Madde 3 referansı)

Doğruluk, bütünlük, tutarlılık, bütünsellik, tekdüzelik, geçerlilik.

## 6. Sıradaki adım

Bu belge yalnız KAYNAK ÖZETİDİR — şema/mapping kararı
`docs/adr/PR0-37-tez-dikeyB-roi-mapping-2026-07-19.md`'dedir. Kod bu turda
YAZILMADI (talimat §4 Dikey B: "Bir alan mevcut modelde yoksa önce mapping/
ADR; migration'ı gerekçesiz büyütme").
