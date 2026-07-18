# Deploy ve Rollback Prosedürü (M16 üretim kapanışı)

**Deploy modeli:** Hostinger Business, Node.js otomatik dağıtım — GitHub
`orhanluce/kalkan_os` `main` push'unda otomatik `pnpm run build` + restart
(Node 22.x). Geçici alan: `blue-yak-865668.hostingersite.com`.

## 1. Normal deploy
1. `pnpm check` + ilgili `pnpm e2e` yeşil (yerelde).
2. Şema değiştiyse: `pnpm db:push` → `pnpm db:types` → canlı smoke.
3. `git push origin main` → Hostinger otomatik build (~2-3 dk).
4. **Doğrula:** `/health/live` 200, `/health/ready` `hazir/erisilebilir`,
   `/` → 307 `/giris`. Build ID/chunk değişimi Turbopack'te güvenilir sinyal
   değil — kesin doğrulama gerçek giriş + kritik ekran render'ıdır.

## 2. Kod rollback (şema değişmeden)
En güvenli yol — **ileri commit** (git revert), geçmişi silme:
```
git revert <bozuk_commit_sha>     # ters commit üretir
git push origin main              # Hostinger yeni (düzeltilmiş) build alır
```
`git reset --hard` + force push KULLANMA (paylaşımlı geçmiş; Hostinger'ın
çektiği ref'i bozar). Doğrulama §1.4 ile aynı.

## 3. Migration geri alma (şema değiştiyse)
**İlke: expand/contract — migration'lar ileri-uyumlu yazılır, böylece kod
rollback'i şema rollback'i GEREKTİRMEZ.** Bugüne dek eklenen migration'lar
yalnız `add column` (nullable) / yeni tablo / yeni guard — eski kod bunlarla
çalışmaya devam eder. Yani:
- Kod rollback'i tek başına yeterli (yeni kolon/tablo eski kodca yok sayılır).
- Bir migration GERÇEKTEN geri alınacaksa: **ters migration YAZ** (yeni dosya),
  `drop` işlemini bilinçli ve veri-kaybı etkisi ölçülerek. Uygulanmış bir
  migration dosyası SİLİNMEZ (kayıt tablosu bozulur).
- Guard/trigger geri alma: `create or replace` ile önceki sürüme dön (yeni
  migration).

## 4. Acil durum sırası
1. `/health/ready` 503 veya kritik hata → önce son commit'i `git revert`.
2. Şema kaynaklıysa (yeni guard yanlış reddediyor) → guard'ı `create or
   replace` ile gevşeten yeni migration + push.
3. Veri bozulması → `YEDEKLEME_GERI_YUKLEME.md` §2 (yeni projeye restore,
   üretimin üzerine değil).

## 5. Bilinen sınır
- Otomatik health-gate'li deploy yok: push doğrudan canlıya gider, health
  MANUEL doğrulanır (§1.4). Staging (K1) gelirse önce staging'e push + health
  + e2e, sonra üretim.
- Rollback provası: kod revert yolu bu oturumda fiilen kullanıldı değil ama
  standart git akışı; ilk gerçek revert bu belgeye tarihlenir.
