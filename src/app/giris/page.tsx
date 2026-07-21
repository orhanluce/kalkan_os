"use client";

import { ArrowRight, Check, Eye, EyeOff, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { WardproofGlyph } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

function WardproofMark() {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[13px] border border-cyan-200/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_32px_rgba(59,210,210,0.12)]">
      <WardproofGlyph className="size-7" />
    </span>
  );
}

const evidenceSteps = [
  { number: "01", label: "Kaynak" },
  { number: "02", label: "Kontrol" },
  { number: "03", label: "Test" },
  { number: "04", label: "Kanıt" },
];

export default function GirisPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sifreGorunur, setSifreGorunur] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHata("");
    setYukleniyor(true);
    const result = await login(email, sifre);
    setYukleniyor(false);

    if (!result.ok) {
      setHata(result.error ?? "Giriş yapılamadı.");
      return;
    }

    router.refresh();
    router.push("/");
  }

  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#07111b] text-[#edf5f7]">
      <div aria-hidden="true" className="absolute inset-0 -z-20 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(134,203,218,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(134,203,218,.055) 1px,transparent 1px)", backgroundSize: "56px 56px" }} />
      <div aria-hidden="true" className="absolute -top-48 left-[8%] -z-10 size-[620px] rounded-full bg-cyan-400/10 blur-[140px]" />
      <div aria-hidden="true" className="absolute -right-56 bottom-[-280px] -z-10 size-[680px] rounded-full bg-blue-500/15 blur-[150px]" />

      <div className="mx-auto flex min-h-svh w-full max-w-[1540px] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/8 py-6">
          <a href="/tanitim" aria-label="Wardproof ana sayfa" className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
            <WardproofMark />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Wardproof</span>
          </a>
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-slate-400 uppercase">
            <ShieldCheck className="size-4 text-cyan-300" aria-hidden="true" /> Kurumsal erişim
          </div>
        </header>

        <div className="grid flex-1 items-center gap-14 py-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(380px,0.7fr)] lg:gap-20 lg:py-16">
          <section className="wardproof-enter max-w-3xl" aria-labelledby="wardproof-baslik">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/6 px-3 py-1.5 text-xs font-medium tracking-[0.08em] text-cyan-100 uppercase">
              <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" /> Sürekli uyum çalışma alanı
            </div>
            <h1 id="wardproof-baslik" className="max-w-[780px] text-[clamp(2.65rem,5.3vw,5.8rem)] leading-[0.96] font-semibold tracking-[-0.055em] text-balance">
              Uyum iddiasını
              <span className="block bg-gradient-to-r from-cyan-200 via-sky-200 to-blue-300 bg-clip-text text-transparent">kanıta bağlayın.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Wardproof; mevzuat kaynağından kontrole, test sonucundan denetim kanıtına kadar tüm uyum zincirini tek ve doğrulanabilir bir çalışma alanında birleştirir.
            </p>

            <div className="wardproof-enter-delay mt-10 rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-sm sm:p-5" aria-label="Wardproof kanıt zinciri">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Kanıt zinciri</span>
                <span className="font-mono text-[9px] tracking-[0.1em] text-cyan-300 uppercase sm:text-[10px]">İzlenebilir · Doğrulanabilir</span>
              </div>
              <ol className="grid grid-cols-4">
                {evidenceSteps.map((step, index) => (
                  <li key={step.label} className="relative min-w-0">
                    {index < evidenceSteps.length - 1 ? <span aria-hidden="true" className="absolute top-3 left-[calc(50%+16px)] h-px w-[calc(100%-32px)] bg-gradient-to-r from-cyan-300/70 to-blue-300/20" /> : null}
                    <div className="relative flex flex-col items-center text-center sm:items-start sm:text-left">
                      <span className="grid size-6 place-items-center rounded-full border border-cyan-200/30 bg-[#0b1b27] font-mono text-[9px] text-cyan-200 shadow-[0_0_18px_rgba(103,232,249,.12)]">{step.number}</span>
                      <span className="mt-3 text-xs font-medium text-slate-200 sm:text-sm">{step.label}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <ul className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              {["Mevzuat dayanağı görünür", "Test durumları ayrıştırılmış", "Kanıt geçmişi korunur"].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-cyan-200"><Check className="size-3.5" aria-hidden="true" /></span>{item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="giris-baslik" className="wardproof-enter-delay-2 mx-auto w-full max-w-[470px] lg:mr-0">
            <div className="rounded-[28px] border border-white/12 bg-[#0e1a25]/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,.38)] backdrop-blur-xl sm:p-8">
              <div className="mb-8 flex items-start justify-between gap-5">
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">Güvenli çalışma alanı</p>
                  <h2 id="giris-baslik" className="text-2xl font-semibold tracking-[-0.035em]">Hesabınıza giriş yapın</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Kurum hesabınızla kaldığınız yerden devam edin.</p>
                </div>
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200"><FileCheck2 className="size-5" aria-hidden="true" /></span>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-slate-200">E-posta</label>
                  <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ad@kurum.com" className="h-12 rounded-xl border-white/12 bg-[#09141e]/80 px-4 text-base text-white placeholder:text-slate-600 focus-visible:border-cyan-300/70 focus-visible:ring-cyan-300/20" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sifre" className="text-sm font-medium text-slate-200">Şifre</label>
                  <div className="relative">
                    <Input id="sifre" name="sifre" type={sifreGorunur ? "text" : "password"} autoComplete="current-password" required value={sifre} onChange={(event) => setSifre(event.target.value)} className="h-12 rounded-xl border-white/12 bg-[#09141e]/80 px-4 pr-12 text-base text-white focus-visible:border-cyan-300/70 focus-visible:ring-cyan-300/20" />
                    <button type="button" onClick={() => setSifreGorunur((current) => !current)} aria-label={sifreGorunur ? "Şifreyi gizle" : "Şifreyi göster"} className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                      {sifreGorunur ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                {hata ? <div role="alert" className="rounded-xl border border-red-300/20 bg-red-400/8 px-4 py-3 text-sm leading-5 text-red-200">{hata}</div> : null}
                <Button type="submit" disabled={yukleniyor} className="group h-12 w-full rounded-xl bg-[#69d7dc] text-sm font-semibold text-[#061319] shadow-[0_12px_32px_rgba(59,210,210,.16)] transition-all hover:bg-[#8be7e9] hover:shadow-[0_16px_40px_rgba(59,210,210,.22)] focus-visible:ring-cyan-200 disabled:opacity-60">
                  {yukleniyor ? "Giriş yapılıyor…" : "Giriş Yap"}
                  {!yukleniyor ? <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
                </Button>
              </form>
              <div className="mt-7 flex gap-3 border-t border-white/8 pt-6 text-xs leading-5 text-slate-400">
                <LockKeyhole className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                <p>Hesaplar kurum yöneticiniz tarafından oluşturulur. Yetkinizle ilgili bir sorun varsa kurum yöneticinize başvurun.</p>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/8 py-5 text-[11px] tracking-[0.08em] text-slate-400 uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>Wardproof · Continuous compliance</span><span>Finans kuruluşları için tasarlandı</span>
        </footer>
      </div>
    </main>
  );
}
