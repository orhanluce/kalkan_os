// Next.js 16'da bu dosya middleware.ts'in yerini alır (export adı da `proxy`).
// Bkz. https://nextjs.org/docs/messages/middleware-to-proxy
//
// İKİ İŞİ VAR:
//   1. Auth token'ını yeniler ve tazelenmiş cookie'yi yanıta yazar. Server
//      Component'ler cookie yazamadığı için bu iş buraya ait — burası
//      olmasaydı oturum sessizce düşerdi.
//   2. Oturumsuz kullanıcıyı /giris'e yollar.
//
// GÜVENLİK SINIRI: buradaki yönlendirme bir KOLAYLIKTIR, koruma değildir.
// Gerçek koruma RLS'tedir (CLAUDE.md kural 1): proxy atlatılsa bile
// veritabanı başka kiracının satırını döndürmez. Yetkilendirmeyi yalnızca
// buraya dayamak, tek bir yönlendirme hatasını veri sızıntısına çevirirdi.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAyarlari } from "./lib/supabase/env";

/**
 * Oturum gerektirmeyen yollar.
 *
 * /paylasim BİLİNÇLİ olarak açıktır: bağımsız denetçi, hesabı olmadan
 * süreli bir token ile girer (docs/ROADMAP.md M4). Erişimi token'ın
 * kendisi ve share_links üzerindeki RLS sınırlar — oturum değil.
 *
 * /dogrula da BİLİNÇLİ olarak açıktır (M9): rapordaki karekodu okutan denetçinin
 * hesabı yoktur. Buradaki risk /paylasim'dan daha düşük çünkü sayfa hiçbir
 * kiracı verisi göstermez — yalnızca manifest_dogrula'nın döndürdüğü beş
 * minimize alan (hash, zaman, mühür durumu). Tabloların kendisine erişimi
 * hâlâ RLS engelliyor.
 *
 * /health açıktır (PR-1, master talimat §26): izleme/Hostinger oturum açamaz;
 * oturum isteyen bir health endpoint'i işlevsizdir. Kiracı verisi sızdırmaz —
 * live sabit yanıt, ready yalnız "DB erişilebilir mi" durumu döndürür.
 * (Bu satır canlı deploy doğrulamasında yakalandı: /health/live 307 → /giris
 * dönüyordu.)
 */
// /proof da /paylasim gibi BİLİNÇLİ açıktır (G1 Proof Room): denetçi/regülatör
// hesabı olmadan süreli token'la girer; kapsam/süre/iptal proof_room_goruntule
// RPC'sinde. (/health dersi: açık yol listesinden eksik kalan oturumsuz sayfa
// canlıda 307'ye düşer — smoke e2e bunu da kilitliyor.)
// /matter da /proof gibi BİLİNÇLİ açıktır (G7 dış erişim): denetçi/regülatör
// hesapsız, bağımsızlık beyanlı token'la girer; kapsam/süre/iptal/beyan
// matter_goruntule RPC'sinde.
// /tedarikci-erisim da aynı desendir (M35 sonraki dilim, G7 M41 partner
// modeli): tedarikçinin hesabı yok, süreli/iptal edilebilir token'la kendi
// kaydının salt-okur özetini görür; kapsam/süre/iptal tedarikci_goruntule
// RPC'sinde. Bilinçli olarak `/tedarikciler` (yönetim, oturum ister) İLE
// KARIŞMAYAN ayrı bir kelime — startsWith çakışması yok ama okunurluk için de.
const ACIK_YOLLAR = ["/giris", "/paylasim", "/auth", "/dogrula", "/health", "/proof", "/matter", "/tedarikci-erisim"];

function acikYolMu(pathname: string): boolean {
  return ACIK_YOLLAR.some((yol) => pathname === yol || pathname.startsWith(`${yol}/`));
}

export async function proxy(request: NextRequest) {
  const { url, anonKey } = supabaseAyarlari();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
        // @supabase/ssr v0.10+ token yenilendiğinde cache başlıklarını
        // (Cache-Control, Expires, Pragma) ikinci argümanla geçer. Bunları
        // yanıta taşımazsak tazelenmiş oturum bir ara katmanda
        // önbelleklenebilir.
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        }
      },
    },
  });

  // getUser(), getSession()'ın aksine token'ı Supabase'e doğrulatır.
  // getSession() cookie'deki veriye güvenir ve sunucu tarafında güvenilmez.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !acikYolMu(request.nextUrl.pathname)) {
    const hedef = request.nextUrl.clone();
    hedef.pathname = "/giris";
    return NextResponse.redirect(hedef);
  }

  // Oturumu olan kullanıcı giriş sayfasına gitmeye çalışırsa panoya al.
  if (user && request.nextUrl.pathname === "/giris") {
    const hedef = request.nextUrl.clone();
    hedef.pathname = "/";
    return NextResponse.redirect(hedef);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Statik dosyalar ve görseller hariç her yol. Bunları dışarıda bırakmak
    // hem gereksiz Auth çağrısını hem de her varlık isteğinde token
    // yenileme denemesini önler.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
