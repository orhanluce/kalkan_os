# WARDPROOF finansal güvenlik mevzuat paketi

**Kesim tarihi:** 22 Temmuz 2026  
**Kapsam:** BDDK, SPK, KVKK, 7545 sayılı Siber Güvenlik Kanunu ve ek olarak kripto/MASAK ile koşullu AB düzenlemeleri  
**Hukuki durum:** Araştırma ve ürünleştirme girdisidir; hukukçu onayı olmadan kullanıcıya `VERIFIED` olarak yayımlanmamalıdır.

## Teslim içeriği

- `sources/`: 36 resmî veya açıkça “bağlayıcı olmayan referans” olarak ayrılmış kaynak dosya.
- `source_inventory.csv`: resmî URL, belge türü, sürüm/yürürlük tarihi, uygulanabilirlik ve yerel dosya eşlemesi.
- `control_chain.csv`: **resmî kaynak → madde → yükümlülük → uygulanabilirlik → kontrol → kanıt → test** zincirini dolduran 49 araştırma kaydı.
- `screenshot_validation.md`: kullanıcının görselindeki beş iddianın doğrulama sonucu.
- `SHA256SUMS.csv`: indirilen dosyaların boyut ve SHA-256 bütünlük değerleri.

## Projede kullanım

`source_inventory.csv`, WARDPROOF kaynak sicilinin kanonik dosyasıdır. Proje bu
dosyayı ve `SHA256SUMS.csv` bütünlük manifestini `pnpm seed:regulatory-sources`
komutuyla okur; `regulatory_sources`, `source_artifacts` ve ilk manuel çekim
kaydını idempotent olarak üretir. Ön kontrol için:

```text
pnpm seed:regulatory-sources -- --dry-run
```

Seed hiçbir kaydı `VERIFIED` yapmaz. Bağlayıcı olmayan referanslar
`DRAFT_RESEARCH`, diğer kaynak nüshaları `TODO_DOGRULA` doğar; hukuk incelemesi
ayrı yetki ve onay akışıdır.

## En önemli doğrulamalar

1. **SPK’da güncel ana metin VII-128.10’dur.** 13 Mart 2025 tarihli ve 32840 sayılı Resmî Gazete’de yayımlanmış, 30 Haziran 2025’te yürürlüğe girmiştir. VII-128.9 yürürlükten kaldırılmıştır. Kripto varlık hizmet sağlayıcılar dışındaki kapsamdaki kuruluşların ana geçiş süresi 31 Aralık 2025’te dolmuştur; VII-128.10 madde 29/3 için süre 31 Aralık 2026’dır.
2. **Finans, 5 Mayıs 2026’da Kritik Altyapı Sektörü olarak belirlenmiştir.** Bunun resmî dayanağı İletişim Başkanlığı açıklamasıdır. Bu karar uygulanabilirlik sinyalidir; kendi başına ayrıntılı teknik kontrol kataloğu değildir. Teknik yükümlülük 7545’in maddeleri ve yayımlanacak/uygulanacak ikincil düzenleyici işlemler üzerinden kurulmalıdır.
3. **BDDK 2025–2028 Stratejik Planı bağlayıcı mevzuat değildir.** Ürün yol haritasına/risk sinyaline girebilir; doğrudan “kanuni yükümlülük” oluşturamaz.
4. **CRA için 11 Eylül 2026 tarihi sınırlı bir tarihtir.** 2024/2847 sayılı Tüzüğün 14. maddesindeki raporlama yükümlülükleri bu tarihte uygulanır; Tüzüğün genel uygulama tarihi 11 Aralık 2027’dir. Türkiye’deki her finans kuruluşuna kendiliğinden uygulanmaz.
5. **SPL 1020 ve 1023 PDF’leri eğitim notudur.** Atıf keşfi için kullanılmış, fakat hiçbir yükümlülük yalnız bu notlara dayanılarak oluşturulmamıştır.

## Ürünleştirme kuralı

WARDPROOF kullanıcı ekranında her hüküm için en az şu alanlar birlikte gösterilmelidir:

- resmî kurum ve resmî kaynak bağlantısı,
- düzenleme adı ve madde/fıkra,
- Resmî Gazete tarihi/sayısı veya belge sürümü,
- yürürlük ve varsa geçiş tarihi,
- belge ağırlığı: `KANUN`, `YONETMELIK`, `TEBLIG`, `KURUL_KARARI`, `RESMI_REHBER`, `STRATEJI`, `EGITIM_NOTU`,
- uygulanabilirlik kararı ve bu kararı doğuran kurum olguları,
- kontrol, kanıt ve test bağlantıları,
- doğrulama durumu ile hukukçu/onaylayan kimliği ve tarihi.

Önerilen durum akışı: `INTERNAL_RESEARCH → LEGAL_REVIEW → VERIFIED`. Resmî rehber, stratejik plan veya eğitim notu tek başına `VERIFIED` yükümlülük doğurmamalıdır.

## Uygulanabilirlik için gerekli kurum olguları

Bu paket “her kuruma her kural uygulanır” varsayımı yapmaz. Karar için en az aşağıdaki olgular gerekir:

- lisans ve kuruluş tipi: banka, aracı kurum, portföy yönetim şirketi, halka açık ortaklık, kripto varlık hizmet sağlayıcı, ödeme/e-para kuruluşu vb.,
- sunulan hizmet ve elektronik kanal türleri,
- kişisel/özel nitelikli veri işleme ve yurt dışı aktarım akışları,
- birincil/ikincil sistem ve dış hizmet/bulut konumları,
- kritik altyapı veya Kurumsal SOME kapsamı,
- AB pazarına ürün/hizmet sunumu ve AB’deki düzenlenen finansal kuruluş statüsü.

Eksik olgu halinde sonuç `UNKNOWN` olmalıdır; `NOT_APPLICABLE` değildir.

## Bilinen sınırlar

- Madde özetleri hukuk metninin yerine geçmez; resmî PDF/HTML birincil kaynaktır.
- 7545 kapsamında ayrıntılı sektörel ikincil düzenlemeler yayımlandıkça paket yeniden taranmalıdır.
- BDDK, SPK, KVKK ve MASAK sayfaları değişebilir; kaynak dosyaları bu nedenle erişim tarihi ve SHA-256 ile mühürlenmiştir.
- `control_chain.csv` araştırma seviyesindedir. Canlı ürün verisine alınmadan önce bağımsız hukukçu veya kurum içi mevzuat uzmanı tarafından madde/fıkra bazında onaylanmalıdır.
