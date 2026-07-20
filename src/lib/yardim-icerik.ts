// Kullanıcı Kılavuzu içerik sözleşmesi — TEK kaynak. `/yardim*` sayfaları ve
// modül içi yardım panelleri (EkranYardimPaneli) AYNI veriden beslenir; içerik
// iki yerde tekrar YAZILMAZ.
//
// Kaynak: kurucunun "KALKAN_OS Kurumsal Kullanıcı Anlatım Şablonu 2026"
// belgesi — anlatım BİREBİR o belgeden, yalnız `route` alanları mevcut GERÇEK
// route'larla eşlendi (nav-items.ts taranarak; uydurulmuş/eski route YOK).
//
// Bu dosya SAF VERİDİR — JSX/React içermez, her iki tüketici de (tam kılavuz
// sayfası + kısa modül paneli) kendi render'ını yapar.

export interface ModulYardimIcerigi {
  /** /yardim sayfasındaki çapa (anchor) kimliği. */
  id: string;
  baslik: string;
  /** Bu modülün karşılık geldiği GERÇEK route(lar) — nav-items.ts'ten doğrulandı. */
  routeler: { yol: string; etiket: string }[];
  nedir: string;
  neIseYarar: string;
  neYapar: string[];
  /** Güvenlik/onay dikkat notu — yalnız gerçekten varsa (her modülde zorunlu değil). */
  dikkat?: string;
}

