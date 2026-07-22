# Özel SMTP Kurulumu (Dikey G1.1 — kurucunun 22 Temmuz 2026 kararı)

**Durum: HENÜZ YAPILMADI (yapılandırma tarafı) — SEÇİM YAPILDI (22 Temmuz
2026).** İlk gerçek pilot davetinden önce ZORUNLU bloklayıcı çıkış kapısı.
Bu bir kod görevi DEĞİLDİR — Supabase proje panelinde, sağlayıcı hesabında
ve `wardproof.com`'un DNS kayıtlarında yapılan bir yapılandırmadır; Claude bu
adımları YÜRÜTEMEZ (harici sağlayıcı hesabı/kimlik bilgisi/DNS erişimi
gerektirir), yalnız doğrulama scripti/checklist hazırlayabilir ve DNS'in
GÜNCEL halini salt-okur sorgulayabilir.

## 0. Kararlaştırılan seçim (kurucunun 22 Temmuz 2026 kararı)

- **Sağlayıcı:** Resend.
- **Domain:** `wardproof.com` (Resend'de domain-seviyesi doğrulanacak;
  `info@wardproof.com` adresinin AYRICA doğrulanması gerekmiyor — Resend
  doğrulamayı domain seviyesinde yapar, doğrulanmış domain üzerindeki
  herhangi bir yerel-parça göndericisi kullanılabilir).
- **Gönderici adresi (tüm Supabase Auth e-postaları için AYNI):**
  `info@wardproof.com`.
- **Gönderici adı:** `WardProof`.
- **Kapsam — davet, ilk-giriş parola belirleme, şifre sıfırlama, güvenlik
  bildirimi dahil DÖRDÜ DE** aynı `WardProof <info@wardproof.com>`
  kimliğini kullanır — pilot aşamasında ayrı adres yönetimi bilinçli olarak
  YAPILMIYOR.
- **Bilinçli ertelenen (gelecek, hacim artınca):** `no-reply@wardproof.com`
  (otomatik sistem mesajları), `security@wardproof.com` (güvenlik
  bildirimleri), `support@wardproof.com` (müşteri desteği) — bugün TEK
  `info@` adresi yeterli, ayrıştırma yalnız gerçek hacim/ihtiyaç ortaya
  çıkınca yapılır.

## 1. Neden zorunlu (kanıtlanmış gerçek)

Dikey G1'in canlı testleri sırasında Supabase'in varsayılan e-posta
servisinin ÇOK DÜŞÜK bir hız sınırına sahip olduğu doğrudan doğrulandı:
birkaç ardışık `inviteUserByEmail` denemesi "email rate limit exceeded"
döndürdü (bkz. `docs/adr/PR0-dikeyG-g1-pilot-provisioning-onboarding-
2026-07-22.md`). Bu, Supabase'in kendi belgelerinde de "yalnız test/geliştirme
içindir" diye işaretlenen bir sınırdır — gerçek pilot davetleri için
kullanılamaz.

## 1.5 Resend kurulum adımları (sağlayıcının kendi belgelerinden doğrulandı,
22 Temmuz 2026)

**Adım A — Resend'de domain doğrulama:** Resend dashboard → Domains →
`wardproof.com` ekle. Resend, domain için gereken SPF (TXT) ve DKIM (TXT,
1024-bit — Resend 2048-bit desteklemiyor) kayıtlarını KENDİSİ üretir ve
"Records" sekmesinde gösterir; **bu değerler hesaba özgüdür, buraya
uydurulmaz** — kurucu Resend panelinden kopyalayıp `wardproof.com` DNS'ine
(Hostinger DNS yönetimi) ekler. DMARC zaten `p=none` olarak mevcut (§DNS
durumu altta) — SPF/DKIM doğrulandıktan sonra `p=quarantine`'a yükseltmek
tercih meselesi, zorunlu değil.

**Adım B — Supabase Authentication → SMTP Settings alan eşlemesi:**

| Supabase alanı | Değer |
|---|---|
| SMTP server host | `smtp.resend.com` |
| Port | `587` (STARTTLS) veya `465` (implicit TLS) — ikisi de Resend'de destekli |
| User | `resend` (sabit literal — kullanıcı adı DEĞİL, Resend'in kendi kuralı) |
| Password | Resend API key (Resend dashboard → API Keys) |
| Sender/From address | `info@wardproof.com` |
| Sender name | `WardProof` |

**Adım C — DNS'i doğrula:** aşağıdaki §"DNS durumu" bölümündeki sorguları
Resend domain doğrulaması SONRASI tekrar çalıştır; SPF include'unun/DKIM
TXT'inin göründüğünü teyit et.

## 1.6 DNS durumu (22 Temmuz 2026 anlık görüntü — Google DNS-over-HTTPS ile
salt-okur sorgulandı, `dig`/`nslookup` bu ortamda yok)

