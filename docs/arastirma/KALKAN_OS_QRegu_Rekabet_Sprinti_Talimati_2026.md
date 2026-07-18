# CLAUDE CODE — KALKAN_OS QREGU REKABET SPRINTİ ANA KOMUTU

## Kanıt Üreten Sürekli Uyum İşletim Sistemi — İlk 90 Gün

**Sürüm:** 1.0  
**Tarih:** 18 Temmuz 2026  
**Hedef:** Mevcut KALKAN_OS repository + Supabase + Hostinger  
**Çalışma biçimi:** Küçük, doğrulanmış PR'lar; her PR sonunda yeşil taban ve kurucu raporu

---

## 0. Belge önceliği

Bu dosyayı aşağıdaki belgelerle birlikte oku:

1. `CLAUDE_CODE_KALKAN_OS_MASTER_TALIMAT_UI_REGULASYON_HOSTINGER_SUPABASE.md`
2. `CLAUDE_CODE_KALKAN_OS_V2_MVP_STRATEJI_EK_TALIMAT.md`
3. `KALKAN_OS_Regulasyon_Zekasi_ve_Tam_Uyum_Modulleri_2026.md`
4. `KALKAN_OS_AI_BLOCKCHAIN_STRATEJI_RAPORU_2026.md`
5. repository içindeki gerçek `ROADMAP`, ADR, schema, migration ve testler

Çelişkide güvenlik, tenant izolasyonu, hukuk doğrulaması ve veri kaybını önleyen daha sıkı kural üstündür. Bu dosya, **M16 üretim kapısından sonraki ilk 90 günlük ürün ve PR sırasında** önceliklidir. Mevcut modülleri yeniden numaralandırma.

---

## 1. Kurucu ürün kararı

KALKAN_OS'u QRegu'nun kopyası olan bir “AI mevzuat takip platformu” olarak geliştirme.

Hedef ürün:

> Resmî kaynağı sürümlü alan, hükmün kuruma uygulanabilirliğini açıklayan, yükümlülüğü çalışan kontrole dönüştüren, connector/gözlemle testi yürüten, bulguyu retest ile kapatan ve sonucu bağımsız doğrulanabilir kanıt paketiyle sunan sürekli uyum işletim sistemi.

Zorunlu ana akış:

```text
Official source
→ versioned provision
→ verified obligation
→ applicability decision
→ control mapping
→ deterministic test
→ evidence envelope
→ finding/action
→ retest/verified closure
→ signed decision receipt
→ auditor Proof Room
```

AI önerir ve hızlandırır. Deterministik motor durum ve invariant uygular. Yetkili insan hukuk doğrulaması, istisna, risk kabulü ve nihai onay verir. Kriptografi sonucu doğrulanabilir yapar.

---

## 2. İlk tur — kod yazmadan repository keşfi

İlk turda yalnız inceleme yap ve raporla:

1. `git status`, branch, son commit ve dirty worktree;
2. gerçek stack, package manager, migration ve test komutları;
3. M12, M16, evidence, audit, RLS, cron ve UI durumunun koddan doğrulanması;
4. mevcut test tabanı; unit/integration/e2e ve skip sayısı;
5. gerçek `ROADMAP` ve ADR'lerle bu talimatın farkı;
6. yeniden kullanılacak tablo, service, route, component ve test fixture'ları;
7. her PR için migration/dosya/test bazlı uygulanabilir plan;
8. açık kurucu kararları ve ilerlemeyi gerçekten engelleyip engellemedikleri.

Eski ilerleme notunu gerçek kabul etme; testleri ve kodu doğrula. Kullanıcının ilgisiz değişikliklerini silme veya yeniden biçimlendirme.

İlk tur sonunda yalnız **PR-Q0 keşif/ADR planını** öner. Onay veya açık devam talimatı olmadan bütün 90 günü tek committe yapma.

---

## 3. Değişmez teknik ve hukuk kuralları

