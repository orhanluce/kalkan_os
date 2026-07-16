"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockProfiles } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";

export default function GirisPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = login(email);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/");
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ayse@demo.com"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              Giriş Yap
            </Button>
          </form>
          <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">Yerel demo — şifre yok, gerçek kimlik doğrulama değil.</p>
            <p>Demo kullanıcılar:</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {mockProfiles.map((p) => (
                <li key={p.id}>
                  {p.email} — {p.fullName} ({p.role})
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
