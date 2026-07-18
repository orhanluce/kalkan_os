# CLAUDE CODE ANA TALİMATI
## KALKAN_OS — Regülasyon Zekâsı, Kanıt Zinciri ve Yeni Kurumsal Arayüz

**Sürüm:** 1.0  
**Tarih:** 18 Temmuz 2026  
**Hedef ortam:** Mevcut KALKAN_OS repository + Hostinger + Supabase  
**Dil:** Kod ve teknik isimlendirme İngilizce olabilir; ürün arayüzü varsayılan olarak Türkçe, i18n’e hazır olmalıdır.

---

## 0. Claude Code’a doğrudan verilecek görev

Bu dokümanı bir fikir listesi olarak değil, KALKAN_OS repository’sinde uygulanacak bağlayıcı geliştirme talimatı olarak ele al.

KALKAN_OS’u iki paralel fakat kontrollü eksende geliştir:

1. Türkiye ve AB resmî hukuk kaynaklarını sürümlü veri olarak alan; hüküm, yükümlülük, kontrol, test ve kanıt arasında denetlenebilir ilişki kuran regülasyon zekâsı.
2. Mevcut düz beyaz arayüzü; modern, kurumsal, sanatsal, responsive, erişilebilir, dark/light modlu bir finansal siber güvenlik çalışma alanına dönüştüren tasarım sistemi.

Bu iki ekseni mevcut çalışan özellikleri, tenant izolasyonunu, RLS politikalarını, testleri ve daha önce alınmış mimari kararları bozmadan uygula.

### Temel çalışma kuralı

Önce repository’yi incele. Bu belgede örneklenen teknoloji veya dosya yolu repository ile uyuşmuyorsa mevcut stack’i esas al; farkı ADR veya uygulama notunda açıkça kaydet. Mevcut davranışı anlamadan framework değiştirme, klasörleri topluca yeniden düzenleme veya çalışan sayfaları sıfırdan yazma.

### Tamamlandı deme koşulu

Bir işi ancak aşağıdakiler varsa tamamlandı say:

- migration ve RLS testleri,
- birim/integration testleri,
- gerçek Chromium e2e,
- light ve dark görsel doğrulama,
- mobil ve masaüstü doğrulama,
- production build,
- Hostinger/Supabase dağıtım kontrolü,
- güncel ROADMAP/ADR,
- sıfır beklenmeyen skip.

Başarı sayılarıyla birlikte başarısız, skip ve flaky testleri ayrı ayrı raporla. “Çoğu geçti” üretim kapısı değildir.

---

## 1. Mevcut proje durumu ve korunacak kararlar

### 1.1 Bilinen durum

- M12 kontrol testleri çalışıyor: tanım oluşturma, gözlem seçme, çalıştırma, sonuç, öneri kabul/reddet ve findings üretimi.
- M16 SoD ilk dikey dilimi çalışıyor.
- SoD istisna süre dolumu Supabase/Postgres `pg_cron` üzerinden idempotent biçimde çalışıyor.
- Kanıt süresi dolumu otomasyonu mevcut.
- Son bildirilen taban: 581 birim + 17 e2e, sıfır skip. İlk iş gerçek repository’de bu sayıları yeniden doğrulamaktır; körü körüne doğru kabul etme.
- M16 CSV atama importu üretim kapısındaki sıradaki iştir.
- M17 denetim örnekleme ve M18 eğitim/yetkinlik tasarım aşamasındadır; M16 üretim kapısı geçmeden bunları kodlama.
- M19–M33 regülasyon modülleri aşağıdaki kapsamla eklenecektir.

### 1.2 Değişmez mimari kararlar

- PostgreSQL ve Supabase birincil veri/doğruluk katmanıdır.
- Her tenant verisinde `tenant_id` ve etkin RLS bulunur.
- Uygulama kontrolü DB invariant’ının yerine geçmez.
- Silme yerine, hukuk ve denetim izini koruyan sona erdirme/sürümleme tercih edilir.
- Zamanlanmış DB işleri için mevcut karar `pg_cron`dur; yeni bir kuyruk altyapısı ancak ölçülmüş ihtiyaç ve ADR ile eklenebilir.
- SPK çalışma notundan türetilen içerik doğrudan doğrulanmış hukuk olamaz.
- `TODO_DOGRULA`/araştırma statüsü korunur; yapay zekâ doğrulama yetkisine sahip değildir.
- Aynı girdi aynı fingerprint’i üretmelidir; dedup ve sıra bağımsızlık korunur.
- Mevcut M12 test motoru yeniden kullanılır; paralel ikinci test motoru kurulmaz.
- Mevcut dört hash kararını değiştirme; regülasyon zinciri için yeni hash’leri ayrı alan olarak ekle.

---

## 2. Ürün tanımı ve hukuki sınır

KALKAN_OS bir “mevzuata tam uyum garantisi” ürünü olarak sunulmayacaktır. Ürün tanımı:

> Türkiye ve AB resmî hukuk kaynaklarını sürümlü izleyen; kurumun uygulanabilirlik kapsamını açıklanabilir şekilde belirleyen; hukuk hükmünü yükümlülük, kontrol, test ve kanıta bağlayan; her değerlendirmede karar anındaki hukuk sürümünü mühürleyen sürekli uyum güvence sistemi.

Her sonuç şu zincirle açıklanmalıdır:

`Official Source → Source Artifact → Provision → Obligation → Applicability Decision → Control → Test Run → Evidence → Legal Snapshot`

Arayüzde “%100 yasal uyum”, “garantili uyum” veya eş anlamlı kesin ifadeler kullanma. Kullan:

- “Doğrulanmış kontroller kapsamında uyum görünümü”
- “Kanıt yeterliliği”
- “İnceleme gerekli”
- “Kapsam belirsiz”
- “Hukuk onayı bekliyor”
- “Son doğrulanmış kaynak tarihi”

---

## 3. İlk çalışma: repository keşfi ve değişiklik bütçesi

Kod yazmadan önce:

1. `AGENTS.md`, `CLAUDE.md`, `README`, `ROADMAP`, ADR’ler ve package manifestlerini oku.
2. `git status`, mevcut branch, son migration ve mevcut kullanıcı değişikliklerini belirle.
3. Framework, router, CSS sistemi, component library, test runner, ORM/SQL yaklaşımı, Supabase client yapısı ve deploy komutlarını çıkar.
4. Mevcut sayfa ve route envanterini hazırla.
5. M12 ve M16 akışlarının e2e testlerini çalıştır.
6. Hostinger plan/tipi repository veya deploy config’den doğrulanamıyorsa bunu `OPEN-DECISION` olarak kaydet:
   - Hostinger managed Node.js app,
   - Hostinger VPS + Docker,
   - statik frontend hosting.
7. Supabase proje bağlantı biçimini, migration akışını, Storage bucket’larını, RLS ve cron işlerini belirle. Secret değerlerini çıktıya yazma.
8. Mevcut UI’dan ekran görüntüleri al; bunları yalnız görsel regresyon başlangıç noktası olarak kullan.

