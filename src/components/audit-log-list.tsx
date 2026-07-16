"use client";

import { mockProfiles } from "@/lib/mock-data";
import type { AuditLogEntry } from "@/lib/types";
import { AUDIT_EYLEM_LABEL } from "@/lib/ui-labels";

const profileById = new Map(mockProfiles.map((p) => [p.id, p]));

function aktorAdi(actorId: string | null): string {
  if (!actorId) return "Sistem";
  return profileById.get(actorId)?.fullName ?? "Bilinmeyen kullanıcı";
}

export function AuditLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz denetim kaydı yok.</p>;
  }

  // En yeni üstte. audit_log append-only olduğu için diziyi kopyalayıp
  // sıralıyoruz — kaynak diziyi ters çevirmiyoruz.
  const sirali = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ul className="flex flex-col gap-2">
      {sirali.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-4 border-b pb-2 text-sm last:border-b-0">
          <span>
            <span className="font-medium">{AUDIT_EYLEM_LABEL[entry.eylem]}</span>{" "}
            <span className="text-muted-foreground">· {aktorAdi(entry.actorId)}</span>
          </span>
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={entry.createdAt}>
            {new Date(entry.createdAt).toLocaleString("tr-TR")}
          </time>
        </li>
      ))}
    </ul>
  );
}
