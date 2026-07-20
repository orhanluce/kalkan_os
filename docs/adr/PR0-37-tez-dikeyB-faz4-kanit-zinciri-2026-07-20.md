# PR-0 — 37 Tez Dikey B, Faz 4: DORA RoI Export Alanları için Kanıt Zinciri (20 Temmuz 2026)

**Talimat:** kurucunun 20 Temmuz yedinci talimatı. Amaç: yayınlanmış her RoI
export alanı kaynağına ve kanıtına kadar izlenebilir olmalı; hiçbir alan
için hukuki/güvenlik kesinliği uydurulmamalı. Yeni paralel kaynak/claim
modeli KURULMAYACAK.

## 0. Önce mevcut yapı — TAM grep sweep (talimatın kendi kural 1'i)

Okunanlar (yalnız İLK değil, o yapıya dokunan TÜM migration'lar):
`assurance_claims` (20260720000000/000001/110000), `roi_kaynak_kayitlari`
(20260719310000/20260720000000/000001/100000/110000), `obligations` guard
zinciri (20260718160000→210000→720000000000→720000110000), `ledger_outbox`
+ `artifact_ledger_durumu` (20260719120000, GENİŞLEMESİ 20260719170000 —
AFTER UPDATE WHEN deseni burada bulundu ve §3'te BİREBİR kopyalandı),
`proof_room_goruntule` (20260718220000→719120000→720150000→720160000 —
dünkü dersin kendisi, bu turda BİR KEZ DAHA dikkatle uygulanacak),
`src/lib/claim-guard.ts` (`iddiaGosterimDurumuHesapla` — REUSE edilecek,
ikinci bir "gösterim durumu" motoru İCAT EDİLMEYECEK), `src/lib/ledger-
outbox.ts` (manifest dispatch deseni, `board-declaration-ledger.ts`
şablon olarak kullanıldı).

## 1. Mimari karar: provenance TÜRETİLMİŞ ve MÜHÜRLENMİŞ bir GÖRÜNÜMDÜR

**Yeni bir ilişkisel model YOK.** `on_kontrol_raporu`'nun (Faz 3) AYNI
deseni: export ÜRETİLİRKEN, saf bir fonksiyon mevcut 5+1 yapıdan (kimlik/
ICT hizmet türü/third_parties/fourth_parties/critical_business_services +
ŞİMDİ `roi_kaynak_kayitlari` + `assurance_claims`) bir provenance raporu
HESAPLAR, INSERT anında `roi_export_runs.provenance_raporu` (jsonb) +
`provenance_hash` (RFC 8785, `paket_hash`'ten AYRI — kural 15) olarak
MÜHÜRLENİR. Guard bunu `paket`/`paket_hash`/`on_kontrol_raporu` ile AYNI
şekilde donuk tutar.

## 2. Alan bazlı provenance — SAF FONKSİYON (`src/lib/roi-export-provenance.ts`)

Her satır (B_01.01 kimlik, B_02.02 sözleşme, B_06.01 kritik fonksiyon) için:
- **`kaynakDurumu`**: o satırın dayandığı `roi_kaynak_kayitlari` (şablon
  bazlı) + `ict_service_types` (hizmet türü bazlı) kayıtlarının EN KÖTÜSÜ
  (worst-of, `legal-basis.ts`/`on-kontrol`'ün AYNI ilkesi) — hiçbiri yoksa
  `KAYNAK_YOK`.
- **`iliskiliIddialar`**: `assurance_claims` tablosunda `hedef_tablo`/
  `hedef_id` bu satırın dayandığı gerçek DB kaydına (third_party_contracts/
  critical_business_services id'si) eşleşen satırlar — HER BİRİNİN gösterim
  durumu `claim-guard.ts`'in `iddiaGosterimDurumuHesapla`'sıYLA hesaplanır
  (İKİNCİ bir motor İCAT EDİLMEDİ).
- **`genelDurum`**: `kaynakDurumu` ve TÜM `iliskiliIddialar`'ın gösterim
  durumlarının EN KÖTÜSÜ — `VERIFIED` yalnız HEPSİ VERIFIED'sa mümkündür.

**Kural 3/6'nın doğrudan uygulaması:** kanıtı olmayan alan (`iliskiliIddialar
= []` VE `kaynakDurumu != VERIFIED`) asla `VERIFIED` sayılmaz;
`TODO_DOGRULA`/`LEGAL_REVIEW` durumundaki kaynak kesin ifade üretmez —
`genelDurum` bunu YAPISAL OLARAK garanti eder (worst-of mantığı, kaçış yolu
yok).

## 3. SCITT/şeffaflık defteri — mevcut mekanizma GENİŞLETİLDİ, yeni desen YOK

`roi_export_runs` durumu `YAYINLANDI`'ya geçince (`AFTER UPDATE ... WHEN
(new.durum = 'YAYINLANDI' and old.durum is distinct from 'YAYINLANDI')`,
**`20260719170000`'in BİREBİR deseni**) `ledger_outbox_enqueue_trg
('ROI_EXPORT_PUBLISHED')` çağrılır. `src/lib/roi-export-ledger.ts`
(`board-declaration-ledger.ts` şablonu) manifest kurar: `{schema, exportId,
tenantId, paketHash, provenanceHash, yayinlanmaZamani}` — HAM İÇERİK
DEFTERE GİRMEZ, yalnız iki hash + kimlik. `ledger-outbox.ts`'in dispatch
tablosuna kayıt eklendi. Karar rotası (`/api/dora-roi/export/[id]/karar`)
YAYINLANDI sonrası `ledgerOutboxDrain` çağırır (`kontrol-test/[id]/calistir`
rotasının AYNI deseni).

**"SCITT başarısızsa sahte ANCHORED gösterilemez"**: `ledgerDurumu`
HİÇBİR YERDE STORED bir alan DEĞİL — `artifact_ledger_durumu('roi_export_
runs', id)` ile HER SORGUDA CANLI hesaplanır (test_runs'ın AYNI ilkesi).
Proof Room roi_export dalı bunu artık `kosu` dalıyla AYNI şekilde taşır.

## 4. Yeniden inceleme — `assurance_claims`'in AYNI deseni

`yeniden_inceleme_gerekli`/`yeniden_inceleme_nedeni` eklendi (assurance_
claims'teki İKİ alanın BİREBİR aynısı). Yeni idempotent pg_cron
`roi_export_runs_yeniden_inceleme_isle()`: YAYINLANDI export'lar için,
`provenance_raporu`'nda MÜHÜRLENEN durum ile kaynağın/iddianın GÜNCEL
durumunu karşılaştırır; herhangi biri düşmüşse (VERIFIED→SUPERSEDED/
REJECTED, ya da yeni bir `yeniden_inceleme_gerekli=true` iddia) işaretler —
**durum GERİYE DÖNÜK DEĞİŞTİRİLMEZ** (assurance_claims'in AYNI ilkesi: DB
guard geçmiş kararı silmez, yalnız işaretler).

## 5. Proof Room minimizasyonu (kural: ham hassas veri taşınmaz)

`proof_room_goruntule`'un roi_export dalı BUGÜNE KADAR TÜM `paket`+`on_
kontrol_raporu`'nu döndürüyordu (Faz 3) — bu KABUL EDİLEBİLİR çünkü `paket`
zaten yalnız RoI şablon ALANLARINI taşıyor (ham kanıt/claim METNİ değil).
**Provenance için YENİ bir minimizasyon kuralı eklendi:** RPC yalnız
`{alanKodu, kaynakDurumu, genelDurum, iddiaSayisi}` döner — `iddia_metni`,
`guven_gerekcesi`, `kanit_referanslari`'nin HAM İÇERİĞİ ASLA dönmez (yalnız
sayı + durum). Denetçi "bu alan hangi mevzuat ve kanıta dayanıyor" sorusuna
DURUM ile cevap alır, tenant'ın iç gerekçe metnine erişmez.

## 6. Kapsam dışı (talimatın kendi listesi + bu ADR'nin eklediği)

Yeni LLM sağlayıcısı, otomatik hukuki yorum, kaynaksız seed, ZKP,
doğrulanmamış DORA alanlarını VERIFIED yapmak. Ayrıca: `obligations`/
`provisions`/`regulatory_sources` zincirinin RoI export'a DOĞRUDAN
bağlanması (yalnız `assurance_claims.kaynak_obligation_id` ÜZERİNDEN
DOLAYLI bağ — bu ADR'nin kapsamı `roi_kaynak_kayitlari` + `assurance_
claims` + `ict_service_types` üçlüsü; `obligations` zaten `assurance_
claims` üzerinden zincire dahil, tekrar ayrı bir bağ KURULMADI).