### Yasaklar

- Kullanıcının değişikliklerini silme veya resetleme.
- Toplu “clean-up” bahanesiyle ilgisiz dosyaları değiştirme.
- Mevcut framework’ü sırf tasarım için değiştirme.
- Service-role key’i browser bundle’a koyma.
- Production verisi üzerinde fixture veya destructive migration çalıştırma.
- Kaynaksız mevzuatı `VERIFIED` seed etme.

---

# BÖLÜM A — YENİ ARAYÜZ VE TASARIM SİSTEMİ

## 4. Görsel yön: “Regulatory Observatory”

Arayüz modern ve sanatsal olacak; ancak bir finans kuruluşunun denetim masasında güvenilir görünmelidir.

### 4.1 Karakter

- **Kurumsal:** net hiyerarşi, ölçülü renk, yoğun veri okunabilirliği.
- **Sanatsal:** çok hafif topografik/izohips çizgileri, ağ grafı ve mühür geometrisinden türeyen motifler.
- **Teknik:** hash, kaynak sürümü, zaman, durum ve ilişki görünür.
- **Sakin:** alarm rengi yalnız gerçekten eylem gereken yerde.
- **Özgün:** standart beyaz SaaS dashboard’u, aşırı yuvarlak kartlar veya her yerde gradient kullanılmayacak.

### 4.2 Kaçınılacak görsel klişeler

- neon “hacker” yeşili,
- aşırı glassmorphism,
- her kartta gölge ve gradient,
- anlamsız kalkan/kilit stok illüstrasyonları,
- düşük kontrastlı gri yazılar,
- sırf görsel olsun diye 3D grafikler,
- büyük boşluklarla veri yoğunluğunu düşürmek,
- renk ile tek başına durum anlatmak.

### 4.3 İmza görsel öğesi

Her kontrol veya bulgu detayında soldan sağa ilerleyen ince bir **kanıt izi rayı** bulunmalıdır:

`Hüküm → Yükümlülük → Kontrol → Test → Kanıt`

Her düğümün durumu ikon, etiket ve renkle birlikte gösterilir. Tıklanınca ilgili drawer/panel açılır. Bu, KALKAN_OS’un görsel imzasıdır.

---

## 5. Design token sistemi

Tokenlar tek merkezden yönetilmeli. Mevcut sistem Tailwind kullanıyorsa CSS variables + Tailwind semantic tokens; başka sistem varsa eşdeğer semantic token katmanı kullan.

Ham renk adlarını component içinde yayma. `blue-500` yerine `--color-accent`, `--color-critical`, `--surface-raised` gibi anlam tabanlı token kullan.

### 5.1 Light tema

| Token | Önerilen başlangıç | Kullanım |
|---|---:|---|
| `--bg-canvas` | `#F4F2EC` | sıcak kırık beyaz ana zemin |
| `--bg-subtle` | `#ECEAE3` | ikincil alan |
| `--surface` | `#FCFBF7` | kart/panel |
| `--surface-raised` | `#FFFFFF` | modal/drawer |
| `--text-primary` | `#111923` | ana metin |
| `--text-secondary` | `#52606D` | ikincil metin |
| `--border` | `#D8D5CC` | sınırlar |
| `--accent` | `#0D7180` | turkuaz ana vurgu |
| `--accent-strong` | `#1447A6` | kobalt eylem |
| `--art-copper` | `#A8663B` | sınırlı sanatsal işaret |

### 5.2 Dark tema

| Token | Önerilen başlangıç | Kullanım |
|---|---:|---|
| `--bg-canvas` | `#091018` | obsidyen/lacivert ana zemin |
| `--bg-subtle` | `#0E1722` | ikincil alan |
| `--surface` | `#121D29` | kart/panel |
| `--surface-raised` | `#182635` | modal/drawer |
| `--text-primary` | `#EEF4F7` | ana metin |
| `--text-secondary` | `#9DB0BE` | ikincil metin |
| `--border` | `#293B49` | sınırlar |
| `--accent` | `#4FC3C8` | turkuaz ana vurgu |
| `--accent-strong` | `#7EA6FF` | kobalt eylem |
| `--art-copper` | `#D49A6A` | sınırlı sanatsal işaret |

### 5.3 Semantik durum renkleri

Her durumda renk + ikon + metin zorunlu:

- `success`: geçti/doğrulandı
- `warning`: kısmi/yaklaşıyor
- `danger`: kaldı/süresi doldu/kritik
- `info`: bilgi/değişiklik
- `neutral`: taslak
- `unknown`: belirsiz; nötr griyle karıştırma, ayrı desen/ikon kullan
- `legal-review`: hukuk incelemesi; ölçülü mor/indigo

### 5.4 Tipografi

- Gövde ve UI: mevcut yerel/performanslı sans ailesi; yoksa `Inter` veya eşdeğer variable font.
- Sayısal tablolar/hash/tarih: tabular numbers; uzun hash için monospace.
- Başlıklar için ayrı bir display font ancak performans ve Türkçe karakter desteği doğrulanırsa kullanılabilir.
- En küçük yardımcı metin mobilde dahi 12 px altına düşmeyecek.
- Satır uzunluğu uzun açıklamalarda yaklaşık 70–80 karakterle sınırlanacak.

### 5.5 Geometri ve yüzey

- 4/8 px spacing tabanı.
- Kart radius: 12–16 px; her elemanı kapsüle dönüştürme.
- Buton radius: 8–10 px.
- Border, gölgeden daha baskın yüzey ayırıcıdır.
- Büyük gölge yalnız modal/drawer gibi yükseltilmiş yüzeylerde.
- Dekoratif topografik doku opacity light `%2–4`, dark `%3–6`; metin altına gelmez.

---

## 6. Tema mimarisi

### Gereksinimler

- `light`, `dark`, `system` seçenekleri.
- Tercih kullanıcı profilinde saklanabiliyorsa Supabase profil ayarına yaz; ilk yükleme için local storage/cookie fallback kullan.
- SSR varsa hydration flash oluşmayacak; tema ilk HTML paint’inden önce doğru uygulanacak.
- `color-scheme` browser’a bildirilecek.
- Grafik, tooltip, code block, scroll bar, toast ve portal bileşenleri temaya uyacak.
- Tema değişimi 150–200 ms olmalı; `prefers-reduced-motion` durumunda animasyon kapatılmalı.
- Oturum açmadan önce sistem tercihi; oturum sonrası kullanıcı tercihi üstün gelir.

Tema e2e senaryosu:

1. system’dan dark’a geç,
2. sayfayı yenile,
3. tercih korunuyor mu doğrula,
4. yeni route’a geç,
5. modal ve grafik renklerini doğrula,
6. çıkış/giriş sonrası profil tercihini doğrula.

---

## 7. Responsive uygulama kabuğu

### 7.1 Masaüstü ≥ 1280 px