export const MODUL_YARDIMLARI: ModulYardimIcerigi[] = [
  {
    id: "ana-panel",
    baslik: "Ana Panel",
    routeler: [{ yol: "/", etiket: "Pano" }],
    nedir: "Kurumun genel durumunu gösteren başlangıç ekranıdır.",
    neIseYarar:
      "Hangi işlerin beklediğini, hangi kontrollerin zayıf olduğunu, hangi kanıtların süresinin dolduğunu ve hangi bulguların geciktiğini tek bakışta görürsünüz.",
    neYapar: [
      "Bekleyen işlerinizi açarsınız.",
      "Öncelikli bulguları incelersiniz.",
      "Yaklaşan son tarihleri takip edersiniz.",
      "Yönetici iseniz genel durumu ve kritik riskleri görürsünüz.",
    ],
  },
  {
    id: "regulasyon-kaynaklar",
    baslik: "Regülasyon ve Kaynaklar",
    routeler: [
      { yol: "/regulasyon/kaynaklar", etiket: "Kaynaklar" },
      { yol: "/regulasyon/dogrulama", etiket: "Doğrulama Kuyruğu" },
    ],
    nedir: "Kanun, yönetmelik, tebliğ, AB düzenlemesi ve kurum içi kural kaynaklarının tutulduğu alandır.",
    neIseYarar: "Kurumun bir görevi hangi kaynağa dayanarak yaptığını gösterir.",
    neYapar: [
      "Kaynağın başlığını ve geçerlilik tarihini incelersiniz.",
      "Kendi kurumunuzla ilgili olup olmadığını kontrol edersiniz.",
      "Kaynağın hukuk/uyum ekibi tarafından incelenmesini istersiniz.",
      "Kaynağa bağlı görev ve kontrolleri görürsünüz.",
    ],
    dikkat: "Kaynağı doğrulanmamış bilgi kesin hüküm olarak gösterilmez. Böyle bir kayıt “doğrulanmayı bekliyor” şeklinde işaretlenir.",
  },
  {
    id: "kurum-profili",
    baslik: "Kurum Profili ve Uygulanabilirlik",
    routeler: [
      { yol: "/kurulum", etiket: "Kurum Profili" },
      { yol: "/regulasyon/uygulanabilirlik", etiket: "Uygulanabilirlik" },
    ],
    nedir: "Kurumun türü, ülkesi, hizmetleri, kritik faaliyetleri ve bağlı olduğu yapıların tanımlandığı alandır.",
    neIseYarar:
      "Her kural her kurum için aynı şekilde geçerli değildir. Sistem, kurum profilini kullanarak hangi yükümlülüklerin ilgili olduğunu ayırır.",
    neYapar: ["Kurum bilgilerini doğru ve güncel tutarsınız."],
    dikkat: "Yanlış veya eksik profil yanlış sonuç doğurabilir — hangi yükümlülüklerin ilgili olduğu kararı buna dayanır.",
  },
  {
    id: "yukumlulukler-kontroller",
    baslik: "Yükümlülükler ve Kontroller",
    routeler: [{ yol: "/controls", etiket: "Kontroller" }],
    nedir: "Kurumun yapması gereken işler ve bu işleri karşılayan kontrol adımlarıdır.",
    neIseYarar: "“Bu madde için ne yapacağız?” sorusunu somut bir iş planına çevirir.",
    neYapar: [
      "Yükümlülüğün açıklamasını okursunuz.",
      "Sorumluyu ve son tarihi kontrol edersiniz.",
      "Kontrolün hangi kanıta ihtiyaç duyduğunu görürsünüz.",
      "Eksikse görev veya bulgu oluşturursunuz.",
    ],
  },
  {
    id: "kontrol-testleri",
    baslik: "Kontrol Testleri",
    routeler: [{ yol: "/controls", etiket: "Kontroller (kontrol detayında)" }],
    nedir: "Bir kontrolün kâğıt üzerinde değil, gerçekte çalışıp çalışmadığını sınayan bölümdür.",
    neIseYarar: "“Politikamız var” demek yerine “kontrolümüz çalışıyor ve bunu test ettik” diyebilmenizi sağlar.",
    neYapar: [
      "Test tanımını seçersiniz.",
      "İncelenecek gözlemi seçersiniz.",
      "Testi çalıştırırsınız.",
      "Sonucu ve öneriyi incelersiniz.",
      "Gerekirse bulgu açar veya öneriyi kabul eder/reddedersiniz.",
    ],
  },
  {
    id: "kanit-kasasi",
    baslik: "Kanıt Kasası",
    routeler: [{ yol: "/controls", etiket: "Kontroller (kontrol detayında)" }],
    nedir: "Kontrolün uygulandığını gösteren belge, kayıt, ekran çıktısı, log özeti veya test sonucunun saklandığı alandır.",
    neIseYarar: "Kanıtın hangi kontrol için toplandığını, ne zaman üretildiğini ve sonradan değiştirilip değiştirilmediğini takip eder.",
    neYapar: [
      "Kanıtı doğru kontrolle ilişkilendirirsiniz.",
      "Kanıtın tarihini ve sahibini belirtirsiniz.",
      "Süresi dolan kanıtı yenilersiniz.",
    ],
    dikkat: "Hassas veya gereksiz kişisel veri yüklemeyin.",
  },
  {
    id: "bulgular",
    baslik: "Bulgular ve Düzeltici Faaliyetler",
    routeler: [{ yol: "/findings", etiket: "Bulgular" }],
    nedir: "Test veya inceleme sonucunda bulunan eksiklerin takip edildiği alandır.",
    neIseYarar: "Eksiklerin unutulmasını ve yalnızca “tamamlandı” denilerek kapatılmasını önler.",
    neYapar: [
      "Bulgunun nedenini açıklarsınız.",
      "Sorumlu ve son tarih belirlersiniz.",
      "Düzeltme kanıtını eklersiniz.",
      "Yeniden test istersiniz.",
      "Bağımsız kapanış gerekiyorsa ilgili kişiye gönderirsiniz.",
    ],
  },
  {
    id: "gorevler-ayriligi",
    baslik: "Görevler Ayrılığı (SoD)",
    routeler: [
      { yol: "/sod", etiket: "Görevler Ayrılığı" },
      { yol: "/sod/atamalar", etiket: "Atamalar" },
    ],
    nedir: "Kritik bir işlemi başlatan kişinin aynı işlemi tek başına onaylayamamasını sağlayan kontroldür.",
    neIseYarar: "Hata, kötüye kullanım ve yetki suistimali riskini azaltır. Örnek: bir çalışan tedarikçi istisnasını talep edebilir; ancak kendi talebini onaylayamaz.",
    neYapar: ["Çatışmayı incelersiniz.", "Gerekçeli istisna talep edersiniz.", "Telafi edici kontrolü gösterirsiniz.", "Bağımsız onayı beklersiniz."],
  },
  {
    id: "tedarikciler",
    baslik: "Tedarikçiler ve Alt Yükleniciler",
    routeler: [{ yol: "/tedarikciler", etiket: "Tedarikçiler" }],
    nedir: "Kurum adına teknoloji veya kritik hizmet sunan şirketlerin takip edildiği alandır.",
    neIseYarar: "Tedarikçinin güvenlik durumu, sözleşmesi, hizmeti, alt yüklenicisi, kritikliği ve açık bulguları tek yerde görünür.",
    neYapar: [
      "Tedarikçi değerlendirmesini tamamlarsınız.",
      "Açık kritik bulguları takip edersiniz.",
      "Sözleşme ve çıkış planını kontrol edersiniz.",
      "Gerekirse tedarikçiye süreli paylaşım bağlantısı açarsınız.",
    ],
  },
  {
    id: "kritik-hizmetler",
    baslik: "Kritik Hizmetler ve Bağımlılıklar",
    routeler: [
      { yol: "/kritik-hizmetler", etiket: "Kritik Hizmetler" },
      { yol: "/dayaniklilik", etiket: "Dayanıklılık Etki Grafiği" },
    ],
    nedir: "Kurumun durması halinde ciddi sonuç doğuracak hizmetlerin ve bu hizmetlere bağlı sistemlerin gösterildiği alandır.",
    neIseYarar: "Bir güvenlik açığının veya tedarikçi kesintisinin hangi iş sürecini etkileyebileceğini gösterir.",
    neYapar: ["Hizmet, sistem, tedarikçi, alt yüklenici ve kontrol arasındaki bağlantıların doğru olduğunu doğrularsınız."],
    dikkat: "Buradaki sonuçlar yapısal bir hesaplamadır (grafikteki bağlantılara dayanır) — kesin bir gerçeklik iddiası değildir; eksik veri her zaman “bilinmiyor” olarak kalır.",
  },
  {
    id: "dora-roi",
    baslik: "DORA RoI Export",
    routeler: [{ yol: "/dora-roi", etiket: "DORA RoI Export" }],
    nedir: "DORA kapsamında gerekli bilgileri belirli bir formatta hazırlayan ve dışarı aktaran bölümdür.",
    neIseYarar: "Kurum kimliği, ICT hizmetleri, tedarikçiler, sözleşmeler ve kritik fonksiyonlardan oluşan kayıtları denetime hazır hale getirir.",
    neYapar: ["Yeni export oluşturursunuz.", "Ön kontrol raporunu incelersiniz.", "Engelleyici sorun yoksa onay talep edersiniz."],
    dikkat: "Engelleyici eksik varken export yayımlanamaz. Export, talep eden kişiden FARKLI bir kullanıcı tarafından onaylanır.",
  },
  {
    id: "claim-guard",
    baslik: "Claim Guard ve Güvence",
    routeler: [{ yol: "/guvence", etiket: "İddia Güvencesi" }],
    nedir: "Sistemin kanıtsız veya doğrulanmamış bilgiyi kesin gerçek gibi göstermesini engelleyen güvenlik katmanıdır.",
    neIseYarar: "“Kurum uyumludur”, “risk yoktur” veya “kontrol çalışmaktadır” gibi ifadelerin gerçekten kaynak ve kanıta dayanmasını sağlar.",
    neYapar: ["Kaynağı, kanıtı ve bağımsız onayı kontrol edersiniz."],
    dikkat: "Eksikse iddia doğrulanmış olarak yayımlanmaz.",
  },
  {
    id: "proof-room",
    baslik: "Proof Room",
    routeler: [],
    nedir: "Denetçi, tedarikçi veya yetkili dış kişinin hesap açmadan, süreli ve sınırlı biçimde kanıt paketini görebildiği alandır.",
    neIseYarar: "Kurum içindeki tüm sistemi açmadan, yalnızca gerekli sonucu ve kanıt özetini güvenli biçimde paylaşır.",
    neYapar: [
      "İlgili ekrandaki (kontrol koşusu, DORA export veya dayanıklılık anlık görüntüsü) “Proof Room Linki Oluştur” düğmesini kullanırsınız.",
      "Oluşan bağlantıyı yalnızca ilgili dış kişiyle paylaşırsınız.",
      "Gerekirse bağlantıyı süresi dolmadan iptal edersiniz.",
    ],
    dikkat: "Bağlantının süresi ve içeriği veritabanında sınırlanır — paylaşılan kişi yalnızca ilgili sonucu görür, kurumun tüm verisini değil.",
  },
  {
    id: "seffaflik-defteri",
    baslik: "Şeffaflık Defteri ve Hash",
    routeler: [{ yol: "/seffaflik", etiket: "Şeffaflık Defteri" }],
    nedir: "Önemli kanıt ve export işlemlerinin sonradan sessizce değiştirilmediğini kontrol eden kayıt mekanizmasıdır.",
    neIseYarar: "Sistem, “bu rapor sonradan değiştirildi mi?” sorusuna doğrulanabilir cevap verebilir.",
    neYapar: ["Bir kaydın deftere mühürlenip mühürlenmediğini (durumunu) görürsünüz.", "Makbuzu indirip bağımsız olarak doğrulayabilirsiniz."],
  },
  {
    id: "yonetim-denetim-raporlari",
    baslik: "Yönetim ve Denetim Raporları",
    routeler: [
      { yol: "/denetim", etiket: "Denetim Çalışma Alanı" },
      { yol: "/denetim-izi", etiket: "Denetim İzi" },
    ],
    nedir: "Teknik ayrıntıları yönetim, denetçi ve regülatör için anlaşılır çıktılara dönüştüren alandır.",
    neIseYarar: "Yönetim kurulu; kritik açıkları, geciken aksiyonları, güvence seviyesini ve kanıt durumunu görebilir.",
    neYapar: ["Örnekleme ve çalışma kâğıdını incelersiniz.", "Bağımsızlık beyanlarını kontrol edersiniz.", "Denetim izini (kim/ne/ne zaman) görürsünüz."],
  },
];

