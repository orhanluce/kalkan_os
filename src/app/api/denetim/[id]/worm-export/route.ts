// Denetim WORM export mühürleme (M17 sonraki dilim son madde, ROADMAP §1.29).
// simulation_result_manifests deseninin AYNISI: rota session client'la (RLS
// altında) tenant'ın kendi verisini okur, paketi src/lib/audit-worm-export.ts
// ile kurar, sonra service_role ile MÜHÜRLER (istemci audit_worm_exports'a
// yazamaz — DB'de INSERT authenticated'dan revoke edilmiş, kural 11: mühür
// sistem işidir).
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { auditWormPaketiOlustur, type AuditWormGirdisi } from "@/lib/audit-worm-export";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: engagementId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "WORM export admin veya uyum rolünün işidir." }, { status: 403 });
  }

  const { data: engagement } = await db
    .from("audit_engagements")
    .select("id, tenant_id, ad, kapsam, donem, risk_seviyesi, durum")
    .eq("id", engagementId)
    .maybeSingle();
  if (!engagement) {
    return NextResponse.json({ hata: "Denetim işi bulunamadı." }, { status: 404 });
  }

  const [{ data: ornekler }, { data: workpaperlar }, { data: pbc }, { data: beyanlar }] = await Promise.all([
    db.from("audit_samples").select("yontem, populasyon_boyutu, ornek_boyutu, seed, secilen_indeksler").eq("engagement_id", engagementId),
    db.from("audit_workpapers").select("id, baslik, icerik, durum, hazirlayan, reviewer").eq("engagement_id", engagementId),
    db.from("audit_pbc_requests").select("talep_metni, son_tarih, durum, alinan_kanit, alindi_tarihi").eq("engagement_id", engagementId),
    db.from("independence_declarations").select("beyan_eden_ad, external_email, cikar_catismasi_yok, beyan_at").eq("engagement_id", engagementId),
  ]);

  const wpIds = (workpaperlar ?? []).map((w) => w.id);
  const [{ data: kBaglar }, { data: bBaglar }, { data: profiller }] = await Promise.all([
    wpIds.length > 0
      ? db.from("audit_workpaper_controls").select("workpaper_id, controls (madde_ref)").in("workpaper_id", wpIds)
      : Promise.resolve({ data: [] as { workpaper_id: string; controls: { madde_ref: string } | null }[] }),
    wpIds.length > 0
      ? db.from("audit_workpaper_findings").select("workpaper_id, findings (baslik)").in("workpaper_id", wpIds)
      : Promise.resolve({ data: [] as { workpaper_id: string; findings: { baslik: string } | null }[] }),
    db.from("profiles").select("id, full_name"),
  ]);
  const adMap = new Map((profiller ?? []).map((p) => [p.id, p.full_name]));

  const girdi: AuditWormGirdisi = {
    engagement: {
      id: engagement.id,
      ad: engagement.ad,
      kapsam: engagement.kapsam,
      donem: engagement.donem,
      riskSeviyesi: engagement.risk_seviyesi,
      durum: engagement.durum,
    },
    ornekler: (ornekler ?? []).map((o) => ({
      yontem: o.yontem,
      populasyonBoyutu: o.populasyon_boyutu,
      ornekBoyutu: o.ornek_boyutu,
      seed: o.seed,
      secilenIndeksler: o.secilen_indeksler,
    })),
    workpaperlar: (workpaperlar ?? []).map((w) => ({
      baslik: w.baslik,
      icerik: w.icerik,
      durum: w.durum,
      hazirlayanAd: w.hazirlayan ? (adMap.get(w.hazirlayan) ?? null) : null,
      reviewerAd: w.reviewer ? (adMap.get(w.reviewer) ?? null) : null,
      kontrolBaglari: (kBaglar ?? [])
        .filter((k) => k.workpaper_id === w.id)
        .map((k) => (k.controls as unknown as { madde_ref: string } | null)?.madde_ref ?? "")
        .filter(Boolean),
      bulguBaglari: (bBaglar ?? [])
        .filter((b) => b.workpaper_id === w.id)
        .map((b) => (b.findings as unknown as { baslik: string } | null)?.baslik ?? "")
        .filter(Boolean),
    })),
    pbcTalepler: (pbc ?? []).map((p) => ({
      talepMetni: p.talep_metni,
      sonTarih: p.son_tarih,
      durum: p.durum,
      alinanKanit: p.alinan_kanit,
      alindiTarihi: p.alindi_tarihi,
    })),
    beyanlar: (beyanlar ?? []).map((b) => ({
      beyanEdenAd: b.beyan_eden_ad,
      externalEmail: b.external_email,
      cikarCatismasiYok: b.cikar_catismasi_yok,
      beyanAt: b.beyan_at,
    })),
    olusturanAd: profil.full_name ?? user.email ?? user.id,
    olusturmaZamani: new Date().toISOString(),
  };

  const paket = await auditWormPaketiOlustur(girdi);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const service = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  const { data: satir, error } = await service
    .from("audit_worm_exports")
    .insert({
      tenant_id: engagement.tenant_id,
      engagement_id: engagementId,
      paket: paket as unknown as Database["public"]["Tables"]["audit_worm_exports"]["Insert"]["paket"],
      paket_hash: paket.paketHash,
      olusturan: user.id,
    })
    .select("id, seq, paket_hash, created_at")
    .single();

  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 409 });
  }
  return NextResponse.json({ id: satir.id, seq: satir.seq, paketHash: satir.paket_hash, createdAt: satir.created_at, paket });
}
