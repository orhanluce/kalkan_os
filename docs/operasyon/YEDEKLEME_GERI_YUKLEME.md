# Yedekleme ve Geri Yükleme (M16 üretim kapanışı)

**Tarih:** 18 Temmuz 2026 · **Proje:** Supabase `jgunbctnoprklseusaee`
(Session Pooler; direct connection IPv6-only).

## 1. Neyin yedeği var

| Katman | Yedek mekanizması | Durum |
|---|---|---|
| Postgres verisi | Supabase otomatik günlük yedek (plan dahilinde) | Platformca sağlanıyor; **restore hiç prova edilmedi** (aşağıda) |
| Şema (migration'lar) | `supabase/migrations/*.sql` git'te (kaynak-kod = şema kaynağı) | ✅ tam; PGlite + canlı ile doğrulanıyor |
| Kanıt dosyaları | private `evidence` bucket (içerik-adresli `{tenant}/{sha256}`) | Supabase Storage yedeği; içerik-adresli olduğu için hash'ten yeniden doğrulanabilir |
| Denetim bütünlüğü | audit_log hash zinciri + immutable manifest'ler | Restore sonrası zincir bağımsız doğrulanabilir (verify-paket CLI) |

## 2. Geri yükleme prosedürü (yazılı — prova K1'e bağlı)

### 2.1 Şemayı boş bir projeye kur (her zaman mümkün, provalı yol)
```
# Yeni Supabase projesi aç → .env.local'i o projeye yönelt →
pnpm db:push        # tüm migration'lar sırayla
pnpm db:verify      # çekirdek tabloların fiilen var olduğunu doğrula
pnpm db:types       # tipleri yeni projeye göre üret
```
Bu yol PGlite testleriyle her gün fiilen doğrulanıyor (migration seti temiz
uygulanıyor). **Şema kurtarma provalı.**

### 2.2 Veri geri yükleme (Supabase snapshot'tan)
1. Supabase Dashboard → Database → Backups → hedef günü seç.
2. **Point-in-time / snapshot restore** yeni bir projeye (üretimin ÜZERİNE
   restore ETME — önce yeni projeye al, doğrula, sonra DNS/env değiştir).
3. Restore sonrası MUTLAKA:
   - `pnpm db:verify` (tablolar var mı),
   - audit_log hash zinciri doğrulaması (`verify_audit_chain` RPC),
   - bir SoD import manifesti için `manifestHash` yeniden hesabı,
   - bir kanıt dosyası için `sha256` yeniden doğrulaması (içerik-adresli).

### 2.3 Kanıt dosyası kurtarma
Storage içerik-adresli olduğu için bir nesnenin bütünlüğü adından
(`{tenant}/{sha256}`) doğrulanır: indir → SHA-256 hesapla → yol ile karşılaştır.
Uyuşmazlık = bozulma sinyali.

## 3. PROVA DURUMU — dürüst

- **Şema restore: PROVALI** (PGlite + boş-projeye db:push her gün koşuyor).
- **Veri snapshot restore: PROVA EDİLMEDİ.** Supabase yedekleri var ama gerçek
  bir restore→doğrula turu yapılmadı. Tam prova ayrı bir Supabase projesi
  (maliyet) ister → **kurucu kararı K1 (staging)**. K1 "evet" olunca prova bu
  belgeye tarih+sonuçla işlenir; o zamana kadar bu bir YAZILI PROSEDÜR ama
  DOĞRULANMAMIŞ restore'dur (üretim kapısında bu satır açıkça borç sayılır).

## 4. RPO/RTO (hedef, ölçülmedi)
- RPO: Supabase günlük yedek → en kötü ~24 saat veri kaybı (PITR planı varsa
  daha düşük — plan doğrulanmalı).
- RTO: şema ~dakikalar (db:push), veri restore Supabase snapshot süresine bağlı
  (ölçülmedi). K1 provasında ölçülüp buraya yazılacak.
