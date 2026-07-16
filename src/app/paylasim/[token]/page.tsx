"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { isShareLinkValid } from "@/lib/share-links";
import { useLocalStore } from "@/lib/store";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";

// BİLİNEN KAYIP — Supabase geçişi: bu sayfa oturumsuz açılır (denetçi hesapsız
// gelir), ama share_links/tenant_controls üzerindeki RLS politikaları
// current_tenant_id()'ye dayanır ve anon kullanıcı için hiçbir satır
// döndürmez. Dolayısıyla geçerli bir token bile artık "link geçersiz" görünür.
//
// Mock store'da çalışıyordu çünkü her şey localStorage'daydı — yani aslında
// hiçbir erişim kontrolü yoktu. Doğru çözüm token'ı sunucu tarafında
// doğrulayıp kapsamı orada uygulamaktır (token'a bağlı RLS politikası veya
// bir Route Handler). docs/ROADMAP.md "Supabase geçişi"nde takip ediliyor.
export default function ShareLinkGuestPage() {
  const params = useParams<{ token: string }>();
  const { shareLinks, tenantControls, evidencesByControl, kutuphane, kurum } = useLocalStore();

  const shareLink = shareLinks.find((sl) => sl.token === params.token);
  const valid = isShareLinkValid(shareLink, new Date());

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between border-b pb-4">
        <span className="text-lg font-semibold tracking-tight">KALKAN-OS</span>
        <Badge variant="outline">Denetçi Görünümü · salt-okunur</Badge>
      </div>

      {!shareLink || !valid ? (
        <EmptyState
          title="Bu link geçersiz veya süresi dolmuş"
          description="Kurumunuzla iletişime geçip güncel bir paylaşım linki isteyin."
        />
      ) : (
        <GuestScopedView
          frameworkId={shareLink.kapsam.frameworkId}
          tenantControls={tenantControls}
          evidencesByControl={evidencesByControl}
          kutuphane={kutuphane}
          kurumAdi={kurum.tenant?.name ?? "—"}
        />
      )}

      <p className="mt-auto pt-8 text-xs text-muted-foreground">
        Denetçi paylaşımı Supabase geçişi sırasında geçici olarak çalışmıyor: bu sayfa
        oturumsuz açıldığı için RLS politikaları veri döndürmüyor ve geçerli bir link bile
        geçersiz görünüyor. Token doğrulaması sunucu tarafına taşınana kadar bu böyle
        kalacak — bkz. docs/ROADMAP.md.
      </p>
    </div>
  );
}

function GuestScopedView({
  frameworkId,
  tenantControls,
  evidencesByControl,
  kutuphane,
  kurumAdi,
}: {
  frameworkId: string;
  tenantControls: ReturnType<typeof useLocalStore>["tenantControls"];
  evidencesByControl: ReturnType<typeof useLocalStore>["evidencesByControl"];
  kutuphane: ReturnType<typeof useLocalStore>["kutuphane"];
  kurumAdi: string;
}) {
  const framework = kutuphane.frameworks.find((f) => f.id === frameworkId);
  const controls = kutuphane.controls.filter((c) => c.frameworkId === frameworkId);
  const durumByControlId = new Map(tenantControls.map((tc) => [tc.controlId, tc.durum]));

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{kurumAdi}</h1>
        <p className="text-sm text-muted-foreground">
          Kapsam: {framework?.code} — {framework?.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{controls.length} kontrol</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Madde</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kanıt Sayısı</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controls.map((c) => {
                const durum = durumByControlId.get(c.id) ?? "acik";
                const evidenceCount = (evidencesByControl[c.id] ?? []).length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.maddeRef}
                    </TableCell>
                    <TableCell>{c.baslik}</TableCell>
                    <TableCell>
                      <Badge variant={DURUM_BADGE_VARIANT[durum]}>{DURUM_LABEL[durum]}</Badge>
                    </TableCell>
                    <TableCell>{evidenceCount}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
