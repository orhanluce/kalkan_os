# Wardproof — Sıfırdan Yeniden Yükleme Kılavuzu (Hostinger)

> Amaç: mevcut (503/restart-loop yaşayan) Node.js uygulamasını Hostinger'da
> **tamamen silip** projeyi sıfırdan, temiz kurmak. Bu dosya tek başına
> yeterlidir — adım adım uygulayın. Süre: ~20 dk + build süresi.
>
> **Veri güvenliği:** Tüm veri Supabase'dedir (`jgunbctnoprklseusaee`).
> Hostinger'daki uygulamayı silmek HİÇBİR veriyi silmez — uygulama durumsuz
> (stateless) bir Next.js sunucusudur. Migration'lar zaten canlı Supabase'e
> uygulanmıştır; DB tarafında yapılacak bir şey yok.

---

## 0. Ön koşullar (elinizde olsun)

- GitHub deposu: `orhanluce/kalkan_os`, dal: `main`
  (yeniden yükleme öncesi son commit'in push'landığından emin olun:
  yerelde `git status` temiz + `git push origin main`)
- Supabase panosundan üç değer (Settings → API):
  - Project URL
  - `anon` public anahtarı
  - `service_role` anahtarı (GİZLİ — yalnız sunucu env'ine girer)
- Hostinger hPanel erişimi + `wardproof.com` alan adı yönetimi

## 1. Eski uygulamayı sil

1. hPanel → **Websites** → wardproof.com → **Node.js** (veya "Web Apps").
2. Mevcut uygulamayı **Stop** edin, sonra **Delete/Remove** ile kaldırın.
3. Uygulamanın dosya dizini soruluyorsa onu da silin (veri Supabase'de —
   burada kaybolacak hiçbir şey yok).
4. Eski **deployment/webhook** bağlantısı kaldıysa (GitHub deploy key /
   webhook) onu da silin — çift tetiklenme olmasın.

## 2. Yeni Node.js uygulaması oluştur

hPanel → Node.js → **Create Application**:

| Alan | Değer |
|---|---|
| Node sürümü | **22.x** (repo `.nvmrc` + `package.json engines` ile sabitli) |
| Uygulama kökü | (varsayılan; boş yeni dizin) |
| Deploy yöntemi | **Git** → `https://github.com/orhanluce/kalkan_os` · dal `main` |
| Build komutu | `pnpm install --frozen-lockfile && pnpm run build` |
| Start komutu | `pnpm start` (eşdeğeri: `next start`) |
| Port | Hostinger'ın verdiği `PORT` env'i — Next `start` bunu otomatik OKUMAZ; start komutunu `next start -p $PORT` yapın (panel PORT değişkeni tanımlıyorsa) |

> pnpm seçeneği yoksa build komutu:
> `corepack enable && pnpm install --frozen-lockfile && pnpm run build`

## 3. Ortam değişkenleri (uygulamanın İHTİYACI olan yalnız bunlar)

Panelin **Environment Variables** bölümüne girin — değerleri Supabase
panosundan kopyalayın, bu dosyaya ASLA yazmayın:

| Ad | Nereden |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (GİZLİ) |
| `NODE_ENV` | `production` |

Yereldeki `.env.local` içindeki DİĞER anahtarlar (AI_*, SERPAPI vb.) bu
uygulamanın değil, başka projelerin anahtarlarıdır — **sunucuya taşımayın**.

## 4. İlk deploy'u tetikle ve İZLE

1. **Deploy** düğmesine basın; **build log'unu açık tutun.**
2. Beklenen akış: `pnpm install` (~1-2 dk) → `next build` (~2-4 dk) →
   "Compiled successfully".
3. Build bittiğinde uygulama otomatik başlar; **runtime log**'da tek bir
   `✓ Ready in ...` görmelisiniz.
   - `Ready` satırı **birkaç saniyede bir tekrar ediyorsa** → restart-loop;
     §7'ye gidin.

## 5. Alan adını bağla

1. Uygulamaya `wardproof.com` (apex) alan adını bağlayın.
2. SSL sertifikasının aktif olduğunu doğrulayın.
3. **Bilinen açık iş:** `www.wardproof.com` 503 veriyor — `www` için ya
   apex'e 301 yönlendirme kuralı ekleyin ya da `www`'yu da uygulamaya
   bağlayın (DNS'te `www` CNAME → apex).

## 6. Sağlık doğrulaması (kanıt, tahmin değil)

Tarayıcı veya terminalden sırasıyla:

| İstek | Beklenen |
|---|---|
| `https://wardproof.com/health/live` | **200** |
| `https://wardproof.com/health/ready` | **200** (DB erişilemiyorsa dürüst 503) |
| `https://wardproof.com/` (oturumsuz) | **307 → `/tanitim`** (tanıtım sayfası) |
| `https://wardproof.com/controls` (oturumsuz) | **307 → `/giris`** |
| `/giris` üzerinden gerçek kullanıcıyla giriş | Pano açılır, kiracı verisi görünür |

Beşi de geçtiyse yeniden yükleme TAMAM.

## 7. Sorun giderme

**Build OOM / sessizce ölüyor** (paylaşımlı hostta en olası neden):
- Build komutunu şöyle değiştirin:
  `NODE_OPTIONS=--max-old-space-size=1536 pnpm run build`
- Hâlâ ölüyorsa build'i YEREL yapın: bu depoda `next.config.ts`'e
  `output: "standalone"` ekleyip yerelde `pnpm run build` çalıştırın ve
  `.next/standalone` çıktısını (+ `.next/static` + `public`) yükleyip
  `node server.js` ile başlatın — host hiç build etmez. (Bu yol gerekirse
  ayrı bir iş olarak kodda hazırlanır; önce §2'deki standart yolu deneyin.)

**Restart-loop ("Ready in 0ms" her ~1-20 sn'de)**:
- 21 Temmuz 2026'da yaşandı; kod tamamen geri alınmışken de sürdüğü için
  **uygulama kodu kaynaklı DEĞİLDİ** (bkz. commit `3bc4bc5` mesajı ve
  `docs/DEVAM.md` F4 notu). Temiz kurulumdan sonra tekrarlıyorsa Hostinger
  destek kaydı açın; log'daki "hata yok ama sürekli restart" davranışını
  ve saatleri paylaşın.
- Kök adres artık ağır render değil anlık 307 döndürür (proxy.ts) —
  sağlık-kontrolü kaynaklı döngü teorisine karşı da güvenli.

**503 (`server: hcdn`)**: Node konteyneri ayakta değil demektir — runtime
log'a bakın; çoğunlukla build başarısız olmuş ya da start komutu yanlış
porttadır (§2'deki `-p $PORT` notu).

**PDF/ZIP rotaları 503 "Chromium destekli ortam gerekiyor" veriyor**:
bilinen sınır (CLAUDE.md) — paylaşımlı hostta Playwright/Chromium yok;
mühür/imza/doğrulama etkilenmez.

## 8. Deploy sonrası tek komutluk hızlı kontrol (yerelden)

```bash
node -e "for (const p of ['/health/live','/health/ready','/']) fetch('https://wardproof.com'+p,{redirect:'manual'}).then(r=>console.log(p,'=>',r.status,r.headers.get('location')??''))"
```

Beklenen: `200`, `200`, `307 /tanitim`.
