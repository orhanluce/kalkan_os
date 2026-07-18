"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateShareToken, isShareLinkValid } from "@/lib/share-links";
import { useLocalStore } from "@/lib/store";

function defaultSonGecerlilik(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PaylasimPage() {
  const { shareLinks, addShareLink, kutuphane } = useLocalStore();

  // base-ui Select `items` olmadan ham değeri (UUID) gösterir.
  const FRAMEWORK_ITEMS: Record<string, string> = Object.fromEntries(
    kutuphane.frameworks.map((f) => [f.id, f.code]),
  );
  const frameworkById = new Map(kutuphane.frameworks.map((f) => [f.id, f]));

  // frameworkId "kullanıcı elle bir şey seçti mi" durumunu tutar; boşsa
  // henüz seçmemiştir. Çerçeveler asenkron geldiği için ilk render'da liste
  // boş olabilir — frameworks[0].id'yi state'e ATAMAK yerine (effect içinde
  // setState, gereksiz bir render turu ve lint'in react-hooks/
  // set-state-in-effect kuralının uyardığı desen) render sırasında TÜRETİYORUZ:
  // kullanıcı seçim yapmadıysa ilk çerçeve varsayılan olarak kullanılır.
  const [frameworkId, setFrameworkId] = useState<string>("");
  const seciliFrameworkId = frameworkId || (kutuphane.frameworks[0]?.id ?? "");
  const [sonGecerlilik, setSonGecerlilik] = useState(defaultSonGecerlilik);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addShareLink({
      id: crypto.randomUUID(),
      // Gerçek tenant_id'yi store, oturumdaki kiracıdan yazar.
      tenantId: "",
      token: generateShareToken(),
      kapsam: { frameworkId: seciliFrameworkId },
      olusturan: null,
      sonGecerlilik: `${sonGecerlilik}T23:59:59.000Z`,
      createdAt: new Date().toISOString(),
    });
  }

  function linkUrl(token: string): string {
    if (typeof window === "undefined") return `/paylasim/${token}`;
    return `${window.location.origin}/paylasim/${token}`;
  }

  async function handleCopy(token: string) {
    await navigator.clipboard.writeText(linkUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Denetçi Paylaşımı</h1>
        <p className="text-sm text-muted-foreground">
          Süreli, salt-okunur paylaşım linkleri — yalnızca seçilen çerçevenin kontrol durumlarını
          gösterir.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Yeni Link Oluştur</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cerceve">Çerçeve</Label>
              <Select
                items={FRAMEWORK_ITEMS}
                value={seciliFrameworkId}
                onValueChange={(v) => setFrameworkId(v ?? seciliFrameworkId)}
              >
                <SelectTrigger id="cerceve">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kutuphane.frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="son-gecerlilik">Son geçerlilik</Label>
              <Input
                id="son-gecerlilik"
                type="date"
                min={todayIso()}
                value={sonGecerlilik}
                onChange={(e) => setSonGecerlilik(e.target.value)}
                required
              />
            </div>
            <Button type="submit">Link Oluştur</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{shareLinks.length} link</CardTitle>
        </CardHeader>
        <CardContent>
          {shareLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz paylaşım linki oluşturulmadı.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Çerçeve</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                  <TableHead>Son Geçerlilik</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareLinks.map((sl) => {
                  const valid = isShareLinkValid(sl, new Date());
                  return (
                    <TableRow key={sl.id}>
                      <TableCell>{frameworkById.get(sl.kapsam.frameworkId)?.code}</TableCell>
                      <TableCell>{new Date(sl.createdAt).toLocaleDateString("tr-TR")}</TableCell>
                      <TableCell>{new Date(sl.sonGecerlilik).toLocaleDateString("tr-TR")}</TableCell>
                      <TableCell>
                        <StatusBadge durum={valid ? "success" : "danger"}>
                          {valid ? "Geçerli" : "Süresi Doldu"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCopy(sl.token)}>
                          {copiedToken === sl.token ? "Kopyalandı" : "Linki Kopyala"}
                        </Button>
                        <a
                          href={`/paylasim/${sl.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button variant="ghost" size="sm">
                            Önizle
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
