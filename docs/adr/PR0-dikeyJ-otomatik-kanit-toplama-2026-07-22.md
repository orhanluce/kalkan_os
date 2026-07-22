# ADR — Dikey J: Otomatik Kanıt Toplama ve Sürekli Güvence Katmanı

**Tarih:** 22 Temmuz 2026 (güncelleme: 22 Temmuz 2026, §7)
**Durum:** MİMARİ ANALİZ KABUL EDİLDİ + KAPSAM KARARI ALINDI (§7) — hâlâ
KOD YOK. Migration yok, connector yok, API yok, sahte UI yok. Entra ID
connector'ı artık WardProof MVP'sini tamamlayan zorunlu dikey olarak
sınıflandırıldı (§7), ama geliştirmesi K1/K2/mevzuat paketi/pilot/geri-
bildirim kapıları kapanmadan BAŞLAMAZ (kural 20 değişmedi).

**Adlandırma notu:** Kurucunun talebinde bu vertikal "Dikey H" olarak
adlandırılmıştı, ama `docs/ROADMAP.md` §1.69'da AYNI GÜN İÇİNDE zaten farklı
bir "Dikey H — AI Yönetişimi ve Güvence Katmanı" tanımlandı (bu oturumun
önceki turunda). Çakışmayı önlemek için bu vertikal **Dikey J** olarak
kaydedildi — §1.70 Dikey I'den (Kriptografik Kanıt) sonraki ilk boş harf.
Kavramsal içerik kurucunun istediğinden BİREBİR aynı, yalnız harf değişti.

## 1. Bağlam ve amaç

Kurucunun hedefi: kurumsal müşterilere ve yatırımcı/pilot sunumlarında
WardProof'un yalnızca manuel kanıt yükleme yapan bir GRC aracı olmadığını,
otomatik kanıt toplama altyapısına doğru tasarlandığını göstermek —
**bugün var olmayan bir connector/entegrasyonu var gibi göstermeden.**

Bu doküman iki şeyi ayırır:
1. Bugün gerçekten var olan, otomatik toplamanın ÜZERİNE inşa edileceği
   çekirdek (evidence modeli, test motoru, kriptografik zincir, Proof Room).
2. Bu çekirdeğin üzerine connector'larla nasıl genişleyeceğinin mimari
   planı — kod yok, yalnız tasarım.

Bu vertikal YENİ bir isim icat etmez: `docs/ROADMAP.md`'de zaten iki kez
placeholder olarak anılmış modüllerin (M08 "Connector Platform", §2976;
M39 "Connector Hub", §1.20 satır 554) İLK detaylı mimari dökümüdür.

## 2. Bugünkü mimarinin analizi (otomatik toplamanın üzerine ineceği zemin)