1. Tenant kimliği client girdisinden güvenilmez; server session ve RLS ile doğrulanır.
2. Her yeni tenant tablosunda RLS, cross-tenant negatif test ve yetki matrisi bulunur.
3. Service-role key browser bundle'a veya AI aracına verilmez.
4. AI hiçbir kaydı `VERIFIED`, `PASSED`, `MITIGATED`, `RESOLVED` veya `CLOSED` yapamaz.
5. Hukuk uzmanı onayı olmayan eşleme zorunlu kontrol çalıştıramaz.
6. `FAILED`, `UNKNOWN`, `STALE`, `NOT_APPLICABLE` ve `EXCEPTION` birleştirilmez.
7. Ticket kapanışı kontrol kapanışı değildir; retest zorunludur.
8. Resmî kaynak erişilemiyorsa sistem “güncel” veya “uyumlu” iddia edemez.
9. AI çıktısı kaynak pasajı, artifact hash'i, model/prompt sürümü, confidence ve reviewer kararını taşır.
10. Untrusted HTML/PDF/XML ve kanıt dosyaları prompt/tool instruction olarak çalıştırılamaz.
11. Belge, kişisel veri veya ticari sır public blockchain'e yazılmaz.
12. Public blockchain arızası çekirdek uyum akışını durduramaz.
13. Hostinger üzerinde kalıcı local filesystem'e güvenme; kanıt Supabase Storage/object storage'da tutulur.
14. DB zamanı, idempotency, transaction ve outbox mevcut proje disiplinine göre uygulanır.
15. Migration geriye dönük uyum, rollback notu, RLS ve fixture silme sırası içerir.

---

## 4. İlk 90 günlük PR sırası

### PR-Q0 — Baseline, rekabet ADR ve M16 kapısı

- M16'nın kalan gerçek işlerini doğrula ve üretim kapısını kapat.
- `ADR-competitive-positioning`: radar değil source-to-proof ürünü.
- `ADR-ai-decision-boundary`: AI/insan/deterministik motor ayrımı.
- `ADR-proof-receipt`: canonical data, JWS/KMS/TSA adapter sınırı.
- resmî kaynak erişim/lisans matrisi.
- 20–40 kontrol içeren ilk SPK/7545 pilot kapsamı.
- üç tasarım ortağı için ölçüm sözleşmesi taslağı.

**Çıkış:** Tüm mevcut testler yeşil, sıfır beklenmeyen skip; M16 açıkları ya kapanmış ya da kanıtlı blocker olarak yazılmış.

### PR-Q1 — M19/M20 dar kaynak ve temporal corpus dilimi

- source registry ve access policy;
- bir Türkiye resmî kaynağı için güvenli ingestion/import;
- immutable raw artifact ve SHA-256;
- canonical URI, yayın/yürürlük/retrieval zamanı;
- madde/fıkra fragment ve bitemporal sürüm;
- source staleness ve retrieval failure;
- admin kaynak sicili UI;
- parser ve malicious-file testleri.

**Yapma:** Bütün kaynakları scrape etme, lisanssız standart metni kopyalama, vector DB ekleme.

### PR-Q2 — M21/M22 verified obligation ve applicability

- obligation/provision ilişkisi;
- dört-göz `DRAFT → REVIEWED → VERIFIED` akışı;
- versioned kurum profili;
- `APPLICABLE / NOT_APPLICABLE / UNKNOWN / REVIEW_REQUIRED` sonucu;
- gerekçe, kullanılan girdiler, hüküm sürümü ve override geçmişi;
- onboarding applicability wizard;
- eksik bağlamda soru üretme;
- determinism ve order-independence testleri.

### PR-Q3 — M23 + mevcut M12 Control Compiler dikey akışı

- verified obligation → control objective → test definition mapping;
- legal-basis execution guard;
- mevcut M12 test motorunun yeniden kullanılması;
- 20–40 uzman doğrulamalı SPK/7545 kontrolü; `TODO-DOGRULA` doğrudan verified olamaz;
- failed test → finding/action → retest → independent closure;
- her çalışmada execution legal snapshot.

Yeni test motoru yazma. M12 sonucu ve M16 SoD invariant'larını bypass etme.

### PR-Q4 — M24 Proof Vault, Decision Receipt ve Proof Room

- deterministic canonical decision data;
- evidence envelope ve audit manifest bağlantısı;
- AI + insan + hukuk + test lineage'ı;
- JWS provider interface; gerçek KMS/HSM kararı yoksa güvenli dev/test signer;
- RFC 3161 provider interface; gerçek TSA kararı yoksa mock yalnız testte;
- standalone verifier CLI veya web sayfası;
- denetçi için süreli, salt-okunur Proof Room;
- KALKAN_OS servisi kapalıyken fixture receipt doğrulama testi.

PDF'nin kendi hash'ini içine alma döngüsü kurma. İmza deterministik rapor verisi/manifest üzerindedir; PDF yalnız taşıyıcıdır.