| Kayıt | Bulunan değer |
|---|---|
| SPF (TXT, `wardproof.com`) | `v=spf1 include:_spf.mail.hostinger.com ~all` — yalnız Hostinger'ın kendi postası için; Resend include'u HENÜZ YOK |
| DMARC (TXT, `_dmarc.wardproof.com`) | `v=DMARC1; p=none` — izleme modu, mevcut |
| MX | `mx1.hostinger.com` (öncelik 5), `mx2.hostinger.com` (öncelik 10) |
| DKIM (yaygın selector'lar denendi: default/selector1/selector2/google/resend/sendgrid/mailgun/ses) | HİÇBİRİ bulunamadı — beklenen, Resend domain doğrulaması henüz yapılmadı |

**Not:** bu bir denetim değil, yalnız "kurulumdan önceki temel çizgi" —
Resend domain doğrulaması sonrası §1.5 Adım C'deki sorgular tekrar
çalıştırılıp SPF/DKIM'in göründüğü teyit edilmeli.

### 1.6.1 DOĞRULANDI (22 Temmuz 2026, ikinci sorgu — Resend domain doğrulaması sonrası)

Resend'in ürettiği kayıtlar Hostinger DNS'ine doğru yerleştirildi (ilk
denemede kök `@`'a yazılmıştı — Resend'in bunları `send` alt-domaininde
istediği fark edilip düzeltildi) ve Google DNS-over-HTTPS ile bağımsız
olarak yeniden sorgulanıp TEYİT edildi:

| Kayıt | Doğrulanan değer |
|---|---|
| Root SPF (`@`) | `v=spf1 include:_spf.mail.hostinger.com ~all` — Hostinger'a GERİ DÖNDÜ (ilk denemede yanlışlıkla üzerine yazılmıştı) |
| `send.wardproof.com` SPF (TXT) | `v=spf1 include:amazonses.com ~all` ✅ |
| `send.wardproof.com` MX | `feedback-smtp.eu-west-1.amazonses.com` (öncelik 10) ✅ |
| `resend._domainkey` DKIM (TXT) | Tam public key mevcut (`p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCB...`) ✅ |
| DMARC | `v=DMARC1; p=none` (değişmedi, izleme modu) |

**Resend'de domain doğrulaması TAMAMLANDI.** Sıradaki: Supabase Authentication
→ SMTP Settings bağlantısı (§1.5 Adım B).

## 2. Kabul kriterleri (kurucunun listesi — hepsi geçmeden kapı AÇILMAZ)

- [x] Sağlayıcı, domain, gönderici adresi/adı kararlaştırıldı (§0, 22 Temmuz
      2026) — Resend / `wardproof.com` / `info@wardproof.com` / `WardProof`.
- [x] Resend'de `wardproof.com` domain doğrulaması TAMAMLANDI (§1.6.1, 22
      Temmuz 2026 — bağımsız DNS sorgusuyla teyitli).
- [ ] Özel SMTP sağlayıcısı Supabase projesine bağlanmış (§1.5 Adım B).
- [x] SPF kaydı yapılandırılmış (`send.wardproof.com` üzerinde Resend
      include'u + root `@` Hostinger'da korunuyor, §1.6.1).