| Katman | Bugünkü gerçek durum | Kaynak |
|---|---|---|
| **Evidence (kanıt) modeli** | `evidences` tablosu + `src/lib/evidence.ts`: MIME/boyut doğrulama (`validateEvidenceFile`, 20MB sınırı, izinli MIME listesi), süre-dolumu türetimi (`isEvidenceExpired`, `deriveDurumFromEvidenceExpiry`). Kaynak HER ZAMAN bir insan yüklemesi. `evidences.kaynak_kontrol_id` kolonu YOK (bilinen borç, ROADMAP §2710) — kanıtın hangi kontrolden geldiği bugün deterministik değil. | `src/lib/evidence.ts` |
| **Kanıt zarfı/bütünlük** | RFC 8785 canonical JSON (`canonical.ts`, kendi uygulamamız) + dört ayrı hash (`reportDataHash`/`pdfFileHash`/`coreManifestHash`/`packageManifestHash`, kural 15) + zarf soy bağı (redaction lineage). | `src/lib/canonical.ts`, `src/lib/evidence.ts` |
| **İmza** | ES256 detached JWS (`manifest-signature.ts`), bugün `LocalDevSigner` (dev-grade, kural 19). | `src/lib/manifest-signature.ts` |
| **Kriptografik şeffaflık defteri** | Merkle tabanlı append-only kütük (`transparency.ts`, RFC 9162 esinli) + bağımsız doğrulama CLI'ları (`verify-paket.ts`, `verify-seffaflik.ts`). | `src/lib/transparency.ts`, `src/lib/merkle.ts` |
| **Kontrol testleri** | `control-test.ts` (M12): `Gozlem` (gözlem) girdisi → `testDegerlendir` → 5 AYRI durum (`PASSED/FAILED/UNKNOWN/STALE/EXCEPTION`, kural 13 — birleştirilemez). **Bugün `Gozlem` bir İNSANIN UI'dan seçtiği değerdir** (`kontrol-test-bolumu.tsx`'teki 4 seçenekli dropdown). Kural 13'ün "toplama/connector arızası ASLA FAILED üretmez, UNKNOWN üretir" ilkesi bu motor için GÜNÜMÜZDE BİLE geçerli — motor bir connector'ı bekleyerek değil, ileriye dönük olarak yazılmıştı. | `src/lib/control-test.ts` |
| **Kontrol eşleştirme** | KISMEN var: `control_test_definitions.critical_service_id`/`scenario_template_id` (Dikey F1, opsiyonel/nullable, tenant guard'lı) test tanımını kritik hizmete/senaryoya bağlar. Ama kanıt→kontrol bağı (`evidences.kaynak_kontrol_id`) YOK — bu, connector'lı bir dünyada ÖN KOŞUL hâline gelir (aksi halde otomatik toplanan bir kanıtın hangi kontrole ait olduğu belirsiz kalır). | ROADMAP §2710 |
| **Proof Room** | `proof_room_links` + `proof_room_goruntule` RPC — süreli/iptal edilebilir, veri minimizasyonu (kanıt yalnız id+hash, kullanıcı kimliği dönmez). Beş polimorfik dal (test_run, applicability, sitasyon, tolerans karşılaştırması, kritik hizmet test paketi). | `docs/ROADMAP.md` §1.21 |
| **AI Güvence modülü** | `/ai-guvence` (M37): AI sistem envanteri (risk sınıfı), ajan yazma-yetkisi+insan-onayı, AI karar makbuzlarının (`ai_execution_receipts`) SUGGESTED doğması. **Connector'ın KENDİSİ AI değildir** (mekanik API çağrısı) — ama bir connector'ın "bu log kaydı hangi kontrole karşılık gelir" gibi bir sınıflandırma/eşleştirme ÖNERİSİ üretmesi istenirse, bu AYNEN `ai_execution_receipts` sözleşmesine (SUGGESTED + insan onayı, kural 16) tabi olur — Dikey H'nin H5'iyle (WardProof içi kontrollü yardımcı AI) aynı disiplin. | `src/app/(app)/ai-guvence/page.tsx` |

**Sonuç:** otomatik kanıt toplama katmanının alt 5 katmanı (kanıt modeli,
zarf/hash, imza, şeffaflık defteri, test motoru) BUGÜN ZATEN VAR ve
production'da. Eksik olan yalnızca EN BAŞTAKİ iki katman: kurumsal
sistemlere bağlanma (Connector Layer) ve o bağlantıdan gelen veriyi
`evidences`/`Gozlem` sözleşmesine dönüştürme (Evidence Collector) —
ki ikisi de bugün YOK.

## 3. Önerilen mimari (kod yok — yalnız tasarım)

```
Kurumsal Sistemler (Entra ID, M365, Azure, AWS, ...)
        ↓
Connector Layer            [PLANLANAN — bugün yok]
        ↓
Evidence Collector         [PLANLANAN — evidence.ts'in genişlemesi, yeni model DEĞİL]
        ↓
Kontrol Eşleştirme         [KISMEN VAR — control_test_definitions bağı var,
                             evidences.kaynak_kontrol_id borcu önce kapanmalı]
        ↓
Test Motoru                [BUGÜN VAR — control-test.ts, kod DEĞİŞMEZ,
                             yalnız Gozlem'in kaynağı insan yerine connector olur]
        ↓
Kriptografik Kanıt Zinciri  [BUGÜN VAR — canonical + JWS + Merkle ledger]
        ↓
Proof Room                  [BUGÜN VAR — 5 polimorfik dal, 6.sı bu olabilir]
```

### 3.1 Connector Layer (PLANLANAN)

- Her connector: salt-okur API erişimi, kurumun AÇIK OAuth/consent onayıyla
  (WardProof asla yönetici kimlik bilgisi İSTEMEZ — delegated/least-privilege
  scope).
- Kimlik bilgileri (`client_secret`/token) Supabase'e taşınamaz bağımlılık
  kuralına (kural 4) uygun şekilde saklanır — bu, self-hosted/yurt-içi
  taşınabilirlik gerekliliğiyle (VII-128.10 md.26) BİRLİKTE tasarlanmalı,
  sonradan yama değil.
- İlk aday connector'lar (kurucunun listesi): Microsoft Entra ID (kimlik/
  MFA/koşullu erişim politikaları), Microsoft 365 (DLP/uyum merkezi
  sinyalleri), Azure/AWS (güvenlik merkezi/config bulguları).
