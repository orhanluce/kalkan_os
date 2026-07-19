# PR-0 — 37 Tez Dikey C: Model/Compliance Claim Guard — Keşif + Veri Sözleşmesi (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz talimatı. Amaç: "KALKAN_OS'un AI veya kural
motoru tarafından üretilen hiçbir uyum, risk, kontrol veya mevzuat iddiası;
doğrulanmış kaynak, kapsam, tarih, güven seviyesi ve kanıt bağlantısı
olmadan kesin hüküm olarak gösterilmemeli."

## 0. Önce mevcut yapılar (talimat kural 1 — yeni mekanizma icat etme)

Repo zaten DÖRT ayrı ama BİRBİRİNE BENZER "iddia güvencesi" mekanizması
taşıyor. Bu ADR beşinci bir tane İCAT ETMİYOR — dördünü de İNCELEYİP en
uygun ikisini (dört-göz durum makinesi + dayanak-değerlendirme motoru
mimarisi) YENİDEN KULLANIYOR:

1. **`obligations.dogrulama_durumu`** (20260718160000, **20260718210000'de
   M21'in gerçek dört-göz şartına yükseltildi**) — altı durumlu dört-göz:
   `DRAFT_RESEARCH → TODO_DOGRULA → LEGAL_REVIEW → VERIFIED` (+
   `SUPERSEDED`/`REJECTED`), ayrıca `incelemeye_alan`/`incelemeye_alinma_
   zamani` — LEGAL_REVIEW'e geçiş bunu ister, VERIFIED'de `dogrulayan ≠
   incelemeye_alan` ZORUNLU (inceleyen kendi sunumunu doğrulayamaz — "tek
   kişi mapping hazırlayıp onaylayamaz", M21). **Bu ADR'nin dört-göz iskeleti
   BUDUR** — GERÇEK (iki-kişili) sürüm kopyalanıyor. **CANLI GELİŞTİRME
   NOTU (dürüstçe):** bu dilimin İLK taslağı yanlışlıkla `obligations`'ın
   20260718160000'deki ESKİ (tek-kişili, incelemeye_alan'sız) sürümünü
   kopyalamıştı — kendi PGlite testleri bunu YAKALADI (bkz. rls-assurance-
   claims.test.ts). Düzeltilirken `roi_kaynak_kayitlari`'nın (dün şiplenen
   §1.58) da AYNI eski deseni kopyaladığı fark edildi — forward-fix
   migration `20260720000001` ile o da düzeltildi.
2. **`applicability_decisions`** — `UNKNOWN ≠ NOT_APPLICABLE` invariant'ı,
   fact-fingerprint bayatlık kontrolü. Talimatın kural 9'u ("geçerlilik
   tarihi dolan kaynaklar yeniden inceleme kuyruğuna") bu tablonun "bayat
   karar" kavramının AYNISI — burada da kopyalanıyor.
3. **`src/lib/legal-basis.ts`** (M23) — bir kontrol testi ÇALIŞTIRILMADAN
   ÖNCE dayanak zincirini (hüküm→yükümlülük→eşleme→uygulanabilirlik)
   değerlendirip `ALLOW/ALLOW_WITH_WARNING/BLOCK` üreten SAF, deterministik
   motor. **Bu ADR'nin pure-engine MİMARİSİ BUDUR** — `sebepler[]` (kod/
   seviye/mesaj), `asOf` parametresi, `Date.now()` yok, kimliğe göre
   deterministik sıralama. Aynı mimari `claim-guard.ts`'e taşınıyor, ama
   soru "bu testi çalıştırayım mı" değil "bu iddiayı KESİN diye gösterebilir
   miyim" oluyor.
4. **`execution_legal_snapshots`** (V2 PR-4b adım 4) — bir kararın VERİLDİĞİ
   ANDAKİ dayanak durumunu DONDURAN, service_role dahil UPDATE/DELETE'e
   kapalı fotoğraf. `assurance_claims.kaynak_durumu_anlik` bu deseni
   TAKLİT EDİYOR (ayrı tablo değil, tek kolon — kapsam daha dar).

