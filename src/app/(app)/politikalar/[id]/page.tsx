"use client";

// Politika detayı (G2, M34 v2) — kurucunun dar-ama-çalışan akışı:
// madde yaz → hüküm/kontrole bağla → incelemeye gönder → farklı kullanıcıyla
// onayla → yürürlüğe al → salt-okur effective + audit zinciri.
//
// İçerik yazma/bağlama YALNIZ DRAFT'ta (APPROVED/EFFECTIVE donuk — DB guard).
// Onay dört-göz (hazırlayan onaylayamaz — DB guard); geçişler /api rotalarında.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/durum/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { DURUM_ETIKET } from "../page";

interface Bag {
  id: string;
  etiket: string;
}
interface Madde {
  id: string;
  madde_ref: string;
  metin: string;
  baglar: Bag[];
}
interface Surum {
  id: string;
  surum: number;
  durum: string;
  hazirlayan: string | null;
  effective_from: string | null;
}

export default function PolitikaDetayPage() {
  const params = useParams<{ id: string }>();
  const [belge, setBelge] = useState<{ kod: string; baslik: string } | null>(null);
  const [surum, setSurum] = useState<Surum | null>(null);
  const [maddeler, setMaddeler] = useState<Madde[]>([]);
  const [onaylar, setOnaylar] = useState<{ ad: string; karar: string }[]>([]);
  const [audit, setAudit] = useState<{ eylem: string; created_at: string }[]>([]);
  const [attestVar, setAttestVar] = useState(false);
  const [hukumler, setHukumler] = useState<{ id: string; ref: string }[]>([]);
  const [kontroller, setKontroller] = useState<{ id: string; ref: string }[]>([]);
  const [kullaniciId, setKullaniciId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yeniRef, setYeniRef] = useState("");
  const [yeniMetin, setYeniMetin] = useState("");

  const yukle = useCallback(async () => {
    const db = createClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    setKullaniciId(user?.id ?? null);
    if (user) {
      const { data: p } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
      setTenantId(p?.tenant_id ?? null);
    }

    const { data: doc } = await db
      .from("policy_documents")
      .select("kod, baslik, policy_versions (id, surum, durum, hazirlayan, effective_from)")
      .eq("id", params.id)
      .maybeSingle();
    if (!doc) return;
    setBelge({ kod: doc.kod, baslik: doc.baslik });
    const v = [...((doc.policy_versions as unknown as Surum[]) ?? [])].sort((a, b) => b.surum - a.surum)[0] ?? null;
    setSurum(v);
    if (!v) return;

    const { data: cs } = await db
      .from("policy_clauses")
      .select("id, madde_ref, metin, sira, policy_clause_links (id, provision_id, obligation_id, control_id, provisions (provision_ref), controls (madde_ref))")
      .eq("policy_version_id", v.id)
      .order("sira");
    setMaddeler(
      ((cs ?? []) as unknown as (Madde & { policy_clause_links: Record<string, unknown>[] })[]).map((c) => ({
        id: c.id,
        madde_ref: c.madde_ref,
        metin: c.metin,
        baglar: (c.policy_clause_links ?? []).map((l) => ({
          id: l.id as string,
          etiket: (l.provisions as { provision_ref?: string } | null)?.provision_ref
            ? `Hüküm: ${(l.provisions as { provision_ref: string }).provision_ref}`
            : (l.controls as { madde_ref?: string } | null)?.madde_ref
              ? `Kontrol: ${(l.controls as { madde_ref: string }).madde_ref}`
              : "Yükümlülük",
        })),
      })),
    );

    const { data: aps } = await db
      .from("policy_approvals")
      .select("karar, profiles (full_name)")
      .eq("policy_version_id", v.id);
    setOnaylar((aps ?? []).map((a) => ({ ad: (a.profiles as { full_name?: string } | null)?.full_name ?? "?", karar: a.karar })));

    // Sürüm olayları (hedef_id = sürüm) + onay olayları (onay audit'inde
    // hedef_id = onay id; sürüm bağı detay.policy_version_id'de).
    const [{ data: surumAudit }, { data: onayAudit }] = await Promise.all([
      db.from("audit_log").select("eylem, created_at").eq("hedef_tablo", "policy_versions").eq("hedef_id", v.id),
      db.from("audit_log").select("eylem, created_at").eq("hedef_tablo", "policy_approvals").eq("detay->>policy_version_id", v.id),
    ]);
    setAudit(
      [...(surumAudit ?? []), ...(onayAudit ?? [])]
        .map((r) => ({ eylem: r.eylem, created_at: r.created_at }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );

    if (user) {
      const { data: att } = await db
        .from("policy_attestations")
        .select("id")
        .eq("policy_version_id", v.id)
        .eq("attesting_user", user.id)
        .maybeSingle();
      setAttestVar(!!att);
    }

    // Bağlama seçenekleri (global referans).
    const { data: provs } = await db.from("provisions").select("id, provision_ref").limit(50);
    setHukumler((provs ?? []).map((p) => ({ id: p.id, ref: p.provision_ref })));
    const { data: ctrls } = await db.from("controls").select("id, madde_ref").limit(50);
    setKontroller((ctrls ?? []).map((c) => ({ id: c.id, ref: c.madde_ref })));
  }, [params.id]);

  useEffect(() => {
    const c = async () => {
      await yukle();
    };
    void c();
  }, [yukle]);

  const maddeEkle = useCallback(async () => {
    setHata(null);
    if (!yeniRef.trim() || !yeniMetin.trim() || !surum || !tenantId) return;
    const db = createClient();
    const { error } = await db.from("policy_clauses").insert({
      tenant_id: tenantId,
      policy_version_id: surum.id,
      madde_ref: yeniRef.trim(),
      metin: yeniMetin.trim(),
      sira: maddeler.length,
    });
    if (error) {
      setHata(error.message);
      return;
    }
    setYeniRef("");
    setYeniMetin("");
    await yukle();
  }, [yeniRef, yeniMetin, surum, tenantId, maddeler.length, yukle]);

  const bagla = useCallback(
    async (maddeId: string, tur: "provision" | "control", hedefId: string) => {
      setHata(null);
      if (!tenantId || !hedefId) return;
      const db = createClient();
      const alan = tur === "provision" ? { provision_id: hedefId } : { control_id: hedefId };
      const { error } = await db
        .from("policy_clause_links")
        .insert({ tenant_id: tenantId, policy_clause_id: maddeId, ...alan });
      if (error) setHata(error.message);
      await yukle();
    },
    [tenantId, yukle],
  );

  const durumGecis = useCallback(
    async (eylem: string, effectiveFrom?: string) => {
      setHata(null);
      if (!surum) return;
      const yanit = await fetch("/api/politika/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: surum.id, eylem, effectiveFrom }),
      });
      if (!yanit.ok) {
        const g = (await yanit.json().catch(() => ({}))) as { hata?: string };
        setHata(g.hata ?? `İşlem başarısız (${yanit.status}).`);
      }
      await yukle();
    },
    [surum, yukle],
  );

  const onayla = useCallback(async () => {
    setHata(null);
    if (!surum) return;
    const yanit = await fetch("/api/politika/onay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId: surum.id, karar: "APPROVE" }),
    });
    if (!yanit.ok) {
      const g = (await yanit.json().catch(() => ({}))) as { hata?: string };
      setHata(g.hata ?? `Onay başarısız (${yanit.status}).`);
    }
    await yukle();
  }, [surum, yukle]);

  const attestEt = useCallback(async () => {
    setHata(null);
    if (!surum || !kullaniciId || !tenantId) return;
    const db = createClient();
    const { error } = await db
      .from("policy_attestations")
      .insert({ tenant_id: tenantId, policy_version_id: surum.id, attesting_user: kullaniciId });
    if (error) setHata(error.message);
    await yukle();
  }, [surum, kullaniciId, tenantId, yukle]);

  if (!belge || !surum) {
    return <div className="p-2 text-sm text-muted-foreground">Yükleniyor…</div>;
  }

  const duzenlenebilir = surum.durum === "DRAFT";
  const bugun = new Date().toISOString().slice(0, 10);
  const hazirlayanBenMiyim = surum.hazirlayan === kullaniciId;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/politikalar" className="text-sm text-muted-foreground hover:underline">
          ← Politikalar
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {belge.kod} — {belge.baslik}
          </h1>
          <StatusBadge durum={DURUM_ETIKET[surum.durum]?.semantik ?? "neutral"}>
            {DURUM_ETIKET[surum.durum]?.etiket ?? surum.durum} · v{surum.surum}
          </StatusBadge>
        </div>
        {surum.effective_from ? (
          <p className="text-xs text-muted-foreground">Yürürlük: {surum.effective_from}</p>
        ) : null}
      </div>

      {hata ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {hata}
        </p>
      ) : null}

      {/* Durum eylemleri */}
      <div className="flex flex-wrap gap-2">
        {surum.durum === "DRAFT" ? (
          <Button size="sm" onClick={() => void durumGecis("incelemeye_al")} disabled={maddeler.length === 0}>
            İncelemeye Gönder
          </Button>
        ) : null}
        {surum.durum === "IN_REVIEW" ? (
          <>
            <Button size="sm" onClick={() => void onayla()} title={hazirlayanBenMiyim ? "Hazırlayan kendi sürümünü onaylayamaz" : undefined}>
              Onayla
            </Button>
            <Button size="sm" variant="outline" onClick={() => void durumGecis("geri_gonder")}>
              Geri Gönder
            </Button>
          </>
        ) : null}
        {surum.durum === "APPROVED" ? (
          <Button size="sm" onClick={() => void durumGecis("yururluge_al", bugun)}>
            Yürürlüğe Al
          </Button>
        ) : null}
        {surum.durum === "EFFECTIVE" ? (
          <>
            <Button size="sm" variant={attestVar ? "outline" : "default"} disabled={attestVar} onClick={() => void attestEt()}>
              {attestVar ? "Okundu ✓" : "Okudum, anladım"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void durumGecis("emekliye_ayir")}>
              Emekliye Ayır
            </Button>
          </>
        ) : null}
      </div>

      {/* Maddeler */}
      <Card>
        <CardHeader>
          <CardTitle>Maddeler ({maddeler.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {maddeler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz madde yok.</p>
          ) : (
            maddeler.map((m) => (
              <div key={m.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{m.madde_ref}</p>
                <p className="mt-1 text-sm text-muted-foreground">{m.metin}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.baglar.map((b) => (
                    <StatusBadge key={b.id} durum="info">
                      {b.etiket}
                    </StatusBadge>
                  ))}
                  {m.baglar.length === 0 ? <span className="text-xs text-muted-foreground">Bağ yok</span> : null}
                </div>
                {duzenlenebilir ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select
                      aria-label={`${m.madde_ref} hükme bağla`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) void bagla(m.id, "provision", e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Hükme bağla…</option>
                      {hukumler.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.ref}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`${m.madde_ref} kontrole bağla`}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) void bagla(m.id, "control", e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Kontrole bağla…</option>
                      {kontroller.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.ref}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {duzenlenebilir ? (
            <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="madde-ref">Madde referansı</Label>
                <Input id="madde-ref" value={yeniRef} onChange={(e) => setYeniRef(e.target.value)} placeholder="md. 1" className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="madde-metin">Metin</Label>
                <Textarea id="madde-metin" value={yeniMetin} onChange={(e) => setYeniMetin(e.target.value)} rows={2} />
              </div>
              <Button size="sm" className="w-fit" onClick={() => void maddeEkle()} disabled={!yeniRef.trim() || !yeniMetin.trim()}>
                Madde Ekle
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bu sürüm {DURUM_ETIKET[surum.durum]?.etiket.toLowerCase()} — maddeler salt-okunur (değişiklik yeni sürüm gerektirir).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Onaylar */}
      {onaylar.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Onaylar ({onaylar.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {onaylar.map((o, i) => (
              <StatusBadge key={i} durum={o.karar === "APPROVE" ? "success" : "danger"}>
                {o.ad}: {o.karar === "APPROVE" ? "Onayladı" : "Reddetti"}
              </StatusBadge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Audit zinciri */}
      <Card>
        <CardHeader>
          <CardTitle>Denetim izi ({audit.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            <ol className="flex flex-col gap-1 text-sm">
              {audit.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("tr-TR")}
                  </span>
                  <span>{a.eylem}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