- **Kural 6'nın (belge §11) devamı:** SIEM/EDR/vulnerability scanner/PAM
  YENİDEN İNŞA EDİLMEZ — bunlar connector'ın KAYNAĞIDIR, WardProof onların
  yerini almaz, onlardan OKUR.

### 3.2 Evidence Collector (PLANLANAN)

`evidence.ts`'in bugünkü sözleşmesinin (MIME/boyut/expiry) AYNI şekilde
genişlemesi: bir connector'dan gelen veri de `evidences` tablosuna,
AYNI dört-hash/zarf disipliniyle girer. Yeni alan: `kaynak` (`MANUEL` |
`CONNECTOR`) + connector'a özgü provenance (kaynak sistem, çekim zamanı,
API sürümü — H4'ün AI Decision Receipt provenance ailesiyle AYNI desen).
**Yeni bir kanıt modeli İCAT EDİLMEZ** (kural 3'ün ruhu).

### 3.3 Kontrol Eşleştirme (KISMEN VAR, ÖN KOŞUL borcu var)

`evidences.kaynak_kontrol_id` (ROADMAP §2710 borcu) bu vertikalin GERÇEK
ön koşuludur — connector'lı bir kanıtın hangi kontrole ait olduğu
DETERMİNİSTİK olmalı, serbest-metin eşleşmesi YETERSİZ. Bu borç, Dikey J
başlamadan önce kapatılmalı (H1'in AI sistem envanteri gibi, bu da kendi
kodsuz analizini ister).

### 3.4 Test Motoru (BUGÜN VAR — kod değişmez)

`control-test.ts`'in `Gozlem`/`testDegerlendir` sözleşmesi AYNEN kalır.
Connector bağlandığında, insan dropdown'ından gelen `Gozlem` yerine
connector'ın ürettiği bir `Gozlem` motoru besler — **motor kodu
DEĞİŞMEZ**, yalnız `Gozlem`'in kaynağı değişir. Kural 13 zaten bunun için
yazılmıştı: toplama/connector arızası ASLA `FAILED` üretmez, `UNKNOWN`
üretir.

### 3.5 Kriptografik Kanıt Zinciri + Proof Room (BUGÜN VAR)

Connector kaynaklı bir kanıt/test sonucu da AYNI `canonical.ts` → JWS →
`transparency.ts` zincirine girer — yeni bir kripto katmanı İCAT EDİLMEZ.
Proof Room'a altıncı bir polimorfik dal (connector kaynaklı kanıt görünümü)
eklenip eklenmeyeceği AÇIK KARARDIR — kaynak sistem bilgisinin (örn. "Azure
Security Center") Proof Room'un minimize/anonim ilkesiyle nasıl uyumlu
gösterileceği ayrı bir tasarım kararı ister, bu belgede karar VERİLMEDİ.

## 4. Bugün / Planlanan / İddia edilmeyecek

**Bugün gerçekten var:**
- Kullanıcı tarafından yüklenen/tanımlanan kanıtlar (`evidences`, manuel).
- Kontrol testleri (`control-test.ts`, 5 ayrı durum, kural 13).
- Immutable kayıt zinciri (append-only `evidences`/`audit_log`, kural 2).
- Kriptografik doğrulama (RFC 8785 canonical + ES256 JWS + Merkle şeffaflık
  defteri + bağımsız CLI doğrulama).

**Planlanan (kod yok, bu belge yalnızca tasarım):**
- Microsoft Entra ID connector.
- Microsoft 365 connector.
- Azure/AWS cloud connector.
- Güvenli, API tabanlı kanıt toplama (Connector Layer + Evidence Collector).
- Otomatik kontrol doğrulama (connector'dan beslenen `Gozlem` → mevcut
  `testDegerlendir` motoru).

**İddia edilmeyecek (kural 3/13/16/18 — bu görevde özellikle vurgulanan):**
- Bugün canlı bir connector VAR denmeyecek.
- Gerçek zamanlı güvenlik taraması iddiası YAPILMAYACAK.
- "Otomatik uyumluluk garantisi" DENMEYECEK — bir connector veri ÇEKER,
  uyum durumuna İNSAN + deterministik motor karar verir (kural 11/16 aynen
  geçerli, connector bir istisna yaratmaz).
- "AI kullanıyoruz" DENMEYECEK — connector mekanik bir API istemcisidir, AI
  değildir; AI yalnız İSTEĞE BAĞLI bir sınıflandırma yardımcısı olarak
  (H5 disipliniyle, SUGGESTED+insan onayı) devreye girebilir.
- "Blockchain" DENMEYECEK (kural 18) — kriptografik zincir zaten var olan
  "kriptografik şeffaflık defteri" diliyle anlatılır.

## 5. Ürün/yatırımcı mesajlaşması (bu belgeyle birlikte üretildi)

**Landing page için (küçük, mevcut kartlarla uyumlu, "yakında" YOK):**

> WardProof, kurumların mevcut sistemlerinden güvenli şekilde kanıt
> toplayabilen ve bu kanıtları kontrol, test ve doğrulama zinciriyle
> ilişkilendiren bir güvence altyapısına doğru genişlemektedir.

**Video demo / yatırımcı sunumu için kısa mesaj:**

> WardProof bugün güvence süreçlerini, testleri ve kanıt zincirini yönetir.
> Yol haritamızda yer alan otomatik kanıt toplama katmanı ile kurumların
> kullandığı kimlik, bulut ve güvenlik sistemlerinden elde edilen verileri
> güvenilir kanıtlara dönüştürmeyi hedefliyoruz.

Her iki metin de şimdiki zamanda yalnız BUGÜN var olanı ("bugün ... yönetir"),
gelecek için yalnız yönelim/hedef dilini ("genişlemektedir", "hedefliyoruz")
kullanır — kesinlik veya tarih iddiası taşımaz.

## 6. Sıradaki adımlar (bu belgenin KENDİSİNDE kapsam dışı)

Öncelik sırası DEĞİŞMEDİ (CLAUDE.md kural 20): **özel SMTP TAMAMLANDI** (22
Temmuz 2026, canlı doğrulama — `docs/operasyon/OZEL_SMTP_KURULUMU.md` §3.6)
→ K1 restore provası → K2 → hukukça doğrulanmış ilk mevzuat paketi → ilk
pilot → pilot geri bildirimi. Dikey J'nin (ve Dikey H/I/K'nın) kodsuz
analizi/uygulaması bile bu sıra kapanmadan açılmaz. Sıra açıldığında ilk
gerçek adım muhtemelen `evidences.kaynak_kontrol_id` borcunu kapatmak olur
(§3.3) — connector olmadan bile değerli, kanıt→kontrol izlenebilirliğini
bugünden güçlendirir.

## 7. Kurucu kararı — Entra ID Connector, MVP'yi tamamlayan zorunlu dikey (22 Temmuz 2026)

Bu bölümden ÖNCEKİ tüm içerik (§1-6) Dikey J/K'nın "planlanan, kod yok,
öncelik sırasının GERİSİNDE" statüsündeki analiziydi. Kurucu bu analizin
üzerine AYRI, somut bir kapsam kararı verdi — bu bölüm o kararı kayıt
altına alır, önceki analizi GEÇERSİZ KILMAZ, üzerine ekler.

**Gerekçe (kurucunun kendi ifadesiyle):** otomatik kanıt toplama katmanı
MVP dışında bırakılırsa, WardProof güçlü bir güvence zincirine sahip olsa
bile müşteri gözünde "kanıtların tamamını yine biz mi elle gireceğiz?"
itirazına açık, yoğun-manuel-veri-girişli bir GRC uygulaması gibi
algılanabilir.

**Karar — MVP'nin yeni, DARALTILMIŞ kapsamı** (çok sayıda entegrasyon
değil, tek gerçek connector uçtan uca çalışsın):