export interface HizliBaslangicAdimi {
  sira: number;
  baslik: string;
  aciklama: string;
  route: string;
}

export const HIZLI_BASLANGIC_ADIMLARI: HizliBaslangicAdimi[] = [
  { sira: 1, baslik: "Kurum profilini kontrol et", aciklama: "Kurumunuzun türü, ülkesi ve kritik faaliyetleri doğru mu, önce burayı kontrol edin.", route: "/kurulum" },
  { sira: 2, baslik: "Sana atanan işleri gör", aciklama: "Ana panelde bekleyen işlerinizi, açık bulgularınızı ve yaklaşan son tarihleri görün.", route: "/" },
  { sira: 3, baslik: "Bir kontrolü aç ve kanıtı incele", aciklama: "Bir kontrolün detayına girin, hangi kanıtın yüklü olduğunu ve süresini kontrol edin.", route: "/controls" },
  { sira: 4, baslik: "Kontrol testini çalıştır", aciklama: "Kontrol detayındaki test bölümünden bir gözlem seçip testi çalıştırın.", route: "/controls" },
  { sira: 5, baslik: "Sonucu, bulguyu ve sonraki adımı kontrol et", aciklama: "Test sonucu başarısızsa açılan bulguyu inceleyin, sorumlu ve son tarih belirleyin.", route: "/findings" },
];

