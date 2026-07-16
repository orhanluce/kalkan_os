# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Şu an **yerel geliştirme** aşamasındayız: canlı Supabase projesi yok, deploy yok.
Kod ve migration'lar hazırlanıyor; gerçek Supabase/Node prod bağlantısı kurucu
onayıyla ayrı bir adımda yapılacak. Bu süre boyunca DB'ye bağlı özellikler
(auth, RLS testleri, gerçek kanıt yükleme) yazılabilir ama bir Supabase
projesi bağlanana kadar çalıştırılıp doğrulanamaz — bunu "yazıldı ama
doğrulanmadı" olarak işaretle, "çalışıyor" deme.

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
