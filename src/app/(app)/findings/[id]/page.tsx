"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStore } from "@/lib/store";
import {
  FINDING_DURUM_LABEL,
  FINDING_DURUM_SEMANTIK,
  KAYNAK_LABEL,
  ONEM_LABEL,
  ONEM_SEMANTIK,
} from "@/lib/ui-labels";

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const { findings, updateFinding, toggleFindingDurum } = useLocalStore();
  const finding = findings.find((f) => f.id === params.id);

  const [aksiyonPlaniDraft, setAksiyonPlaniDraft] = useState(finding?.aksiyonPlani ?? "");
  const [ykOnayTarihiDraft, setYkOnayTarihiDraft] = useState(finding?.ykOnayTarihi ?? "");
  const [hedefKapamaDraft, setHedefKapamaDraft] = useState(finding?.hedefKapama ?? "");

  if (!finding) {
    return (
      <EmptyState
        title="Bulgu bulunamadı"
        description="Bu id'ye sahip bir bulgu yok — silinmiş veya yanlış bir link olabilir."
        action={{ href: "/findings", label: "Bulgular listesine dön" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/findings" className="text-sm text-muted-foreground hover:underline">
          ← Bulgular
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{finding.baslik}</h1>
          <StatusBadge durum={ONEM_SEMANTIK[finding.onem]}>{ONEM_LABEL[finding.onem]}</StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Kaynak: {KAYNAK_LABEL[finding.kaynak]} · Durum: {FINDING_DURUM_LABEL[finding.durum]}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Durum</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <StatusBadge durum={FINDING_DURUM_SEMANTIK[finding.durum]}>
            {FINDING_DURUM_LABEL[finding.durum]}
          </StatusBadge>
          <Button variant="outline" size="sm" onClick={() => toggleFindingDurum(finding.id)}>
            {finding.durum === "acik" ? "Kapat" : "Yeniden Aç"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aksiyon Planı ve YK Onayı</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="aksiyon-plani">Aksiyon planı</Label>
            <Textarea
              id="aksiyon-plani"
              value={aksiyonPlaniDraft}
              onChange={(e) => setAksiyonPlaniDraft(e.target.value)}
              onBlur={() => updateFinding(finding.id, { aksiyonPlani: aksiyonPlaniDraft || null })}
              placeholder="Bu bulguyu kapatmak için planlanan aksiyon..."
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="yk-onay">YK onay tarihi</Label>
              <Input
                id="yk-onay"
                type="date"
                value={ykOnayTarihiDraft ?? ""}
                onChange={(e) => setYkOnayTarihiDraft(e.target.value)}
                onBlur={() =>
                  updateFinding(finding.id, { ykOnayTarihi: ykOnayTarihiDraft || null })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hedef-kapama">Hedef kapama</Label>
              <Input
                id="hedef-kapama"
                type="date"
                value={hedefKapamaDraft ?? ""}
                onChange={(e) => setHedefKapamaDraft(e.target.value)}
                onBlur={() =>
                  updateFinding(finding.id, { hedefKapama: hedefKapamaDraft || null })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