export interface SozlukTerimi {
  terim: string;
  aciklama: string;
}

export const SOZLUK: SozlukTerimi[] = [
  { terim: "Regülasyon", aciklama: "Kurumunuzun uyması gereken kanun, yönetmelik, tebliğ veya AB düzenlemesi gibi resmî kural kaynağı." },
  { terim: "Yükümlülük", aciklama: "Regülasyonun kurumunuza yüklediği somut bir gereklilik — “şunu yapmalısınız” maddesi." },
  { terim: "Kontrol", aciklama: "Bir yükümlülüğü karşılamak için kurumun uyguladığı iş adımı, teknik ayar veya süreç." },
  { terim: "Gözlem", aciklama: "Bir kontrol testinde incelenen somut durum — örneğin “erişim listesi güncel mi” sorusunun cevabı." },
  { terim: "Test", aciklama: "Bir kontrolün kâğıt üzerinde değil, gerçekte çalışıp çalışmadığını sınayan işlem." },
  { terim: "Kanıt", aciklama: "Bir kontrolün uygulandığını gösteren belge, ekran çıktısı, log özeti veya test sonucu." },
  { terim: "Bulgu", aciklama: "Bir testte veya incelemede ortaya çıkan eksiklik; sorumlusu ve son tarihiyle takip edilir." },
  { terim: "Düzeltici faaliyet", aciklama: "Bir bulguyu gidermek için yapılan iş; kanıtla ve gerekirse yeniden testle kapatılır." },
  { terim: "Retest (yeniden test)", aciklama: "Düzeltmenin gerçekten işe yaradığını doğrulamak için testin tekrar çalıştırılması." },
  { terim: "SoD / görevler ayrılığı", aciklama: "Bir işlemi başlatan kişinin aynı işlemi tek başına onaylayamaması kuralı." },
  { terim: "Maker-checker / dört göz ilkesi", aciklama: "Bir kararı hazırlayan kişiden farklı, bağımsız bir kişinin onaylaması gerektiği kural." },
  { terim: "Tenant", aciklama: "Sistemdeki kurumunuzun kendi ayrı, izole veri alanı — başka kurumların verisini göremezsiniz, onlar da sizinkini göremez." },
  { terim: "RLS", aciklama: "Satır düzeyinde erişim güvenliği (Row Level Security) — veritabanının kendisinin, her kullanıcıya yalnız kendi kurumunun verisini göstermesini sağlayan teknik önlem." },
  { terim: "Hash", aciklama: "Bir belgenin veya kaydın “parmak izi” — içerik en ufak şekilde değişse bile bu iz de değişir, böylece değişiklik fark edilir." },
  { terim: "Zaman damgası", aciklama: "Bir işlemin ne zaman yapıldığını gösteren, sonradan değiştirilemeyen kayıt." },
  { terim: "Proof Room", aciklama: "Denetçi veya yetkili dış kişinin hesap açmadan, süreli olarak kanıt paketini görebildiği paylaşım alanı." },
  { terim: "Claim (iddia)", aciklama: "“Bu kural karşılanıyor” gibi bir uyum/güvence ifadesi — kaynak, kanıt ve bağımsız onay olmadan kesin gösterilmez." },
  { terim: "Provenance / kaynak soyu", aciklama: "Bir bilginin nereden geldiğinin, hangi kayda ve kanıta dayandığının izlenebilir zinciri." },
  { terim: "ICT hizmeti", aciklama: "Kurumun dışarıdan aldığı bilgi ve iletişim teknolojisi hizmeti (örn. bulut barındırma)." },
  { terim: "Kritik/önemli fonksiyon", aciklama: "Durması halinde kurumun faaliyetini ciddi şekilde etkileyecek iş süreci veya hizmet." },
  { terim: "Tedarikçi", aciklama: "Kurum adına teknoloji veya kritik hizmet sunan dış şirket." },
  { terim: "Alt yüklenici", aciklama: "Bir tedarikçinin kendi hizmetini sunarken kullandığı başka bir şirket (dördüncü taraf)." },
];

