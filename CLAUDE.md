# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Şu an **yerel geliştirme** aşamasındayız: canlı Supabase projesi yok, deploy yok.
Kod ve migration'lar hazırlanıyor; gerçek Supabase/Node prod bağlantısı kurucu
onayıyla ayrı bir adımda yapılacak.

**RLS artık gerçekten test edilebilir** (kural 1 için mazeret yok): PGlite
(Postgres'in WASM derlemesi, kurulum gerektirmez) ile gerçek migration
dosyalarına karşı Vitest'te koşuyoruz — bkz. `src/lib/__tests__/helpers/pg.ts`
ve `rls-*.test.ts`. Yeni bir tablo/politika eklerken RLS testi de yaz.
Bu aynı zamanda kural 4'ü fiilen kanıtlar: şema düz Postgres'te koşuyor.

Hâlâ **doğrulanamayan** ve "yazıldı ama doğrulanmadı" diye işaretlenmesi
gerekenler: Supabase Auth'un kendisi (auth.uid()/auth.users testlerde
stub'lanır), Storage'a gerçek dosya yükleme, ve deploy. Bunlar için
"çalışıyor" deme.

## Değişmez kurallar
1. Her tabloda tenant_id + RLS; RLS'i test etmeden hiçbir tablo "bitti" sayılmaz.
2. evidences ve audit_log append-only: UPDATE/DELETE yolu açma.
3. Mevzuat içeriği (controls tablosu) ASLA üretilmez/uydurulmaz — yalnızca data/controls/*.yaml
   dosyalarından seed edilir; belirsiz madde referansı TODO-DOGRULA etiketiyle işaretlenir.
4. Supabase'e taşınamaz bağımlılık ekleme (saf Postgres kal); yurt içi barındırmaya taşınabilirlik
   mimari gerekliliktir (VII-128.10 md.26).
5. Kilometre taşı kapıları sıralı: docs/ROADMAP.md'deki kabul kriterleri geçilmeden sonraki taşa geçme.
6. Türkçe UI, İngilizce kod/commit. Para/tarih formatları tr-TR.
7. Gizli anahtarlar yalnızca .env; loglara PII/kanıt içeriği yazılmaz.
8. Her taş sonunda: pnpm check (typecheck+lint+test) + ilgili Playwright akışı yeşil olmalı.