- Sol rail: 272 px açık, 72 px daraltılmış.
- Üst context bar: kurum/tenant, global arama/komut paleti, bildirim, tema, kullanıcı.
- Ana içerik max-width zorunlu değil; tablo/graf ekranları genişliği kullanabilir.
- Detay ekranlarında opsiyonel sağ inspector: 360–420 px.

### 7.2 Tablet 768–1279 px

- Sol rail ikon modunda veya açılır drawer.
- Sağ inspector overlay drawer olur.
- Tablo kolonları önem derecesine göre gizlenir; kullanıcı “kolonlar” menüsünden açar.

### 7.3 Mobil < 768 px

- Alt navigasyon en fazla beş ana hedef: Ana Sayfa, Kontroller, Regülasyon, Kanıtlar, Menü.
- Liste satırları anlam kaybetmeden kart/stack görünümüne dönüşür.
- Kritik eylemler ekran altında sticky action bar olabilir.
- Modal yerine full-screen sheet tercih edilir.
- Dokunma hedefi minimum 44×44 px.
- Yatay scroll yalnız gerçek data grid için ve ilk kolon sticky olarak kullanılabilir.

### 7.4 Ana navigasyon bilgi mimarisi

1. **Genel Bakış**
2. **Güvence**
   - Kontroller
   - Kontrol Testleri
   - Bulgular
   - Kanıtlar
3. **Regülasyon**
   - Kaynaklar
   - Mevzuat Kütüphanesi
   - Yükümlülükler
   - Uygulanabilirlik
   - Değişiklik Radarı
4. **Operasyonel Dayanıklılık**
   - Kritik Hizmetler
   - Varlık/Hizmet Grafı
   - Olaylar ve Raporlama
5. **Yönetişim**
   - SoD
   - İstisnalar
   - Denetim Örnekleme (M17 hazır olduğunda)
   - Yetkinlik (M18 hazır olduğunda)
6. **Ürün Uyumu**
   - CRA
   - AI Act
   - Uyum Dosyaları
7. **Yönetim**
   - Kurum Profili
   - Kullanıcılar ve Roller
   - Entegrasyonlar
   - Sistem Sağlığı

Yetkisi olmayan modülü kullanıcıya göstermeme veya disabled gösterme kararı mevcut ürün davranışıyla tutarlı olmalıdır. Salt UI gizleme authorization değildir.

---

## 8. Ortak component seti

Mevcut component library varsa genişlet; paralel ikinci tasarım sistemi kurma.

### Temel bileşenler

- `AppShell`
- `ContextHeader`
- `NavRail`
- `MobileNav`
- `PageHeader`
- `MetricCard`
- `StatusBadge`
- `RiskPill`
- `LegalStatusBadge`
- `SourceTrustBadge`
- `EvidenceFreshnessBadge`
- `DataTable`
- `FilterBar`
- `SavedViewMenu`
- `CommandPalette`
- `Timeline`
- `EvidenceTraceRail`
- `LegalCitationCard`
- `SourceArtifactCard`
- `ApplicabilityDecisionCard`
- `ImpactDiffViewer`
- `GraphCanvas`
- `EmptyState`
- `Skeleton`
- `InlineError`
- `ConfirmDialog`
- `AuditDrawer`
- `InspectorDrawer`
- `ThemeSwitcher`

### Component durumları

Her veri bileşeninde şunları tasarla ve test et:

- loading,
- empty,
- filtered-empty,
- error,
- partial/stale,
- permission denied,
- offline/network timeout,
- optimistic action pending,
- success,
- conflict/409.

---

## 9. Ekran tasarımları

### 9.1 Executive Overview

Üst alan:

- “Bugün ne değişti?” özeti,
- kapsamlanan kurum/tenant,
- son kaynak senkronizasyonu,
- veri tazeliği ve sistem sağlığı.

Ana grid:

- doğrulanmış yükümlülük kapsaması,
- kontrol/test sonuç dağılımı,
- kritik kanıt süresi dolumları,
- yeni mevzuat etkileri,
- açık SoD çatışmaları,
- yaklaşan bildirim süreleri.

Alt alan:

- öncelikli eylem kuyruğu,
- regülasyon değişiklik zaman çizgisi,
- hukuk incelemesi bekleyen mapping’ler.

Gösterişli ama yanıltıcı tek bir “compliance score” üretme. Skor gösterilecekse kapsam, payda, son güncelleme ve belirsizlik görünür olmalıdır.

### 9.2 Kontrol listesi

- Sticky filtre bar.
- Regülasyon, yükümlülük, hizmet, sahip, durum, kanıt tazeliği ve risk filtreleri.
- Kaydedilmiş görünümler.
- Satırda kontrol kodu, başlık, kritik hizmet, test durumu, kanıt tazeliği, dayanak sayısı.
- Mobilde başlık + durum + en önemli iki sinyal; diğerleri açılır detay.

### 9.3 Kontrol detay — ana ürün ekranı

Üst başlık:

- kontrol kodu ve adı,
- owner,
- test sonucu,
- kanıt tazeliği,
- kapsam durumu,
- son değerlendirme.

Hemen altında `EvidenceTraceRail`.

Sekmeler:

1. Genel Bakış
2. Testler
3. Kanıtlar
4. Hukuki Dayanak
5. Bulgular
6. Denetim İzi

M12 canlı form ve çalışma akışını davranış olarak değiştirme; yeni componentlere güvenli şekilde taşı. Test sonucu ve öneri kabul/reddet akışı e2e ile aynı kalmalıdır.

### 9.4 Resmî kaynak sicili

- Kaynak otoritesi, ülke/yargı, güven seviyesi, erişim yöntemi, lisans, son başarılı çekim, checksum.
- Connector sağlık durumu.
- “Son artifact” ve önceki sürümler.
- Kaynak erişim politikası.
- Başarısız çekimde hata özeti; secret veya hassas response dump gösterme.

### 9.5 Mevzuat kütüphanesi

- Sol filtre: Türkiye/AB, otorite, belge türü, yürürlük durumu, tarih.
- Orta sonuç listesi.
- Sağ hüküm inspector: madde metni, geçerlilik aralığı, artifact hash, kaynak linki, önceki/sonraki sürüm.
- Değişiklikler side-by-side veya semantic diff.
- “Bu hüküm hangi yükümlülük ve kontrolleri etkiliyor?” ilişki listesi.

### 9.6 Yükümlülük grafı

- Graf varsayılan tek görünüm değildir; erişilebilir tablo görünümü daima bulunur.
- Düğümler: hüküm, yükümlülük, kontrol, test, kanıt.
- Edge türleri ve doğrulama statüsü.
- Filtre ve focus mode.
- Büyük grafı browser’ı kilitlemeden sanallaştır/limitli yükle.

### 9.7 Uygulanabilirlik sihirbazı

Adımlar:

1. kurum ve lisans profili,
2. hizmet/ürün profili,
3. coğrafya ve müşteri profili,
4. kritik altyapı/ICT/AI/ürün özellikleri,
5. karar özeti.

Her sonuçta:

- `Applicable`, `Not Applicable`, `Conditional`, `Unknown`;
- kullanılan gerçekler,
- karar kuralı,
- kaynak/hüküm,
- eksik bilgi,
- insan onayı,
- karar fingerprint’i.

`Unknown` sonucu kullanıcıyı eksik veriyi tamamlamaya yönlendirmelidir; yeşil gösterilmez.

### 9.8 Değişiklik radarı

- Tarih çizgisi ve önem seviyesi.
- Eski/yeni hüküm diff’i.
- Etkilenen yükümlülük, kontrol, test, kanıt ve tenant sayıları.
- `Unreviewed → Triaged → Legal Review → Accepted/Rejected → Implemented` akışı.
- Son tarih ve sorumlu.
- Etki kararı audit trail.

### 9.9 Kanıt gezgini

- Kanıt türü, kaynak, dönem, kontrol, gizlilik, tazelik ve bütünlük filtreleri.
- Hash doğrulama durumu.
- İlişkili test ve hukuk snapshot’ı.
- Önizleme yalnız yetki ve dosya türü uygunsa.
- İndirme audit edilir; signed URL kısa ömürlüdür.

### 9.10 SoD çalışma alanı

- Çatışma listesi ve risk önceliği.
- Kural, taraflar, atamalar ve fingerprint.
- İstisna yaşam döngüsü.
- Telafi kontrolü ve M12 test sonucu.
- Farklı kullanıcı onayı görünür.
- CSV import için dry-run, diff, apply, manifest ve rollback ekranı.

### 9.11 Raporlama geçidi

- Bildirim tipleri ve son tarihler.
- Taslak → hukuk incelemesi → bağımsız onay → imza → gönderim durum makinesi.
- Kullanılan kaynak ve kanıt paketi.
- Gönderim receipt/acknowledgement.
- Dış sisteme otomatik gönderim varsayılan kapalı; connector ve hukuki onay olmadan yalnız export.

### 9.12 Ürün uyum merkezi

- Ürün/sürüm bazlı CRA ve AI Act kapsamı.
- SBOM/vulnerability/incident kanıtları.
- Teknik dosya ve uygunluk beyanı.
- Piyasaya arz/önemli değişiklik zaman çizgisi.
- Eksik yükümlülükler ve kanıtlar.

---

## 10. Etkileşim ve hareket

- Animasyon fonksiyon açıklamalı olmalı: panel açılması, durum geçişi, graf focus.
- 150–250 ms; uzun parallax yok.
- `prefers-reduced-motion` ile non-essential animasyon sıfırlanır.
- Başarılı kayıt için sakin toast; kritik hukuk/kanıt kararı yalnız toast’a bırakılmaz.
- Destructive veya hukuken önemli işlemde özet + etki + onaylayan kimliği gösteren confirm dialog.
- Klavye focus ring daima görünür.
- Komut paleti: route, kontrol, yükümlülük ve kaynak araması; yetkisiz sonuç dönmez.

---

## 11. Erişilebilirlik ve yerelleştirme

- WCAG 2.2 AA hedefi.
- Normal metin kontrastı en az 4.5:1; büyük metin 3:1.
- Tüm fonksiyonlar klavye ile kullanılabilir.
- Drawer/modal focus trap ve geri dönüş doğru çalışır.
- Tablo header, sort ve selection semantiği bulunur.
- Grafiklerin tablo/tekst alternatifi vardır.
- Renk tek sinyal değildir.
- Türkçe karakter, uzun kurum adı ve uzun mevzuat başlığı ile layout testi yapılır.
- Tarih arayüzde yerel gösterilir; DB ve audit zamanı UTC tutulur.
- i18n anahtarları kullanılmalı; metinler component içine dağınık gömülmemeli.
- İlk teslim Türkçe; İngilizce genişleme için veri modeli ve layout hazır.

---

## 12. UI performans bütçesi

- İlk ekran kritik JS büyümesini ölç; gereksiz chart/graph library’yi global bundle’a alma.
- Ağır graf/diff ekranları dynamic import.
- Uzun tablo ve listeler sanallaştırılır veya server-side pagination kullanır.
- Skeleton gerçek layout’a yakın olmalı, CLS oluşturmamalı.
- Görseller SVG/CSS tabanlı ve düşük maliyetli; büyük raster dekor kullanma.
- Production için Lighthouse veya eşdeğer ölçüm kaydı oluştur.
- Hedef: erişilebilirlik ≥ 95; performans gerçek ekran ve hosting kapasitesine göre ölçülüp ADR’ye kaydedilir, sayı uğruna işlev gizlenmez.

---

# BÖLÜM B — REGÜLASYON ZEKÂSI MODÜLLERİ

## 13. M19 — Regulatory Source Fabric

### Amaç

Resmî hukuk ve düzenleyici kaynakları kayıtlı erişim politikalarıyla almak, ham artifact’ı değiştirilemez biçimde saklamak ve doğrulanabilir kaynak kimliği üretmek.

### Ana tablolar

- `regulatory_sources`
- `source_access_policies`
- `source_connectors`
- `source_fetch_runs`
- `source_artifacts`
- `source_artifact_signatures`
- `source_parser_versions`

Her tenant’a özel olmayan ortak hukuk verisini ayrı referans şemasında tut; tenant kararlarını tenant tablolarında tut. Ortak tabloya tenant RLS uydurma. Yetki modelini açık ADR ile belirle.

### Kaynak seviyeleri

- A: resmî gazete/kurum veya EUR-Lex gibi birincil hukuk kaynağı.
- B: düzenleyici kurumun resmî rehber/duyurusu.
- C: standart/otoritatif teknik kaynak.
- D: akademik/ikincil araştırma; hukuk doğrulaması için tek başına yeterli değildir.

### AB connector’ları

- CELEX ve ELI kimlikleri.
- EUR-Lex Webservice/XML.
- Yüksek hacimde CELLAR/Data Dump için ayrı adapter.
- Dil sürümleri ve consolidated/original distinction.

### Türkiye connector’ları

- Resmî Gazete ve resmî kurum yayınları.
- Siber Güvenlik Başkanlığı.
- SPK Mevzuat Sistemi ve resmî duyurular.
- BDDK, TCMB, MASAK, KVKK resmî kaynakları.
- Adalet Bakanlığı Mevzuat sistemi.

Türkiye tarafında kapsamlı ve istikrarlı açık API varmış gibi davranma. Erişim koşulu, lisans, robots/rate limit, arşivleme hakkı ve fallback yöntemi `SourceAccessPolicy` ile onaylanmadan connector üretime çıkmaz.

### Artifact zorunlu alanları

- authority/jurisdiction/source type,
- canonical URL ve external ID,
- fetched/issued/effective tarihleri,
- media type, language,
- raw object path,
- SHA-256,
- parser/version,
- license/access policy,
- predecessor/successor,
- fetch headers ve doğrulama sonucu.