### PR-Q5 — Continuous Control connector dikeyleri

Önce müşteri görüşmesiyle en değerli üç read-only yolu seç. Adaylar:

- Entra ID / Microsoft 365;
- AWS/Azure/GCP;
- GitHub/GitLab;
- SIEM/EDR;
- ERP veya banka erişim review CSV/API;
- backup/log sistemi.

Gereksinimler:

- least privilege ve read-only credential;
- encrypted secret storage;
- isolated runner/edge function sınırı;
- egress allowlist, timeout, retry ve rate limit;
- connector health ve staleness;
- `connector failed = UNKNOWN`, asla `PASSED` değil;
- contract test ve cross-tenant test;
- hazır veri yolunda time-to-first-evidence ölçümü.

### PR-Q6 — Kaynaklı AI ajanları ve RegBench-TR

Provider-neutral AI Gateway kur. İlk ajanlar:

1. regulation diff agent;
2. obligation extraction agent;
3. applicability question agent;
4. control mapping agent;
5. evidence challenge agent;
6. remediation draft agent;
7. audit package assistant.

Her ajan:

- dar JSON schema;
- izinli kaynak/tool listesi;
- tenant-scoped retrieval;
- citation/passage desteği;
- confidence ve abstain/review davranışı;
- token/maliyet/latency telemetrisi;
- prompt injection, data exfiltration ve cross-tenant testleri;
- insan kabul/red/düzeltme iş akışı;
- AI Decision Receipt üretmelidir.

RegBench-TR en az 50–100 uzman doğrulamalı vaka ile başlasın. Model veya prompt değişikliği gold-set regression gate olmadan production'a çıkmasın. AI özelliğini yalnız “çıktı güzel görünüyor” ile kabul etme.

### PR-Q7 — Ürünleştirme, Proof Room ve pilot kapısı

- Regulated SPK/7545 hazır paketi;
- CFO Kalkanı Lite paketi: SoD, ödeme/IBAN, ERP/banka erişimi, BEC/deepfake;
- role-based dashboard ve legal-basis etiketi;
- dark/light ve responsive Regulatory Observatory UI;
- activation/time-to-value event'leri;
- 3 tasarım ortağı pilot ölçümü;
- kaynak değişikliği → onaylı etki <24 saat hedefi;
- kurum profili → ilk applicability <60 dakika hedefi;
- hazır connector/import → ilk kanıt <1 iş günü hedefi;
- audit package <1 saat hedefi;
- win/loss nedeni: QRegu, Regvion, Excel/iç geliştirme ve danışmanlık.

---

## 5. Supabase ve Hostinger uygulama sınırı

### Supabase

- PostgreSQL ana doğruluk kaynağıdır.
- Auth + RLS birlikte uygulanır; UI gizlemek yetki kontrolü değildir.
- Storage bucket private; signed URL kısa ömürlü ve tenant doğrulamalı.
- `pg_cron` yalnız idempotent, gözlemlenebilir DB işleri için kullanılır.
- Edge Functions kısa ve güvenli connector/webhook işleri içindir; ağır parser/AI işini limitsiz çalıştırma.
- Her privileged function `search_path`, caller ve tenant kontrolü taşır.

### Hostinger

- Mevcut desteklenen Node/Docker dağıtım modelini koru.
- Build artifact immutable ve environment ayrımı açık olsun.
- Server-only secret'lar browser'a sızmasın.
- Health/readiness endpoint, structured log ve deploy rollback dokümante edilsin.
- Cron'u iki yerde aynı işi çalıştıracak biçimde çoğaltma.

---

## 6. UI kabul kapsamı

Yeni çekirdek ekranlar:

1. **Regulatory Radar:** değişiklik, tarih, kaynak seviyesi, etki durumu;
2. **Applicability Wizard:** profil girdisi, gerekçe, belirsizlik, onay;
3. **Control Lineage:** hükümden test/kanıt/bulgu/retest'e tek zaman çizgisi;
4. **Proof Room:** denetçi için artifact, receipt, inclusion/verification sonucu;
5. **AI Review Queue:** öneri, kaynak pasajı, confidence, kabul/red/düzelt;
6. **Connector Health:** son başarılı çalışma, stale/unknown ve credential durumu;
7. **Executive Overview:** ayrı lenslerle kapsam, kontrol, kanıt, bulgu ve risk.

