"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { mockControls, mockFrameworks, mockTenant } from "@/lib/mock-data";
import { isShareLinkValid } from "@/lib/share-links";
import { useLocalStore } from "@/lib/store";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";

export default function ShareLinkGuestPage() {
  const params = useParams<{ token: string }>();
  const { shareLinks, tenantControls, evidencesByControl } = useLocalStore();

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
        />
      )}

      <p className="mt-auto pt-8 text-xs text-muted-foreground">
        Bu, M4 denetçi paylaşım odasının yerel önizlemesidir — gerçek uygulamada bu görünüm
        sunucu tarafında (denetci_misafir rolü + RLS) zorunlu kılınacaktır; şu anda yalnızca
        istemci tarafında filtreleniyor ve gerçek bir erişim kontrolü sağlamaz.
      </p>
    </div>
  );
}

function GuestScopedView({
  frameworkId,
  tenantControls,
  evidencesByControl,
}: {
  frameworkId: string;
  tenantControls: ReturnType<typeof useLocalStore>["tenantControls"];
  evidencesByControl: ReturnType<typeof useLocalStore>["evidencesByControl"];
}) {
  const framework = mockFrameworks.find((f) => f.id === frameworkId);
  const controls = mockControls.filter((c) => c.frameworkId === frameworkId);
  const durumByControlId = new Map(tenantControls.map((tc) => [tc.controlId, tc.durum]));

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{mockTenant.name}</h1>
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