---

## 14. M20 — Temporal Legal Corpus

- Belge, bölüm, madde, fıkra, bent ve ek düzeyinde adreslenebilir hukuk korpusu.
- Bitemporal model:
  - `valid_time`: hukuk dünyasında geçerlilik,
  - `system_time`: KALKAN_OS’un bilgiyi ne zaman kaydettiği.
- Metin normalizasyonu ham artifact’ı değiştirmez.
- Consolidated metin ile yayımlanan değişiklik ayrı kayıtlardır.
- Her provision ilgili source artifact’a ve hash’e bağlanır.
- `effective_from`, `effective_to`, `published_at`, `repealed_at`, `superseded_by` desteklenir.

---

## 15. M21 — Obligation & Control Knowledge Graph

Ana ilişki:

`Provision → Obligation → Applicability Rule → Control Objective → Control → Test Definition → Evidence Requirement`

### Doğrulama durumları

- `DRAFT_RESEARCH`
- `TODO_DOGRULA`
- `LEGAL_REVIEW`
- `VERIFIED`
- `SUPERSEDED`
- `REJECTED`

`VERIFIED` geçişi ayrı hukuk yetkisi ve audit kaydı ister. AI, parser veya seed script bu geçişi yapamaz.

Ortak kontrol birden fazla düzenlemeyi karşılayabilir; kanıt bir kez toplanıp yetki ve kapsam dahilinde birden fazla yükümlülüğe bağlanabilir. Bu bağlar tarihsel ve sürümlü olmalıdır.

---

## 16. M22 — Jurisdiction & Applicability Engine

Kurum profili, lisanslar, hizmetler, ürünler, coğrafya, müşteri türleri, kritik altyapı statüsü, ICT üçüncü tarafları, AI kullanım biçimi ve eşik değerleri üzerinden açıklanabilir kapsam kararı üret.

Sonuçlar:

- `APPLICABLE`
- `NOT_APPLICABLE`
- `CONDITIONAL`
- `UNKNOWN`

Karar çıktısı:

- kullanılan fact snapshot,
- kural sürümü,
- kaynak provision’lar,
- açıklama,
- eksik bilgiler,
- insan onayı,
- fingerprint,
- valid/system time.

`UNKNOWN != NOT_APPLICABLE` DB ve UI invariant’ıdır.

---

## 17. M23 — Legal-Basis Execution Guard

Zorunlu/uyum amaçlı test çalıştırılmadan önce:

1. obligation mapping doğrulanmış mı,
2. provision yürürlükte mi,
3. applicability kararı güncel mi,
4. kontrol ve test sürümü eşleşiyor mu,
5. kaynak stale/withdrawn mı,
6. gerekli kanıt şeması mevcut mu

kontrol edilir.

Sonuçlar:

- `ALLOW`
- `ALLOW_WITH_WARNING`
- `BLOCK`

Her çalıştırmada immutable `execution_legal_snapshot` oluştur:

- yürürlükteki provisions,
- obligation/control/test sürümleri,
- applicability decision,
- kaynak artifact hash’leri,
- mapping onayları,
- zaman,
- aktör,
- snapshot hash.

---

## 18. M24 — Regulatory Evidence & Citation Service

Her sonuçtan taşınabilir bir citation/evidence bundle üret:

- resmî kaynak künyesi,
- hüküm yolu ve kısa alıntı/snippet,
- canonical link,
- artifact SHA-256,
- hüküm ve mapping sürümü,
- applicability gerekçesi,
- kontrol/test sonucu,
- kanıt manifesti,
- audit olayları,
- oluşturma zamanı ve aktör.

Mevcut hash sözleşmesini bozma. Ek alanlar:

- `legalSnapshotHash`
- `sourceBundleHash`
- `applicabilityDecisionHash`

İmza/TSA kararları mevcut ADR ile uyumlu olmalı; gerçek anahtar/TSA seçilmeden sahte “production signed” davranışı üretme.

---

## 19. M25 — Regulatory Change & Impact Radar

- Yeni artifact’ı önceki sürümle karşılaştır.
- Yapısal ve metinsel diff üret.
- Etkilenen provision → obligation → control → test → evidence ilişkilerini çıkar.
- Otomatik mapping yalnız öneridir.
- Hukuk incelemesi ve uygulama işi oluştur.
- Son tarih ve risk önceliği hesapla.
- Eski mapping’i sessizce değiştirme; yeni sürüm üret.
- Kaynak staleness ve connector failure alarmı oluştur.

---

## 20. M26–M33 düzenleme paketleri

### M26 — Türkiye 7545 ve Kritik Altyapı

- 7545 sayılı Kanun hüküm/yükümlülük haritası.
- Kritik altyapı/kritik hizmet kapsamı.
- olay bildirimi, envanter, risk, denetim, iş sürekliliği ve tedarik zinciri kontrol paketleri.
- İkincil düzenleme çıkmadıysa `CONDITIONAL`/`TODO_DOGRULA`.

### M27 — Türkiye Finansal Düzenleyiciler

- SPK, BDDK, TCMB, MASAK, KVKK kaynak paketleri.
- Kurum türü/lisans ve faaliyet bazlı applicability.
- SPK çalışma notları araştırma girdisidir; bağlayıcı hukuk olarak seed edilmez.

### M28 — DORA Production Pack

- ICT risk management.
- incident classification/reporting.
- resilience testing.
- ICT third-party risk ve register of information.
- information sharing.
- madde/RTS/ITS düzeyinde source mapping.

### M29 — CRA Product Compliance Pack

- dijital unsurlu ürün kapsamı.
- vulnerability handling, SBOM, security update, reporting ve technical file.
- ürün/sürüm yaşam döngüsü ve piyasaya arz kararları.

### M30 — AI Act Assurance Pack

- AI system/use-case envanteri.
- provider/deployer/importer/distributor rolü.
- risk sınıfı ve prohibited practice kontrolleri.
- yüksek risk yükümlülükleri, logging, human oversight ve post-market monitoring.

### M31 — KVHS & AML Boundary Pack

- SPK KVHS ikincil düzenlemeleri.
- teknoloji/siber kontroller ile AML yükümlülükleri arasında açık sınır.
- MASAK uyumu için hukuk uzmanı onaylı mapping; KALKAN_OS hukuki karar vermez.

### M32 — Regulatory Reporting Gateway

- şema sürümlü rapor paketi.
- maker-checker ve bağımsız onay.
- JWS/TSA destekli imza zarfı, gerçek kararlar tamamlanınca.
- export, gönderim, receipt ve retry audit’i.
- dış bildirim connector’ı hukuk ve güvenlik onayı olmadan production’a açılmaz.

### M33 — Product Compliance Center

- kurumun kendi veya müşteriye sunduğu ürünler için CRA/AI Act dosyaları.
- ürün sürümü, SBOM, vulnerability, incident, conformity evidence.
- KALKAN_OS’un kendi ürün uyumu ayrı tenant/ürün bağlamında izlenebilir.

