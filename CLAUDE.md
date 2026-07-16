# KALKAN-OS
TR finans kuruluşları için sürekli uyum SaaS'ı. Stack: Next.js + TS + Supabase (Postgres/RLS/Storage).

## Mevcut aşama (güncellenir)
Canlı Supabase projesi (`jgunbctnoprklseusaee`) **kullanımda**. Session Pooler
üzerinden bağlanıyoruz — direct connection IPv6-only. 12 migration uygulandı ve
`pnpm db:verify` ile fiilen doğrulandı (14 tablo, 4 fonksiyon). Kontrol
kütüphanesi seed edildi (2 çerçeve, 17 kontrol) ve ilk kuruma atandı.

**Uygulama artık gerçek Supabase'e bağlı**: kimlik Supabase Auth'tan, yetki
bağlamı `profiles`'tan, veri gerçek tablolardan. `src/lib/mock-data.ts`
uygulama kodunda kullanılmıyor (yalnızca `scripts/generate-yk-beyani.ts`
hâlâ okuyor). Deploy yok.

M1-M5 mock store üzerinde tamamlanmıştı. M5.5'in **mantık ve şema katmanı
bitti**: audit_log hash zinciri, dört-göz onayı (`evidence_reviews`), RFC 6962
Merkle + proof, `EvidenceAnchorProvider`, kanıt zarfı (canonical JSON) ve
bağımsız doğrulama — hepsi testli. M5.5'in **UI'ı yok**; bu katmanlar henüz
hiçbir ekrana bağlı değil.

**Geçişin açtığı borçlar** (docs/ROADMAP.md "Supabase geçişi" altında listeli,
"bitti" demeden önce oku): audit_log yazması atomik değil (trigger'a taşınmalı);
denetçi paylaşımı `/paylasim/:token` çalışmıyor (RLS anon'a satır vermiyor, M4
kabul kriteri karşılanmıyor); Playwright akışları devre dışı (kural 8 ihlali,
işaretli).

**RLS gerçekten test ediliyor** (kural 1 için mazeret yok): PGlite
(Postgres'in WASM derlemesi, kurulum gerektirmez) ile gerçek migration
dosyalarına karşı Vitest'te koşuyoruz — bkz. `src/lib/__tests__/helpers/pg.ts`
ve `rls-*.test.ts`. Yeni bir tablo/politika eklerken RLS testi de yaz.
Bu aynı zamanda kural 4'ü fiilen kanıtlar: şema düz Postgres'te koşuyor.

**Ama PGlite testleri Supabase'i tam taklit etmez — ve bu bir kez canlıyı
bozdu.** Supabase eklentileri `extensions` şemasına kurar, PGlite `public`'e;
`set search_path = public` ile kilitli fonksiyonlar canlıda `digest()`'i
bulamadığı için her `tenant_controls` güncellemesi sessizce patlıyordu ve hash
zinciri hiç çalışmıyordu — 193 test yeşilken. Bu yüzden: **şemaya dokunan her
migration'dan sonra canlıya karşı gerçek bir yazma dene.** `pnpm db:verify`
tabloların var olduğunu gösterir, çalıştıklarını değil.

Hâlâ **doğrulanamayan** ve "yazıldı ama doğrulanmadı" diye işaretlenmesi
gerekenler: Storage'a gerçek dosya yükleme ve deploy. Bunlar için "çalışıyor"
deme. (Supabase Auth artık doğrulandı: gerçek kullanıcı canlıda giriş yaptı,
profil RLS altında okundu.)

**Sıradaki büyük kapsam — simülasyon** (docs/ROADMAP.md §1.2, M7-M9): 17 Temmuz
2026'da eklendi, henüz kodlanmadı. Simülasyon ayrı bir oyun değil, uyum
işletim sisteminin test üretme katmanıdır: her beklenen aksiyon bir kontrole
bağlanır, sonuçlar kanıt ve bulgu önerisi üretir. Önce **mevcut borçlar**
kapatılmalı (özellikle denetçi paylaşımı: M4 kabul kriteri şu an
karşılanmıyor) — belge de "ana fonksiyonlar simülasyon olmadan da çalışmalı"
diyor.

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
9. Simülasyon ASLA gerçek bir üretim saldırısı başlatmaz; her tatbikat bildirimi/ekranı
   açıkça TATBİKAT etiketi taşır (gerçek olayla karışması bir uyum ürününde felakettir).
10. Yayınlanmış senaryo şablonu ve başlatılmış simülasyon snapshot'ı immutable: şablon
   değişirse geçmiş simülasyon değişmez, yeni sürüm doğar.
11. Puanlama deterministik ve açıklanabilir: aynı girdi aynı sonucu verir, her puan satırı
   gerekçesini taşır. AI yalnızca gözlem notu özetleyebilir — puanı veya uyum durumunu
   belirleyemez. Simülasyon bulgusu PROPOSED doğar, insan onaylamadan gerçek bulgu olmaz.
12. Senaryo içeriği de mevzuat içeriği gibidir (kural 3): data/scenarios/*.yaml'dan seed
   edilir, uydurulmaz, UNVERIFIED_SAMPLE etiketlenir.
