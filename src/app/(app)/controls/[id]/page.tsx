"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { AuditLogList } from "@/components/audit-log-list";
import { EmptyState } from "@/components/empty-state";
import { findEquivalentControlIds } from "@/lib/control-mappings";
import { sha256Hex, validateEvidenceFile } from "@/lib/evidence";
import type { Evidence } from "@/lib/evidence-types";
import { mockControlMappings, mockControls, mockFrameworks, mockProfiles } from "@/lib/mock-data";
import { useLocalStore } from "@/lib/store";
import type { Durum, EvidenceTip } from "@/lib/types";
import { DURUM_BADGE_VARIANT, DURUM_LABEL } from "@/lib/ui-labels";

const DURUM_OPTIONS: Durum[] = ["karsilaniyor", "kismi", "acik", "kapsam_disi"];
const TIP_LABEL: Record<EvidenceTip, string> = {
  dosya: "Dosya",
  link: "Link",
  beyan: "Beyan",
};
const TIP_OPTIONS = Object.keys(TIP_LABEL) as EvidenceTip[];
const ATANMADI = "atanmadi";

// base-ui Select'te <SelectValue /> `items` verilmezse seçili değerin ham
// halini ("acik", "u-uyum") gösterir — Türkçe etiketi değil. Her Select'e
// value→label haritası geçmek zorunlu (bkz. e2e/sorumlu-atama.spec.ts).
const SORUMLU_ITEMS: Record<string, string> = {
  [ATANMADI]: "Atanmadı",
  ...Object.fromEntries(mockProfiles.map((p) => [p.id, p.fullName])),
};