---

# BÖLÜM C — SUPABASE MİMARİSİ

## 21. Veri ve tenant güvenliği

- Supabase Postgres source of truth.
- Tenant tablolarında `tenant_id NOT NULL`.
- RLS varsayılan kapalı erişim yaklaşımıyla tasarlanır: açık policy yoksa veri görünmez.
- RLS her SELECT/INSERT/UPDATE/DELETE senaryosunda test edilir.
- RBAC, Supabase/Postgres RLS üstüne kurulur; yalnız client route guard’a dayanmaz.
- Service role yalnız güvenilir server/Edge Function’da; browser’a hiçbir koşulda verilmez.
- Ortak regülasyon referans verisi ile tenant karar/kanıt verisini şema ve yetki olarak ayır.
- Storage bucket’larında da RLS; object path tenant ve classification içerir.
- Signed URL kısa ömürlü ve auditlidir.

### RLS performansı

- Policy kolonlarını indeksle.
- Tenant + sık filtrelenen kolonlarda bileşik indeksleri gerçek query planıyla doğrula.
- Büyük listelerde count/pagination maliyetini ölç.
- RLS’yi kaldırarak performans “çözme”.

---

## 22. Supabase Auth ve SSR

Mevcut uygulama Next.js/SSR ise:

- `@supabase/ssr` browser ve server client’larını ayır.
- Cookie tabanlı SSR session akışını kullan.
- Server authorization için yalnız `getSession()` içindeki user nesnesine güvenme.
- Token/identity doğrulamasında güncel Supabase yöntemi (`getClaims()` veya server-confirmed `getUser()`) kullan.
- CDN/ISR cache’in kullanıcıya özel `Set-Cookie` response’larını başka kullanıcıya sunmasını engelle.
- Tenant context’i URL’den gelen değere kör güvenerek kurma; membership/RLS ile doğrula.

Framework Next.js değilse aynı güvenlik prensiplerini mevcut framework’e uygula ve ADR’de farkı kaydet.

---

## 23. Storage ve kanıt saklama

Önerilen private bucket ayrımı:

- `regulatory-source-artifacts`
- `tenant-evidence`
- `reporting-packages`
- `product-compliance-files`

Kurallar:

- Ham resmî artifact değiştirilemez nesne kimliği/hash ile saklanır.
- DB manifesti ile object hash eşleşir.
- Kanıt overwrite edilmez; yeni sürüm oluşturulur.
- MIME sniffing, boyut limiti ve zararlı içerik taraması entegrasyon noktası bulunur.
- Preview ayrı izin ister.
- Public bucket kullanma.
- KVKK/veri yerleşimi/saklama süresi kararlarını ADR ve tenant policy olarak kaydet; varsayma.

---

## 24. Cron, Edge Functions ve uzun işler

### `pg_cron` / Supabase Cron kullan

- süre dolumu,
- kaynak staleness kontrolü,
- küçük ve idempotent SQL maintenance,
- outbox dispatch tetikleme,
- kısa süreli senkronizasyon orkestrasyonu.

Her job:

- idempotency key,
- advisory lock veya satır kilidi,
- DB zamanı,
- run kaydı,
- satır bazlı hata izolasyonu,
- retry sınırı,
- alarm,
- manuel güvenli tekrar çalıştırma

sağlamalıdır.

Supabase Cron için uzun/yoğun işleri tek SQL job’a yığma. Güncel platform önerisi gereği eşzamanlı job ve çalışma süresi sınırlarını gözet.

### Edge Functions kullan

- webhook/connector endpoint,
- kısa süreli resmî kaynak çekimi,
- signed callback,
- haricî TSA/raporlama entegrasyonu,
- kısa orkestrasyon.

Edge Function’ı uzun süren parser veya toplu doküman işleyici olarak kullanma. Büyük işler outbox + kontrollü worker tasarımına alınmalı; bu worker gerçekten gerekiyorsa M25 uygulamasında ölçüm ve ADR ile Hostinger VPS worker olarak eklenebilir.

### DB bağlantısı

- Uzun yaşayan Hostinger Node server için direct IPv6 erişim uygunsa direct veya uygun session pooler.
- IPv4 ihtiyacında Supavisor session pooler.
- serverless/Edge kısa bağlantılarda transaction pooler.
- Transaction mode prepared statement destek kısıtını kullanılan driver’da dikkate al.
- Pool boyutlarını plan limitine göre ölç; bağlantı sızıntısı testi yap.

---

# BÖLÜM D — HOSTINGER DAĞITIMI

## 25. Hostinger çalışma modeli

Plan türü doğrulanmadan tek bir dağıtım yöntemi dayatma.

### Seçenek A — Hostinger managed Node.js app

Repository ve hPanel bunu doğruluyorsa:

- desteklenen güncel Node LTS sürümünü pinle,
- install/build/start komutlarını package manifest ile tanımla,
- production environment variables’ı hPanel secret/config alanında tut,
- health endpoint ekle,
- build artifact ve cache davranışını doğrula,
- branch tabanlı deploy ve rollback prosedürü yaz.

### Seçenek B — Hostinger VPS + Docker

VPS/Docker mevcutsa:

- multi-stage Docker build,
- non-root runtime user,
- read-only filesystem mümkünse,
- healthcheck,
- CPU/memory limit,
- restart policy,
- Nginx/Proxy Manager üzerinden TLS,
- yalnız gerekli portlar,
- secret’lar image içine değil runtime environment/secret store’a,
- immutable image tag/commit SHA,
- önceki image’a rollback.

Web app ve gelecekteki worker aynı image’dan farklı command ile çalışabilir; ihtiyaç oluşmadan worker container açma.

### Seçenek C — Statik hosting

Uygulama SSR/server action kullanıyorsa statik export’a zorla dönüştürme. Statik model ancak mevcut mimari gerçekten browser + Supabase API ise kullanılabilir. Hassas secret gerektiren veya service-role kullanan işlem Edge Function/server tarafına taşınır.

---

## 26. Hostinger güvenlik ve operasyon

- TLS zorunlu; HTTP → HTTPS.
- HSTS kontrollü rollout.
- CSP, frame-ancestors, nosniff, referrer ve permissions policy.
- Auth cookie: Secure, HttpOnly, uygun SameSite.
- `/health/live` ve dependency içeren `/health/ready` ayrımı.
- Reverse proxy gerçek client IP güven zinciri doğru yapılandırılır.
- Request body/upload limitleri.
- Rate limiting ve brute force koruması.
- Structured JSON log; secret, token, kanıt içeriği ve kişisel veri loglanmaz.
- Production source map erişimi kontrol edilir.
- Node/Next/React güvenlik patch’leri pinlenir; otomatik major upgrade yapılmaz.
- Hostinger resource/503 sınırları için CPU, memory, response time ve DB pool gözlemi.
- Uygulama ve Supabase region gecikmesi ölçülür.