Tek bir yanıltıcı “%100 uyum” skoru gösterme. Hukuki zorunluluk, sözleşme şartı, kurum politikası ve best practice ayrı etiketlenir. Light/dark, mobil/masaüstü, klavye, focus, contrast ve loading/empty/error/stale durumları test edilir.

---

## 7. Blockchain ve ileri Ar-Ge sınırı

İlk 90 günde:

- kendi blockchain'i, token, coin, NFT veya cüzdan yapma;
- belge veya müşteri verisini public chain'e yazma;
- ZKP'yi üretim bağımlılığı yapma;
- blockchain seçimini kurucu adına uydurma.

Önce canonical statement + append-only log + JWS + RFC 3161 adapter + bağımsız verifier tamamlanır. Public chain pilotu daha sonra yalnız günlük Merkle root için, chain-agnostic adapter ile ve core sistemden bağımsız yapılabilir.

---

## 8. Test ve done kapısı

Her PR için:

- unit test;
- DB/integration ve migration testi;
- RLS/IDOR/cross-tenant negatif test;
- authorization ve state-transition testi;
- deterministic fingerprint/idempotency testi;
- gerçek Chromium e2e;
- light/dark ve mobil/masaüstü doğrulama;
- production build;
- Supabase/Hostinger staging smoke;
- ROADMAP/ADR güncellemesi;
- sıfır beklenmeyen skip.

Ana e2e:

```text
official artifact ingest
→ provision review
→ obligation verification by independent reviewer
→ organization applicability
→ control/test mapping
→ observation/connector run
→ FAILED result
→ finding/action
→ remediation and retest
→ independent verified closure
→ signed receipt
→ external Proof Room verification
```

Bu akış gerçek Chromium'da ve iki farklı yetkili kullanıcıyla tamamlanmadan “rekabet dikeyi bitti” deme.

---

## 9. Kurucu adına verilmeyecek kararlar

Kararları adapter/interface ile açık bırak; uydurma:

1. üretim AI modeli/sağlayıcısı ve veri bölgesi;
2. müşteri verisinin dış AI'a gönderim politikası;
3. hukuk doğrulayıcı kişi/kurum ve sorumluluk sigortası;
4. JWS/COSE üretim anahtarı ve KMS/HSM;
5. Türkiye ESHS/RFC 3161 TSA;
6. public/permissioned blockchain ve anchor sıklığı;
7. ilk üç üretim connector'ı;
8. ücretli mevzuat/standart lisansları;
9. gerçek regülatör gönderim entegrasyonu;
10. paket fiyatı, billing provider ve trial.

Karar ilerlemeyi engellemiyorsa `OPEN_DECISION`, güvenli interface ve test double ile devam et. Gerçek para, gerçek dış gönderim, üretim anahtarı veya müşteri credential'ı için açık onay olmadan işlem yapma.

---

## 10. Claude Code ilerleme raporu

Her PR sonunda yalnız şu formatta raporla:

```text
TESLİM EDİLEN
- özellik/migration/UI

DOĞRULAMA
- unit/integration/e2e/build/staging sayıları ve sonuçları

GÜVENLİK VE HUKUK
- RLS, yetki, kaynak, AI ve kanıt kapıları

MİMARİ SAPMA
- talimattan sapma, gerekçe ve ADR

AÇIK KARAR/BLOCKER
- kurucu kararı gerçekten gerekiyor mu?

SONRAKİ TEK PR
- kapsam ve kabul kriteri
```

Test sayısını “yeşil görünüyor” diye özetleme; çalışan/skip/başarısız sayısını açık yaz. Dev server port çakışmasını ürün hatasıyla karıştırma.

---

## 11. Claude Code'a yapıştırılacak kısa başlangıç komutu

```text
Repository kökündeki CLAUDE_CODE_KALKAN_OS_QREGU_REKABET_SPRINTI_TALIMATI.md dosyasını, işaret ettiği V2 ve MASTER talimatlarla birlikte oku. İlk turda kod yazma. Repository/git/test/M12/M16/RLS/Hostinger/Supabase durumunu gerçek kod ve testlerle doğrula; talimattaki varsayımları körü körüne kabul etme. Sonra yalnız PR-Q0 için dosya, migration, test, risk ve açık kurucu kararı bazlı uygulanabilir plan çıkar. Mevcut kullanıcı değişikliklerini koru. İlk raporu belgedeki zorunlu formatta ver.
```