export interface RolAciklamasi {
  rol: string;
  sorumluluk: string;
}

export const ROLLER: RolAciklamasi[] = [
  { rol: "Kurum yöneticisi", sorumluluk: "Genel durum, kritik risk ve kararları izler." },
  { rol: "Uyum/hukuk kullanıcısı", sorumluluk: "Kaynak, uygulanabilirlik ve yükümlülükleri doğrular." },
  { rol: "Siber güvenlik kullanıcısı", sorumluluk: "Kontrol, test, kanıt ve bulguları yönetir." },
  { rol: "Sistem/BT kullanıcısı", sorumluluk: "Teknik gözlem ve düzeltme kanıtı sağlar." },
  { rol: "Denetçi", sorumluluk: "Kendisine açılan kanıt paketini inceler." },
  { rol: "Tedarikçi", sorumluluk: "Kendi değerlendirme ve açık bulgularını görür." },
  { rol: "Onaylayan", sorumluluk: "Hazırlayan kişiden bağımsız olarak karar verir." },
];

export interface DurumAciklamasi {
  durum: string;
  anlami: string;
}

export const DURUM_SOZLUGU: DurumAciklamasi[] = [
  { durum: "Taslak", anlami: "Henüz tamamlanmamış kayıt." },
  { durum: "İnceleme bekliyor", anlami: "Başka bir yetkili tarafından kontrol edilmeli." },
  { durum: "Doğrulandı", anlami: "Kaynak, kanıt ve bağımsız onay mevcut." },
  { durum: "Doğrulanmadı", anlami: "Eksik veya şüpheli bilgi var." },
  { durum: "Uyarı", anlami: "İşlem devam edebilir; dikkat gerektiren konu var." },
  { durum: "Engellendi", anlami: "Zorunlu eksik nedeniyle işlem yayımlanamaz." },
  { durum: "Süresi doldu", anlami: "Kanıt veya onay yenilenmeli." },
  { durum: "Kapatıldı", anlami: "Düzeltme tamamlandı ve gerekli kapanış yapıldı." },
];