- [x] DKIM kaydı (Resend'in ürettiği TXT, `resend._domainkey`) yapılandırılmış
      (§1.6.1).
- [ ] DMARC kaydı yapılandırılmış (zaten `p=none` var — tercihen, kurucunun
      notu: SPF/DKIM'den farklı olarak zorunlu değil ama önerilir).
- [ ] Davet e-postası (`inviteUserByEmail`) gerçek bir alıcıya test edilmiş.
- [ ] Parola sıfırlama e-postası (`resetPasswordForEmail` / recovery)
      gerçek bir alıcıya test edilmiş.
- [ ] E-posta doğrulama (signup confirmation — bu dilimde kullanılmıyor ama
      şablon olarak var; ileride açılırsa aynı kapıdan geçmeli) test edilmiş.
- [ ] Gönderim HATALARI loglanıyor (SMTP sağlayıcısının kendi dashboard'u
      veya webhook'u üzerinden — Supabase'in kendisi gönderim başarısızlığını
      uygulamaya sessizce bildirir, `inviteUserByEmail`'in dönüş değeri
      yalnız "kabul edildi mi" der, "gerçekten teslim oldu mu" demez).
- [ ] Bounce (geri dönen) ve rate-limit davranışı izleniyor (sağlayıcının
      kendi panelinden — WardProof tarafında ayrı bir izleme kurulmadı,
      bu bilinçli bir kapsam sınırı, gerekirse ayrı bir iş).
- [ ] Davet bağlantılarının (`redirectTo`) doğru PRODUCTION domaine
      (`https://wardproof.com/ilk-giris`) yönlendiği doğrulanmış — dev/
      staging URL'i production e-postasına SIZMAMALI.
- [ ] Test e-postalarında eski Hostinger geçici domaini
      (`blue-yak-865668.hostingersite.com`) veya eski ürün adı
      ("Wardproof" değil "WardProof", "KALKAN-OS" hiç) GEÇMİYOR.

## 3. Doğrulama script'i (hazır, çalıştırılabilir)

Aşağıdaki adımlar Supabase panelinden SMTP bağlandıktan SONRA çalıştırılır
— gerçek bir e-posta adresine (kurucunun kendi test kutusu) davet gönderip
sonucu raporlar. Script GEÇİCİDİR (F5/F5.1/G1'in smoke script'leri gibi —
bir kez çalıştırılır, gerçek e-posta adresi/parola asla commit edilmez).

```ts
// scripts/smoke-ozel-smtp.ts (ÖRNEK ISKELET — gerçek çalıştırma öncesi
// kurucunun kendi test e-posta adresini elle girmesi gerekir)
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, requireEnv } from "./env";

async function main() {
  const env = loadEnvLocal();
  requireEnv(env, ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const gercekTestEpostasi = process.argv[2];
  if (!gercekTestEpostasi) {
    console.error("Kullanım: pnpm exec tsx scripts/smoke-ozel-smtp.ts <gerçek-test-e-postası>");
    process.exit(1);
  }

  const t0 = Date.now();
  const { data, error } = await db.auth.admin.inviteUserByEmail(gercekTestEpostasi, {
    redirectTo: "https://wardproof.com/ilk-giris",
  });
  console.log(`inviteUserByEmail: ${Date.now() - t0}ms`, error ? `HATA: ${error.message}` : `OK, user=${data.user?.id}`);
  console.log("Şimdi gelen kutunuzu kontrol edin: gönderen \"WardProof <info@wardproof.com>\" mi, ve /ilk-giris'e yönlenen link doğru mu?");
  console.log("Doğruladıktan sonra test kullanıcısını silin:");
  if (data?.user?.id) console.log(`  await db.auth.admin.deleteUser("${data.user.id}")`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

## 3.5 Üretim kurulum planı — Supabase SMTP bağlantısı + test matrisi (22
Temmuz 2026, kodsuz — kurucu onayı bekliyor, CANLI AYAR DEĞİŞTİRİLMEDİ)

**Not — Supabase Auth panelinin kendisi bu oturumda DOĞRUDAN incelenemedi:**
bağlı Supabase MCP bağlantısı WardProof'un projesine (`jgunbctnoprklseusaee`)
değil, başka bir hesaptaki farklı projelere (Finanskor.com, EquScore)
bakıyor — bu yanlış projede sorgu çalıştırma riskini önlemek için
KULLANILMADI. Aşağıdaki adımlar kod/DNS/route incelemesinden ve §0-§1.6.1'in
zaten doğrulanmış durumundan türetildi; Supabase panelinin BUGÜN gerçekten
ne gösterdiği kurucu tarafından teyit edilmeli.

### 3.5.1 Sıralı adımlar

1. **Resend API key üret** (Resend dashboard → API Keys → Sending access,
   `wardproof.com`'a scope'lu). Key'i güvenli bir yerde tutun — bu adımdan
   sonraki hiçbir adımda repo'ya/commit'e YAZILMAZ.
2. **Supabase Dashboard → Authentication → Emails (SMTP Settings) → Enable
   Custom SMTP** açın, §1.5 Adım B'deki tabloyu birebir girin (host
   `smtp.resend.com`, port 587, user `resend` literal, password=1. adımdaki
   key, sender `info@wardproof.com`, sender name `WardProof`).
3. **Supabase Dashboard → Authentication → URL Configuration** kontrol edin:
   `Site URL` = `https://wardproof.com`, `Redirect URLs` allow-list'inde
   `https://wardproof.com/**` bulunmalı. **Eski geçici Hostinger domaini
   (`blue-yak-865668.hostingersite.com`) veya `localhost`/`127.0.0.1`
   satırları varsa temizlenmeli** — bu, davet/reset linklerinin doğru
   domaine gitmesinin GERÇEK kapısı (kodun kendisi `redirectTo`'yu
   isteğin origin'inden dinamik kurar, bkz. §3.5.2 — ama Supabase'in
   redirect allow-list'i bunu yine de reddedebilir/izin verebilir).
4. Kaydedin, DEĞİŞTİRMEDEN önce §2'nin "canlı ayar" maddelerini kurucunun
   kendisinin uyguladığını doğrulayın (bu belge yalnız planı yazar,
   uygulamaz).
5. §3'teki `scripts/smoke-ozel-smtp.ts` iskeletini gerçek bir test
   e-postasıyla çalıştırın, aşağıdaki test matrisini (§3.5.3) geçin.
6. Hepsi geçince bu belgeye (§2 checklist) tarih+sonuç işlenir, kapı
   "geçti" sayılır (§4).

### 3.5.2 Redirect URL kontrolü — kod tarafı zaten doğru, panel tarafı doğrulanmalı

`src/app/api/platform/tenants/route.ts:79` — gerçek davet rotası:
```ts
redirectTo: `${new URL(req.url).origin}/ilk-giris`
```
**Sabit kodlanmış bir domain YOK** — istekin kendi origin'i kullanılıyor.
Bu iyi bir tasarım (dev/staging/prod otomatik doğru domaine gider) AMA bunun
GÜVENLİ olması için iki koşul kurucu tarafından doğrulanmalı: (a) davetler
HER ZAMAN `https://wardproof.com/platform`den tetiklenmeli (başka bir
origin'den — örn. yerel geliştirme ortamından — canlı bir davet ASLA
gönderilmemeli), (b) Supabase'in Redirect URL allow-list'i (§3.5.1 madde 3)
yalnız `https://wardproof.com/**`i izin vermeli — böylece yanlış bir
origin'den tetiklenen bir davet bile Supabase tarafında reddedilir (ikinci
bir güvenlik katmanı). `supabase/config.toml`'daki `site_url =
"http://127.0.0.1:3000"` YALNIZ yerel `supabase start` içindir, ÜRETİM
projesinin panel ayarını YANSITMAZ — üretim ayarı panelden ayrıca
doğrulanmalı.

### 3.5.3 Test matrisi

| # | Senaryo | Beklenen | Nasıl doğrulanır |
|---|---|---|---|
| 1 | Davet e-postası (`inviteUserByEmail`) | Gelir, gönderen `WardProof <info@wardproof.com>`, link `https://wardproof.com/ilk-giris` | `scripts/smoke-ozel-smtp.ts` |
| 2 | Parola sıfırlama (`resetPasswordForEmail`) | Aynı gönderici kimliği, doğru redirect | Gerçek kullanıcıyla manuel deneme |
| 3 | E-posta doğrulama şablonu | Bu dilimde tetiklenmiyor ama şablon Resend/Supabase'te AYNI göndericiyi kullanmalı | Panelden şablon önizleme |
| 4 | Yanlış origin'den davet denemesi | Supabase Redirect URL allow-list REDDETMELİ | Yerel ortamdan bilerek bir davet denenip 4xx görülmesi |
| 5 | Resend rate-limit/bounce senaryosu | Resend dashboard'da hata görünür, WardProof UI'ı sessizce "başarılı" göstermemeli | Resend dashboard → Logs (gerçek gönderim sonrası) |
| 6 | Eski domain/marka sızıntısı | E-posta içeriğinde `hostingersite.com` veya "Wardproof"/"KALKAN-OS" GEÇMEMELİ | Gelen e-postanın manuel okunması |

### 3.5.4 Güvenlik ve secret yönetimi

- Resend API key **hiçbir dosyaya, commit'e, log'a YAZILMAZ** — yalnız
  Supabase panelinin kendi (şifreli) SMTP password alanına girilir.
- `scripts/smoke-ozel-smtp.ts` test e-postası adresi de commit'e girmez
  (script zaten `process.argv[2]`'den okuyor, dosyaya gömülmüyor).
- Bu belge ve ilgili commit'ler API key/parola İÇERMEZ — yalnız alan
  adları/host/port gibi genel yapılandırma bilgisi taşır.

## 4. Kapı geçince

Bu belgeye bir "Doğrulandı" bölümü + tarih + kurucunun onayı eklenir; G1.1
bu kapı olmadan "bitti" sayılmaz. Kapı geçtikten sonra §2'deki checklist bu
dosyada kalıcı kanıt olarak saklanır (silinmez).
