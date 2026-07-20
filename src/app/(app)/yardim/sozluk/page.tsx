"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SOZLUK } from "@/lib/yardim-icerik";

export default function SozlukPage() {
  const [arama, setArama] = useState("");
  const filtrelenmis = useMemo(() => {
    const anahtar = arama.trim().toLocaleLowerCase("tr-TR");
    if (!anahtar) return SOZLUK;
    return SOZLUK.filter(
      (s) => s.terim.toLocaleLowerCase("tr-TR").includes(anahtar) || s.aciklama.toLocaleLowerCase("tr-TR").includes(anahtar),
    );
  }, [arama]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sözlük</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          KALKAN_OS&apos;ta karşılaşacağınız teknik terimlerin sade Türkçe açıklamaları.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 max-w-sm">
        <Label htmlFor="sozluk-arama">Terim ara</Label>
        <Input
          id="sozluk-arama"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="ör. hash, tenant, retest…"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle><h2 className="contents">{filtrelenmis.length} terim</h2></CardTitle>
        </CardHeader>
        <CardContent>
          {filtrelenmis.length === 0 ? (
            <p className="text-sm text-muted-foreground">Eşleşen terim bulunamadı.</p>
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              {filtrelenmis.map((s) => (
                <div key={s.terim} className="border-b pb-3 last:border-0">
                  <dt className="font-medium">{s.terim}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{s.aciklama}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Link href="/yardim" className="text-sm text-primary hover:underline">
        ← Tam Kullanıcı Kılavuzu&apos;na dön
      </Link>
    </div>
  );
}