export const SIK_YAPILMAMASI_GEREKENLER: string[] = [
  "Eski bir belgeyi güncel kanıt gibi yüklemek.",
  "Kanıtın içine gereksiz kişisel veri koymak.",
  "Başkasının onayını kendi hesabıyla vermek.",
  "Açık bulguyu yalnızca açıklama yazarak kapatmak.",
  "Doğrulanmamış mevzuat bilgisini kesin kural gibi paylaşmak.",
  "Tedarikçi veya denetçiyle gereğinden fazla iç veri paylaşmak.",
];

export const KISA_CUMLELER: string[] = [
  "KALKAN_OS, kuralı göreve; görevi teste; testi kanıta; kanıtı denetime bağlar.",
  "Sistem yalnız eksik var mı diye bakmaz; eksikliğin hangi kritik hizmeti etkilediğini de gösterir.",
  "Kanıt yoksa sistem kesin uyum iddiası üretmez.",
  "Bir kişinin kendi hazırladığı kararı tek başına kesinleştirmesi engellenir.",
  "Denetçiye tüm sistemi açmadan, yalnızca gereken kanıt paylaşılır.",
];

export const HAFTALIK_RUTIN_UYUM_YONETICISI: string[] = [
  "Yeni veya değişen kaynakları incele.",
  "Uygulanabilirlik kararlarını kontrol et.",
  "Kritik bulguları ve süresi dolan kanıtları gözden geçir.",
  "Maker-checker bekleyen kararları tamamla.",
  "Denetim veya yönetim raporunu üret.",
];
