"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

// Kayıt (signup) formu BİLİNÇLİ olarak yoktur: şartname §5.1 gereği
// kullanıcılar davetle gelir, kendi kendine kayıt olmaz. Bir uyum
// ürününde herkesin hesap açabildiği bir kapı, kiracı sınırının anlamını
// zayıflatırdı.
export default function GirisPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sifre, setSifre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGonderiliyor(true);

    const result = await login(email, sifre);
    setGonderiliyor(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // refresh(): proxy.ts'in tazelenmiş oturumu görmesi için sunucu
    // bileşenleri yeniden çalışmalı.
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
      <span className="text-lg font-semibold tracking-tight">KALKAN-OS</span>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Giriş Yap</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sifre">Şifre</Label>
              <Input
                id="sifre"
                type="password"
                autoComplete="current-password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={gonderiliyor}>
              {gonderiliyor ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>
          <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            Hesabınız kurum yöneticiniz tarafından oluşturulur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