### Cache güvenliği

- Kullanıcı/tenant özel HTML ve API yanıtları public cache’e girmez.
- Auth response ve `Set-Cookie` içeren yanıtlar CDN/Hostinger cache’inde paylaşılmaz.
- Statik asset fingerprint’li ve uzun cache; uygulama HTML’i kontrollü cache.
- Deploy sonrası cache purge yalnız gerekli kapsamda yapılır.

---

## 27. Environment değişkenleri

Gerçek isimleri repository’ye uyarla. Sınıflandır:

### Browser’da bulunabilir

- Supabase project URL.
- Publishable/anon key; yalnız RLS ile güvenlidir.

### Yalnız server

- Supabase service-role key.
- Database URL.
- JWS private key/KMS referansı.
- TSA credentials.
- connector credentials.
- Sentry DSN’in server-only parçası.

Kurallar:

- `.env*` secret commit edilmez.
- `.env.example` yalnız isim ve açıklama içerir.
- Startup’ta typed env validation; secret değerini hata mesajına basma.
- Preview/staging/production ayrı Supabase proje veya açık ayrıştırılmış ortam olmalı.
- Production migration uygulama startup’ında otomatik ve kontrolsüz çalışmaz.

---

# BÖLÜM E — GELİŞTİRME SIRASI

## 28. Tek seferde büyük yeniden yazım yapma

Her PR deploy edilebilir, geri alınabilir ve yeşil olmalıdır. Önerilen sıra:

### PR-0 — Baseline ve ADR

- Repository keşfi.
- Test tabanını doğrula.
- Hostinger plan/deploy modelini doğrula.
- Supabase bağlantı, RLS, Storage, Cron envanteri.
- UI route/component envanteri.
- Ekran görüntüsü baseline.
- Yeni ADR’ler: design system, tema, kaynak erişimi, ortak hukuk verisi/tenant ayrımı.

### PR-1 — UI Foundation

- Semantic tokenlar.
- Light/dark/system tema.
- AppShell, navigation, header.
- Temel status/citation/evidence components.
- Story/test sayfası veya mevcut component test yaklaşımı.
- Mevcut route davranışını değiştirmeden kabuk.

### PR-2 — Existing Screens Migration

- Dashboard.
- Kontrol listesi/detayı.
- M12 kontrol testi akışı.
- Bulgular/kanıtlar.
- Masaüstü/tablet/mobil.
- Görsel regresyon ve gerçek e2e.

### PR-3A — M16 CSV Contract + Parse + Dry Run

- `SodAssignmentImportRecord`.
- CSV parse/normalize.
- formula injection, boyut ve MIME güvenliği.
- kimlik çözümleme.
- DELTA/SNAPSHOT önizleme.
- dry-run UI.

### PR-3B — M16 Apply + Outbox + Manifest

- stale preview 409 hash bütünlüğü.
- idempotency.
- silme yerine sona erdirme.
- transaction/outbox SoD değerlendirmesi.
- import manifest.

### PR-3C — M16 Rollback + Yetki Ayrımı

- rollback sözleşmesi.
- maker-checker.
- audit.
- concurrency ve tenant güvenlik testleri.

### PR-3D — M16 UI + E2E + Production Gate

- geniş/dar ekran UI.
- hata ve kısmi sonuçlar.
- gerçek Chromium e2e.
- Hostinger/Supabase staging deploy.
- M16 üretim kapanışı.

M16’nın zaten kısmen uygulanmış PR’ları varsa aynı işi tekrar yapma; eksik parçaları repository gerçekliğine göre eşleştir.

### PR-4 — M19 Source Registry Skeleton

- tablolar, RLS/yetki, Storage bucket policy.
- source registry UI.
- manuel resmî artifact ingest.
- hash/manifest.
- connector yazmadan önce access policy.

### PR-5 — M19 EU Connector

- CELEX/ELI.
- EUR-Lex düşük hacim connector.
- artifact/version/dedup.
- retry/rate limit/health UI.

### PR-6 — M19 Türkiye Connector Framework

- resmî kaynak adapter arayüzü.
- allowlisted domain ve access policy.
- ham artifact arşivi.
- manuel fallback.
- tek kaynağa bağımlı olmayan kaynak sağlık görünümü.

### PR-7 — M20 Temporal Corpus

- bitemporal şema.
- provision parser sözleşmesi.
- source-to-provision lineage.
- mevzuat kütüphanesi UI.

### PR-8 — M21 Knowledge Graph

- obligation/mapping şeması.
- verification workflow.
- hukuk rolü.
- graph + accessible table UI.

### PR-9 — M22 Applicability

- rule DSL/contract.
- kurum fact snapshot.
- dört durum.
- açıklanabilir karar ve wizard UI.

### PR-10 — M23 Execution Guard

- M12 entegrasyonu.
- immutable legal snapshot.
- block/warning UI.
- stale/superseded kaynak testleri.

### PR-11 — M24 Citation Bundle

- bundle schema.
- hash zinciri.
- export/preview UI.
- yetki/audit.

### PR-12 — M25 Change Radar

- diff/impact.
- review workflow.
- job/worker ihtiyacı ölçümü.
- değişiklik radarı UI.

### PR-13+ — Düzenleme paketleri

Sıra:

1. M26 Türkiye 7545,
2. M27 Türkiye finans,
3. M28 DORA,
4. M29 CRA,
5. M30 AI Act,
6. M31 KVHS/AML,
7. M32 reporting gateway,
8. M33 product compliance center.

M17/M18 yalnız M16 üretim kapısından sonra, ayrıca onaylı ADR ile kodlanır. Regülasyon çekirdeği ile M17/M18’i aynı PR’a koyma.

---

## 29. Migration ve seed disiplini

- Her migration ileri uyumlu ve mümkünse expand/contract yaklaşımında.
- Büyük tablo backfill’i transaction/lock etkisi ölçülmeden çalıştırılmaz.
- Enum yerine sürümleme ihtiyacını gözden geçir; durum geçişleri DB guard ile korunur.
- Seed kaynakları:
  - resmî artifact kimliği,
  - kaynak sınıfı,
  - doğrulama statüsü,
  - seed sürümü,
  - provenance
  taşır.
- İlk 20 SPK kontrolü veya akademik notlar `VERIFIED` doğmaz.
- Production seed idempotent.
- Fixture ile hukuk seed’i ayrıdır.

---

## 30. Test stratejisi

### Birim

- parser/normalize,
- fingerprint/dedup,
- applicability rule,
- status transition,
- theme utility,
- format/i18n.

### DB/integration

- tenant RLS ve çapraz tenant saldırıları,
- hukuk doğrulama yetkisi,
- bitemporal sorgular,
- immutable artifact/snapshot,
- concurrent apply,
- outbox idempotency,
- cron tekrar çalıştırma,
- Storage policy.

### Contract