export default function ControlDetailPage() {
  const params = useParams<{ id: string }>();
  const control = mockControls.find((c) => c.id === params.id);
  const { tenantControls, evidencesByControl, auditLog, setDurum, setNot, setSorumlu, addEvidence } =
    useLocalStore();

  const tenantControl = tenantControls.find((tc) => tc.controlId === params.id);
  const evidences = evidencesByControl[params.id] ?? [];
  const equivalentControls = findEquivalentControlIds(params.id, mockControlMappings)
    .map((id) => mockControls.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Bu kontrole ait kayıtlar: doğrudan tenant_controls hedefli olanlar, ve
  // kanıt kayıtları (hedefId kanıt id'si olduğu için detay.controlId'den).
  const controlAuditLog = auditLog.filter(
    (e) =>
      (e.hedefTablo === "tenant_controls" && e.hedefId === params.id) ||
      (e.hedefTablo === "evidences" && e.detay?.controlId === params.id),
  );

  const [notDraft, setNotDraft] = useState(tenantControl?.notMetni ?? "");
  const [tip, setTip] = useState<EvidenceTip>("dosya");
  const [link, setLink] = useState("");
  const [beyanMetni, setBeyanMetni] = useState("");
  const [gecerlilikBitis, setGecerlilikBitis] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(selected: File | null) {
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    const result = validateEvidenceFile(selected);
    setFile(result.valid ? selected : null);
    setFileError(result.error);
  }

  if (!control || !tenantControl) {
    return (
      <EmptyState
        title="Kontrol bulunamadı"
        description="Bu id'ye sahip bir kontrol yok — silinmiş veya yanlış bir link olabilir."
        action={{ href: "/controls", label: "Kontrol Kütüphanesine dön" }}
      />
    );
  }

  async function handleEvidenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let storagePathOrLink = "";
      let hashSha256: string | null = null;

      if (tip === "dosya") {
        if (!file) return;
        const revalidated = validateEvidenceFile(file);
        if (!revalidated.valid) {
          setFileError(revalidated.error);
          return;
        }
        storagePathOrLink = file.name;
        hashSha256 = await sha256Hex(await file.arrayBuffer());
      } else if (tip === "link") {
        storagePathOrLink = link;
      } else {
        storagePathOrLink = beyanMetni;
      }

      const evidence: Evidence = {
        id: crypto.randomUUID(),
        controlId: control!.id,
        tip,
        storagePathOrLink,
        hashSha256,
        gecerlilikBitis: gecerlilikBitis || null,
        createdAt: new Date().toISOString(),
        kaynakKontrolId: null,
      };
      addEvidence(evidence);
      setFile(null);
      setLink("");
      setBeyanMetni("");
      setGecerlilikBitis("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/controls" className="text-sm text-muted-foreground hover:underline">
          ← Kontrol Kütüphanesi
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{control.baslik}</h1>
        <p className="text-sm text-muted-foreground">
          {control.maddeRef} · kritiklik {control.kritiklik} · {control.periyot.replace("_", " ")}
        </p>
        <p className="mt-2 max-w-2xl text-sm">{control.aciklama}</p>
      </div>

      {equivalentControls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eşlenik Kontroller</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              &ldquo;Bir kanıt, dört çerçeve&rdquo;: buraya yüklenen kanıt aşağıdaki kontrollerde de
              otomatik görünür.
            </p>
            <ul className="flex flex-col gap-2">
              {equivalentControls.map((ec) => {
                const framework = mockFrameworks.find((f) => f.id === ec.frameworkId);
                return (
                  <li key={ec.id} className="text-sm">
                    <Link href={`/controls/${ec.id}`} className="hover:underline">
                      <span className="text-muted-foreground">{framework?.code}</span>{" "}
                      {ec.maddeRef} — {ec.baslik}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Durum</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Badge variant={DURUM_BADGE_VARIANT[tenantControl.durum]}>
              {DURUM_LABEL[tenantControl.durum]}
            </Badge>
            <Select
              items={DURUM_LABEL}
              value={tenantControl.durum}
              onValueChange={(v) => setDurum(control!.id, v as Durum)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURUM_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DURUM_LABEL[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sorumlu">Sorumlu</Label>
            <Select
              items={SORUMLU_ITEMS}
              value={tenantControl.sorumluUserId ?? ATANMADI}
              onValueChange={(v) => setSorumlu(control!.id, v === ATANMADI ? null : v)}
            >
              <SelectTrigger id="sorumlu">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ATANMADI}>Atanmadı</SelectItem>
                {mockProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="not">Not</Label>
            <Textarea
              id="not"
              value={notDraft}
              onChange={(e) => setNotDraft(e.target.value)}
              onBlur={() => setNot(control!.id, notDraft)}
              placeholder="Bu kontrolle ilgili not..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kanıt Yükle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEvidenceSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kanit-tip">Tip</Label>
              <Select items={TIP_LABEL} value={tip} onValueChange={(v) => setTip(v as EvidenceTip)}>
                <SelectTrigger id="kanit-tip">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIP_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIP_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tip === "dosya" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dosya">Dosya (SHA-256 tarayıcıda hesaplanır)</Label>
                <Input
                  id="dosya"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, PNG, JPG veya düz metin — en fazla 20 MB.
                </p>
                {fileError && <p className="text-xs text-destructive">{fileError}</p>}
              </div>
            )}
            {tip === "link" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="link">Link</Label>
                <Input
                  id="link"
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  required
                />
              </div>
            )}
            {tip === "beyan" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="beyan">Beyan metni</Label>
                <Textarea
                  id="beyan"
                  value={beyanMetni}
                  onChange={(e) => setBeyanMetni(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gecerlilik">Geçerlilik bitiş (opsiyonel)</Label>
              <Input
                id="gecerlilik"
                type="date"
                value={gecerlilikBitis}
                onChange={(e) => setGecerlilikBitis(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Hesaplanıyor..." : "Kanıt Ekle"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yüklenen Kanıtlar ({evidences.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {evidences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kanıt yüklenmedi.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {evidences.map((ev) => (
                <li key={ev.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{ev.tip}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.createdAt).toLocaleString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-muted-foreground">{ev.storagePathOrLink}</p>
                  {ev.hashSha256 && (
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      sha256: {ev.hashSha256}
                    </p>
                  )}
                  {ev.gecerlilikBitis && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Geçerlilik bitiş: {ev.gecerlilikBitis}
                    </p>
                  )}
                  {ev.kaynakKontrolId && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Eşlenik kanıt —{" "}
                      <Link href={`/controls/${ev.kaynakKontrolId}`} className="underline">
                        kaynak kontrolden
                      </Link>{" "}
                      otomatik yansıtıldı
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Denetim İzi</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Bu kontrolde yapılan her değişiklik kayıt altındadır ve silinemez.
          </p>
          <AuditLogList entries={controlAuditLog} />
        </CardContent>
      </Card>
    </div>
  );
}
