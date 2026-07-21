"use client";

// Dikey G1: davet edilen ilk kurum yöneticisinin parola belirleme sayfası.
// Supabase'in kendi davet linki (inviteUserByEmail) bu sayfaya bir oturum
// (URL hash'inden @supabase/ssr tarafından otomatik algılanır) taşır — özel
// bir token doğrulaması burada YAZILMAZ, Supabase Auth'un kendi mekanizması
// kullanılır (ADR §9). Parola belirlendikten sonra /onboarding'e yönlendirir
// — KVKK/şartlar kabulü ve durum geçişi orada tek çağrıda yapılır.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function IlkGirisSayfasi() {
  const router = useRouter();
  const [oturumHazir, setOturumHazir] = useState(false);
  const [parola, setParola] = useState("");
  const [parolaTekrar, setParolaTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    const db = createClient();
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      if (session) setOturumHazir(true);
    });

    // Supabase'in davet/kurtarma linki oturum jetonlarını URL HASH parçasında
    // taşır (implicit flow). @supabase/ssr'nin tarayıcı istemcisi bunu her
    // zaman OTOMATİK algılamayabiliyor — bu yüzden burada AÇIKÇA ayrıştırıp
    // setSession çağırıyoruz (tek kaynak: hash yoksa zaten getSession()
    // yeterli, oturum başka bir yoldan zaten kurulmuş olabilir).
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ data, error }) => {
        if (data.session) setOturumHazir(true);
        if (error) console.error("setSession başarısız:", error.message);
      });
    } else {
      db.auth.getSession().then(({ data }) => {
        if (data.session) setOturumHazir(true);
      });
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  async function parolaBelirle(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    if (parola.length < 8) {
      setHata("Parola en az 8 karakter olmalıdır.");
      return;
    }
    if (parola !== parolaTekrar) {
      setHata("Parolalar eşleşmiyor.");
      return;
    }
    setGonderiliyor(true);
    const db = createClient();
    const { error } = await db.auth.updateUser({ password: parola });
    setGonderiliyor(false);
    if (error) {
      setHata(error.message);
      return;
    }
    router.replace("/onboarding");
  }

  if (!oturumHazir) {
    return (
      <main className="mx-auto max-w-md p-8">
        <p className="text-sm text-muted-foreground">
          Davet bağlantınız doğrulanıyor… Bu ekranı davet e-postanızdaki bağlantıyla açtığınızdan emin olun.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Parolanızı Belirleyin</h1>
        <p className="mt-1 text-sm text-muted-foreground">WardProof&apos;a hoş geldiniz. Devam etmek için bir parola belirleyin.</p>
      </div>
      <form onSubmit={(e) => void parolaBelirle(e)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="parola">Parola</Label>
          <Input id="parola" type="password" value={parola} onChange={(e) => setParola(e.target.value)} required minLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="parola-tekrar">Parola (tekrar)</Label>
          <Input id="parola-tekrar" type="password" value={parolaTekrar} onChange={(e) => setParolaTekrar(e.target.value)} required minLength={8} />
        </div>
        {hata ? <p className="text-xs text-destructive">{hata}</p> : null}
        <Button type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Kaydediliyor…" : "Parolayı Kaydet ve Devam Et"}
        </Button>
      </form>
    </main>
  );
}