- EUR-Lex/resmî kaynak fixture’ları.
- Parser sürüm değişikliği.
- Kaynak formatı bozulması.
- Rate limit/timeouts.
- TSA/reporting connector mock ve signature validation.

### E2E — gerçek Chromium

En az:

1. light/dark/system ve persistence,
2. desktop/tablet/mobile navigation,
3. M12 form → test → kaldı → öneri kabul → bulgu,
4. M16 farklı kullanıcı istisna onayı,
5. M16 CSV dry-run → apply → çatışma,
6. resmî artifact → provision → obligation mapping,
7. applicability `UNKNOWN` ve eksik veri,
8. legal guard block,
9. test sonucu → citation bundle,
10. source change → impact review,
11. çapraz tenant IDOR engeli,
12. yetkisiz hukuk doğrulama engeli.

### Görsel regresyon

Kritik ekranları light/dark ve en az 390×844, 768×1024, 1440×900 ölçülerinde yakala. Snapshot farkını otomatik kabul etme; gözle incele.

### Güvenlik

- CSV formula injection.
- XSS: resmî metin/snippet/diff.
- SSRF: source connector URL.
- malicious PDF/HTML metadata.
- signed URL leakage.
- service-role browser bundle scan.
- CSP ihlalleri.
- cache cross-user/cross-tenant.
- RLS bypass.
- replay/idempotency.

---

## 31. Gözlemlenebilirlik

Ölç:

- web vitals ve route latency,
- Supabase query/pool latency,
- RLS-heavy query süreleri,
- connector success/failure/staleness,
- cron run ve retry,
- artifact/parser başarısızlıkları,
- applicability unknown oranı,
- legal guard block/warning,
- citation bundle üretim süresi,
- Storage upload/download hataları,
- Hostinger 5xx/resource kullanımı.

Correlation ID browser → Hostinger app → Edge Function → DB/outbox zincirinde taşınmalı. Audit event ile application log aynı şey değildir; audit kayıtları ayrı ve değiştirilemez iş mantığıdır.

---

## 32. Üretim kabul kapısı

Bir modül production-ready sayılmaz, ta ki:

- threat model güncel,
- migration staging’de denenmiş,
- tüm tenant tablolarında RLS doğrulanmış,
- authorization yalnız UI’a dayanmıyor,
- resmi source provenance mevcut,
- doğrulanmamış mapping doğru etiketli,
- audit ve immutable snapshot mevcut,
- idempotency/concurrency testleri geçmiş,
- erişilebilirlik AA kontrolleri geçmiş,
- dark/light/mobil doğrulanmış,
- production build geçmiş,
- Hostinger health/rollback doğrulanmış,
- Supabase pool/cron/storage limitleri ölçülmüş,
- backup/restore veya artifact recovery prosedürü yazılmış,
- ROADMAP/ADR güncel,
- e2e’de skip yok.

---

## 33. Claude Code ilerleme raporu biçimi

Her PR/oturum sonunda sadece aşağıdaki biçimde raporla:

### Teslim edilen

- davranış,
- değişen tablolar/migration,
- UI ekranları,
- güvenlik invariant’ları.

### Doğrulama

- birim: geçen/başarısız/skip,
- integration: geçen/başarısız/skip,
- e2e: geçen/başarısız/skip,
- responsive/theme kontrolü,
- production build,
- staging deploy/health.

### Mimari sapmalar

- bu talimattan ayrılan karar,
- repository/Hostinger/Supabase gerçeği,
- ADR veya kanıt.

### Açık kararlar ve riskler

- kurucu/hukuk/uyum onayı gerekenler,
- bloklayan teknik konu,
- bir sonraki en küçük güvenli PR.

“Tamamlandı” ifadesini yalnız ilgili üretim kabul kapısı tamamen geçtiğinde kullan.

---

## 34. Resmî teknik ve hukuk kaynakları

### AB hukuk verisi

- [EUR-Lex yeniden kullanım koşulları](https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html?locale=en)
- [EUR-Lex Webservice](https://eur-lex.europa.eu/content/help/data-reuse/webservice.html)
- [DORA — Regulation (EU) 2022/2554](https://eur-lex.europa.eu/eli/reg/2022/2554/oj/eng)
- [CRA — Regulation (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng)
- [AI Act — Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)

### Türkiye

- [7545 sayılı Siber Güvenlik Kanunu — 19 Mart 2025 Resmî Gazete nüshası](https://www.turmob.org.tr/arsiv/mbs/resmigazete/32846-1.pdf)
- [T.C. Siber Güvenlik Başkanlığı](https://siberguvenlik.gov.tr/)
- [SPK Mevzuat Sistemi](https://mevzuat.spk.gov.tr/Duyurular)
- [SPK KVHS ikincil düzenlemeleri duyurusu](https://spk.gov.tr/duyurular/basin-duyurulari/2025/kripto-varlik-hizmet-saglayicilarina-iliskin-iki-teblig-yayimlandi)
- [Adalet Bakanlığı Mevzuat sistemi](https://mevzuat.adalet.gov.tr/)

### Supabase

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Next.js SSR client ve Auth güvenliği](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Database bağlantı yöntemleri ve Supavisor](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control)

### Hostinger

- [Hostinger VPS yardım merkezi](https://www.hostinger.com/support/vps/)
- [Docker Manager ile container dağıtımı](https://www.hostinger.com/support/12040815-how-to-deploy-your-first-container-with-hostinger-docker-manager/)
- [Private GitHub repository’den Docker dağıtımı](https://www.hostinger.com/support/how-to-deploy-from-private-github-repository-on-hostinger-docker-manager/)
- [Nginx Proxy Manager kurulumu](https://www.hostinger.com/support/how-to-set-up-nginx-proxy-manager-using-hostinger-docker-manager/)
- [Hostinger 503/resource sınırı açıklaması](https://www.hostinger.com/support/3417446-how-to-fix-the-503-error-at-hostinger/)

Bu URL’ler başlangıç kaynak sicilidir. Connector geliştirme anında resmî sayfanın erişim koşulları ve güncel teknik dokümanı yeniden doğrulanmalıdır.

---

## 35. İlk komut

Bu dokümanı aldıktan sonra doğrudan bütün modülleri kodlamaya başlama. İlk turda yalnız:

1. repository keşfi,
2. test baseline,
3. Hostinger deploy tipi doğrulaması,
4. Supabase mimari envanteri,
5. UI ekran/route envanteri,
6. PR-0 ADR taslağı,
7. PR-1 ve mevcut M16 eksikleri için dosya bazlı uygulama planı

üret.

Kurucu kararı gerçekten gerekmeyen implementation ayrıntıları için soru sorma; repository’den çıkar ve ilerle. Ancak Hostinger plan tipi, JWS anahtar saklama sistemi, RFC 3161 TSA, hukuk doğrulama rolü veya dış regülatöre gerçek gönderim gibi kurumsal kararı uydurma. Bunları açık seçenek, öneri, risk ve karar kaydı olarak sun.

