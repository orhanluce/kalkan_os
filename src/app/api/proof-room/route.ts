// Proof Room linki oluşturma/iptal (G1 kapanış dilimi).
//
// SERVICE_ROLE YOK: her şey kullanıcının kendi oturumuyla — RLS zaten
// kiracıyı ve rolü (admin/uyum insert policy) zorluyor; rota yalnız akışı
// sürer ve dürüst hata döndürür. Koşu, RLS altında okunur: başka kiracının
// koşusu GÖRÜNMEZ (404) — link kurulamaz.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const govde = (await req.json().catch(() => ({}))) as {
    eylem?: "olustur" | "iptal";
    testRunId?: string;
    roiExportRunId?: string;
    graphSnapshotId?: string;
    cloudAssuranceProfileId?: string;
    kritikHizmetTestPaketiSnapshotId?: string;
    linkId?: string;
    gecerlilikGun?: number;
  };

  if (govde.eylem === "iptal") {
    if (!govde.linkId) {
      return NextResponse.json({ hata: "linkId zorunlu." }, { status: 400 });
    }
    const { data, error } = await db
      .from("proof_room_links")
      .update({ iptal_edildi: true })
      .eq("id", govde.linkId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ hata: "Link bulunamadı ya da yetki yok." }, { status: 404 });
    }
    return NextResponse.json({ iptal: true });
  }

  if (
    !govde.testRunId &&
    !govde.roiExportRunId &&
    !govde.graphSnapshotId &&
    !govde.cloudAssuranceProfileId &&
    !govde.kritikHizmetTestPaketiSnapshotId
  ) {
    return NextResponse.json(
      { hata: "testRunId, roiExportRunId, graphSnapshotId, cloudAssuranceProfileId veya kritikHizmetTestPaketiSnapshotId zorunlu." },
      { status: 400 },
    );
  }

  const gun = Math.min(Math.max(govde.gecerlilikGun ?? 7, 1), 90);
  const sonGecerlilik = new Date(Date.now() + gun * 24 * 60 * 60 * 1000).toISOString();

  let tenantId: string;
  const govdeYaz: {
    tenant_id: string;
    olusturan: string;
    son_gecerlilik: string;
    test_run_id?: string;
    roi_export_run_id?: string;
    graph_snapshot_id?: string;
    cloud_assurance_profile_id?: string;
    kritik_hizmet_test_paketi_snapshot_id?: string;
  } = {
    tenant_id: "",
    olusturan: user.id,
    son_gecerlilik: sonGecerlilik,
  };

  if (govde.testRunId) {
    // RLS: başka kiracının koşusu burada zaten görünmez.
    const { data: kosu } = await db.from("test_runs").select("id, tenant_id").eq("id", govde.testRunId).maybeSingle();
    if (!kosu) {
      return NextResponse.json({ hata: "Koşu bulunamadı." }, { status: 404 });
    }
    tenantId = kosu.tenant_id;
    govdeYaz.test_run_id = kosu.id;
  } else if (govde.roiExportRunId) {
    // Yalnız YAYINLANDI export'lar için link kurulabilir (ADR §5 — bloke
    // varken export zaten YAYINLANDI olamaz, bu ayrıca bir kontrol GEREKMEZ).
    const { data: exportKaydi } = await db.from("roi_export_runs").select("id, tenant_id, durum").eq("id", govde.roiExportRunId).eq("durum", "YAYINLANDI").maybeSingle();
    if (!exportKaydi) {
      return NextResponse.json({ hata: "Export bulunamadı ya da henüz yayınlanmadı." }, { status: 404 });
    }
    tenantId = exportKaydi.tenant_id;
    govdeYaz.roi_export_run_id = exportKaydi.id;
  } else if (govde.graphSnapshotId) {
    // RLS: başka kiracının anlık görüntüsü burada zaten görünmez.
    const { data: snapshot } = await db.from("impact_graph_snapshots").select("id, tenant_id").eq("id", govde.graphSnapshotId).maybeSingle();
    if (!snapshot) {
      return NextResponse.json({ hata: "Anlık görüntü bulunamadı." }, { status: 404 });
    }
    tenantId = snapshot.tenant_id;
    govdeYaz.graph_snapshot_id = snapshot.id;
  } else if (govde.cloudAssuranceProfileId) {
    // RLS: başka kiracının güvence profili burada zaten görünmez.
    const { data: profil } = await db.from("cloud_assurance_profile_snapshots").select("id, tenant_id").eq("id", govde.cloudAssuranceProfileId).maybeSingle();
    if (!profil) {
      return NextResponse.json({ hata: "Güvence profili bulunamadı." }, { status: 404 });
    }
    tenantId = profil.tenant_id;
    govdeYaz.cloud_assurance_profile_id = profil.id;
  } else {
    // RLS: başka kiracının test paketi burada zaten görünmez.
    const { data: paket } = await db
      .from("kritik_hizmet_test_paketi_snapshots")
      .select("id, tenant_id")
      .eq("id", govde.kritikHizmetTestPaketiSnapshotId!)
      .maybeSingle();
    if (!paket) {
      return NextResponse.json({ hata: "Test paketi bulunamadı." }, { status: 404 });
    }
    tenantId = paket.tenant_id;
    govdeYaz.kritik_hizmet_test_paketi_snapshot_id = paket.id;
  }
  govdeYaz.tenant_id = tenantId;

  const { data: link, error } = await db.from("proof_room_links").insert(govdeYaz).select("id, token, son_gecerlilik").single();
  if (error) {
    // RLS reddi (ör. denetci_misafir) iş kuralıdır.
    return NextResponse.json({ hata: "Proof Room linki oluşturulamadı (yetki)." }, { status: 403 });
  }
  return NextResponse.json({
    linkId: link.id,
    token: link.token,
    url: `/proof/${link.token}`,
    sonGecerlilik: link.son_gecerlilik,
  });
}