**Sonuç: bu turda yeni bir "dört-göz" ya da yeni bir "dayanak motoru"
İCAT EDİLMEDİ.** `assurance_claims` var olan ikisinin BİRLEŞİMİDİR: dört-göz
durum makinesi (obligations'tan) + saf değerlendirme motoru mimarisi
(legal-basis'ten), yeni bir hedef soruya (iddia gösterilebilir mi?)
uygulandı.

## 1. Veri sözleşmesi — `assurance_claims`

| Alan | Talimatın istediği karşılık | Kaynak/gerekçe |
|---|---|---|
| `iddia_turu` | (UYUM/RİSK/KONTROL/MEVZUAT ayrımı) | Kural: "uyum, risk, kontrol veya mevzuat iddiası" — kapalı küme. |
| `hedef_tablo`/`hedef_id` | (iddianın NE hakkında olduğu) | Polimorfik referans (FK yok — hedef `controls`/`third_parties`/`findings`/vb. olabilir); citation-bundle'ın "kaynak" referans desenine benzer, zorunlu değil. |
| `iddia_metni` | — | İddianın kendisi, serbest metin (uydurulmaz, insan/AI girer). |
| `kapsam` | scope | Serbest metin — iddianın sınırını açıkça yazar (kural 6: "koşullu gösterilmeli"). |
| `yargi_alani` | jurisdiction | Serbest metin (TR/EU/vb.) — `regulatory_sources.jurisdiction` İLE AYNI SÖZLÜK değil ama aynı fikir; claim kendi beyanını taşır (kaynak varsa onunla tutarlı olması insan/hukuk incelemesinde kontrol edilir, DB seviyesinde eşitlik ZORLANMAZ — aşırı katı bir kısıt yanlış pozitif üretirdi). |
| `yururluk_tarihi` | effective_date | İddianın geçerli olduğu tarih. |
| `guven_seviyesi` + `guven_gerekcesi` | confidence | **SAYISAL DEĞİL** (talimat kapsam dışı: "yapay kesinlik puanı üretmek") — kapalı küme DÜŞÜK/ORTA/YÜKSEK + zorunlu gerekçe metni (kural 11 "gerekçesiz puan yok" ruhu, `iyilestirmeOnceliğiSirala`'nın aynı ilkesi). |
| `kaynak_obligation_id` + `kaynak_durumu_anlik` | source_id + source_status | Var olan `obligations` tablosuna FK; `kaynak_durumu_anlik` o obligation'ın DEĞERLENDİRME ANINDAKİ durumunun donmuş fotoğrafı (execution_legal_snapshots deseni). |
| `kanit_referanslari` | evidence_refs | jsonb dizi — `{tablo, id}` referansları (evidences/audit_log/findings/citation-bundle'a); HAM İÇERİK YOK (kural 22). |
| `dogrulama_durumu`/`dogrulayan`/`dogrulama_zamani` | reviewer + VERIFIED geçişi | `obligations` dört-göz VOKABÜLERİ birebir. |
| `olusturan_tur`/`olusturan` | (AI karar sınırı) | Kural 11 "AI karar sınırı": iddia `ai_taslak`/`kural_motoru`'dan doğabilir ama VERIFIED'e AI/servis GEÇEMEZ — guard kimlik atfı ister (aşağıda). |
| `yeniden_inceleme_gerekli`/`yeniden_inceleme_nedeni` | (kural 9: süre/yürürlük kuyruğu) | Cron tarafından set edilir, insan tarafından temizlenir. |

## 2. Guard'lar (talimatın kuralları 3-6'ya karşılık)

1. **Dört-göz** (obligations deseni, birebir): INSERT'te VERIFIED doğamaz;
   VERIFIED'e geçiş yalnız LEGAL_REVIEW'den + atıfla; VERIFIED içerik donuk.
2. **YENİ — kaynak zorunluluğu (kural 3/4):** VERIFIED'e geçiş için
   `kaynak_obligation_id` dolu OLMALI VE o obligation'ın O ANKİ
   `dogrulama_durumu` = `VERIFIED` OLMALI. Kaynağı olmayan ya da kaynağı
   henüz doğrulanmamış (`TODO_DOGRULA`/`DRAFT_RESEARCH`/`LEGAL_REVIEW`/
   `UNKNOWN` muadili) bir iddia asla VERIFIED olamaz — en fazla
   `LEGAL_REVIEW`'de bekler.
3. **YENİ — kanıt zorunluluğu (kural 6):** VERIFIED'e geçiş için
   `kanit_referanslari` BOŞ OLAMAZ.
4. **Kimlik atfı (kural 11 AI sınırı):** `dogrulayan` her zaman oturum
   sahibine sabit (service/cron muaf) — bir AI/servis kendi ürettiği
   iddiayı kendi VERIFIED edemez.
5. **Süre-dolumu kuyruğu (kural 9):** idempotent pg_cron — `yururluk_tarihi`
   geçmiş VEYA kaynağın güncel durumu `SUPERSEDED`/`REJECTED`'e düşmüş
   iddiaları `yeniden_inceleme_gerekli = true` yapar (durum DEĞİŞTİRİLMEZ —
   yalnız işaretlenir, insan kararını GASP ETMEZ).

## 3. Çatışma görünürlüğü (kural 8) — SAF FONKSİYON, DB guard DEĞİL

Aynı `(hedef_tablo, hedef_id, iddia_turu)` üçlüsü için birden fazla,
BİRBİRİYLE ÇELİŞEN (farklı sonuç ifade eden) iddia varsa sistem sessizce
birini seçmemeli. Bu bir INSERT-anı kısıtı değil, bir SORGU-anı
değerlendirmesidir (kural 11: saf, deterministik, test edilebilir) —
`src/lib/claim-guard.ts`'teki `catismaTespitEt` fonksiyonu. UI/route
seviyesinde çatışan iddialar AÇIKÇA "ÇATIŞMA" olarak gösterilir, otomatik
uzlaştırma YAPILMAZ (bu bir insan kararıdır).

## 4. Kapsam dışı (talimatın kendi listesi + bu ADR'nin eklediği)

- Hukuki içerik seed etmek — bu turda hiçbir claim/obligation VERİSİ
  eklenmedi, yalnız mekanizma.
- Doğrulanmamış DORA alanlarını (Dikey B) VERIFIED yapmak — o ayrı iş,
  buradan etkilenmedi.
- Yapay kesinlik puanı — `guven_seviyesi` kasıtlı olarak 3 kademeli kapalı
  küme, sayısal DEĞİL.
- LLM sağlayıcı seçimi — bu dikey `olusturan_tur='ai_taslak'` alanını
  TAŞIR ama hangi LLM/servisin bunu üreteceğine dair HİÇBİR entegrasyon
  KURMAZ — kural 4 (var olmayan altyapı icat edilmez) + açık kurucu kararı
  gerektirir.
- Otomatik çatışma çözümü — yalnız GÖRÜNÜRLÜK, karar insanda kalır.
- Var olan `obligations`/`applicability_decisions`/`legal-basis` akışlarının
  YENİDEN YAZILMASI — hepsi AYNEN kalıyor, `assurance_claims` bunların
  YANINA (üstüne bir izleme katmanı olarak) ekleniyor.

## 5. Açık kurucu kararı

- `guven_seviyesi`nin üç kademesinin (DÜŞÜK/ORTA/YÜKSEK) tam tanımı —
  hangi somut kriterlerin hangi kademeye karşılık geldiği — bugün serbest
  `guven_gerekcesi` metnine bırakıldı; ileride yapılandırılmış bir rubrik
  istenirse ayrı bir dilim.
- `yargi_alani` alanının `regulatory_sources.jurisdiction` ile tutarlılığını
  DB seviyesinde zorlayıp zorlamama (bugün ZORLANMIYOR) kurucu kararı.
