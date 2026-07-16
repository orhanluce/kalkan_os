# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Kurucunun kendi ayrı Supabase hesabında canlı bir proje var (`jgunbctnoprklseusaee`,
Session Pooler üzerinden bağlanıyoruz — direct connection IPv6-only olduğu için).
`pnpm db:link` ile bağlandı; 9 migration dosyası **gerçekten uygulandı**
(`pnpm db:push`, 16 Temmuz 2026) ve `supabase migration list` ile local/remote
eşleşmesi doğrulandı. Şema canlıda var — ama uygulama kodu hâlâ mock/localStorage
store'a bağlı, gerçek Supabase client'a geçiş henüz yapılmadı; deploy de yok.

M1-M5 (kontrol kütüphanesi, kanıt motoru, boşluk/olgunluk panosu, denetçi
paylaşımı, temel güvenlik sertleştirme) mock/localStorage store üzerinde
tamamlandı. Mimari kararı ve M5.5 (kanıt bütünlüğü derinleştirme: hash
zinciri, Merkle batch, anchor provider, dört-göz onayı) için bkz.
docs/ROADMAP.md §1.1 ve M5.5 — 16 Temmuz 2026'da eklendi, henüz kodlanmadı.

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
