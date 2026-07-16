"use client";

import { AuditLogList } from "@/components/audit-log-list";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalStore } from "@/lib/store";

export default function DenetimIziPage() {
  const { auditLog } = useLocalStore();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Denetim İzi</h1>
        <p className="text-sm text-muted-foreground">
          Kim, ne zaman, neyi değiştirdi. Kayıtlar yalnızca eklenir — düzenlenemez veya silinemez.
        </p>
      </div>

      {auditLog.length === 0 ? (
        <EmptyState
          title="Henüz denetim kaydı yok"
          description="Bir kontrolün durumunu değiştirdiğinizde veya kanıt yüklediğinizde kayıtlar burada görünür."
          action={{ href: "/controls", label: "Kontrol Kütüphanesine git" }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{auditLog.length} kayıt</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditLogList entries={auditLog} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