1. **MVP artık iki kanıt kaynağını BİRLİKTE desteklemeden tamamlanmış
   sayılmaz:**
   - **Senaryo A — manuel akış (mevcut, korunacak):** kritik hizmet →
     kontrol → manuel kanıt → test → bulgu → düzeltici faaliyet → retest
     → bağımsız kapanış → Proof Room.
   - **Senaryo B — otomatik akış (yeni, MVP'ye eklenecek):** Microsoft
     Entra ID → WardProof Connector → ham gözlem → kanıt artefaktı →
     kontrol eşlemesi → insan incelemesi → kontrol testi → kriptografik
     güvence zinciri → Proof Room.
2. **İlk ve TEK MVP connector'ı Microsoft Entra ID'dir.** Microsoft 365,
   Azure, AWS, SIEM ve ticket sistemleri MVP SONRASINA bırakılır —
   kurucunun bilinçli kararı, tek entegrasyonu güvenli/izole/denetlenebilir/
   uçtan uca tamamlamak için.
3. **MVP kapsamı en fazla ÜÇ kontrolle sınırlıdır:** MFA kayıt durumu,
   Conditional Access politika varlığı, ayrıcalıklı yönetici rolleri —
   Dikey K'nın (§1.72, §8) beş adaydan daralttığı asgari küme.
4. **Connector çıktısı doğrudan PASSED/FAILED/UYUMLU/KAPALI ÜRETMEZ**
   (kural 16/21/22'nin somutlaşması) — yalnız kaynak gözlemi + kanıt
   artefaktı üretir; kontrol eşlemesi ve test değerlendirmesi mevcut
   insan-incelemeli güvence akışından geçer. Örnek: connector "Conditional
   Access politikası bulundu" gözlemler → WardProof "inceleme için otomatik
   kanıt oluşturuldu" der — ASLA "kurum uyumludur, kontrol PASSED" demez.
5. **Hata semantiği DEĞİŞMEDİ, yeniden teyit edildi** (kural 21, aynen
   geçerli — yeni bir durum İCAT EDİLMEDİ): connector hatası ≠ kontrol
   başarısızlığı; yetki eksikliği ≠ FAILED; veri alınamaması ≠ kontrol
   uygulanmıyor; eski/eksik veri ≠ güncel kanıt; otomatik kanıt ≠ otomatik
   uyum kararı. Hatalar `UNKNOWN`/`COLLECTION_ERROR`/`CREDENTIAL_EXPIRED`
   veya mevcut nötr durum sözlüğüyle yönetilir.

**MVP tamamlanmış sayılma şartı:** Senaryo A VE Senaryo B birlikte
çalışmadan MVP bitmiş sayılmaz. Bu, sunum/yatırımcı dilinde şöyle
söylenebilir hâle gelir: *"WardProof, kurumların manuel olarak sunduğu
kanıtları yönetmenin yanında, Microsoft Entra ID gibi kurumsal sistemlerden
kontrollü biçimde otomatik kanıt toplayarak bu verileri test, inceleme ve
kriptografik doğrulama zincirine dönüştürür."*

**Sıralama — DEĞİŞMEDİ, yalnız Entra connector'ın SINIFLANDIRMASI
değişti:** özel SMTP (TAMAMLANDI) → K1 → K2 → hukukça doğrulanmış ilk
mevzuat paketi → kontrollü pilot → pilot geri bildirimi → evidence kaynak
modeli → **Entra ID Connector MVP** → MVP kapanışı. Entra connector artık
"MVP sonrası isteğe bağlı özellik" değil, **MVP'yi tamamlayan zorunlu son
ürün dikeyidir** — ama sıradaki YERİ değişmedi; bu kapılar kapanmadan
geliştirmesi başlamaz.

**Bu turda kod yazılmadı.** Yalnız `CLAUDE.md` (kural 20 güncellendi, yeni
kural 25 eklendi), `docs/ROADMAP.md` (§1.73) ve bu ADR güncellendi —
ürün kapsamı ve kilometre taşı sınıflandırması değişti, migration/
connector/API/UI değişmedi.
