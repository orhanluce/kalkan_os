// Dikey E, E1 (docs/adr/PR0-dikeyE1-cloud-tedarikci-guvence-2026-07-20.md):
// bulut/tedarikçi güvence profili — GET önizler (mühürlemez), POST mühürler
// (cloud_assurance_profile_snapshots). Session client RLS altında okur;
// snapshot INSERT'i de session client'la (tablonun kendi RLS policy'si
// admin/uyum yazabilir — impact_graph_snapshots'ın AYNI deseni, service_role
// gerekmez, kimlik/cross-tenant guard'lar zaten DB trigger'ında).
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import {
  guvenceProfiliHesapla,
  type GuvenceProfiliGirdisi,
  type GuvenceSorusuGirdisi,
  type KategoriKodu,
  type KaynakTuru,
  type SablonDogrulamaDurumu,
} from "@/lib/cloud-assurance";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

async function girdiVeContractIdCozumle(
  db: Awaited<ReturnType<typeof createClient>>,
  thirdPartyId: string,
  istenenContractId: string | null,
): Promise<{ girdi: GuvenceProfiliGirdisi; contractId: string | null } | null> {
  const { data: tp } = await db.from("third_parties").select("id").eq("id", thirdPartyId).maybeSingle();
  if (!tp) return null;

  const [{ data: assessments }, { data: contracts }] = await Promise.all([
    db.from("third_party_assessments").select("id").eq("third_party_id", thirdPartyId),
    db.from("third_party_contracts").select("id, durum").eq("third_party_id", thirdPartyId),
  ]);

  let contractId: string | null = istenenContractId;
  if (contractId) {
    if (!(contracts ?? []).some((c) => c.id === contractId)) contractId = null; // istenen ait değilse UYDURULMAZ, null kalır (SOZLESME_EKSIK).
  } else {
    // Otomatik seçim yalnız TEK bir AKTİF sözleşme varsa yapılır — birden
    // fazla/hiç AKTİF sözleşme varken TAHMİN EDİLMEZ (SOZLESME_EKSIK ile
    // dürüstçe raporlanır, ADR §6 disiplini).
    const aktifler = (contracts ?? []).filter((c) => c.durum === "AKTIF");
    contractId = aktifler.length === 1 ? aktifler[0].id : null;
  }

  const assessmentIds = (assessments ?? []).map((a) => a.id);

  const [{ data: questions }, { data: acikKritikBulgular }] = await Promise.all([
    assessmentIds.length > 0
      ? db
          .from("assessment_questions")
          .select(
            "id, cevap, uygulanabilirlik, kaynak_turu, template_id, assessment_question_templates (kategori, dogrulama_durumu)",
          )
          .in("assessment_id", assessmentIds)
      : Promise.resolve({ data: [] as never[] }),
    db
      .from("assessment_findings")
      .select("id, baslik")
      .eq("third_party_id", thirdPartyId)
      .eq("ciddiyet", "KRITIK")
      .neq("durum", "KAPANDI"),
  ]);

  const sorular: GuvenceSorusuGirdisi[] = (questions ?? []).map((q) => {
    const sablon = q.assessment_question_templates as unknown as { kategori: string | null; dogrulama_durumu: string } | null;
    return {
      id: q.id,
      kategori: (sablon?.kategori as KategoriKodu | null) ?? null,
      cevap: q.cevap,
      uygulanabilirlik: q.uygulanabilirlik as GuvenceSorusuGirdisi["uygulanabilirlik"],
      kaynakTuru: q.kaynak_turu as KaynakTuru,
      sablonDogrulamaDurumu: q.template_id ? ((sablon?.dogrulama_durumu as SablonDogrulamaDurumu | null) ?? null) : null,
    };
  });

  const girdi: GuvenceProfiliGirdisi = {
    asOf: new Date().toISOString(),
    thirdPartyId,
    contractId,
    sorular,
    acikKritikBulgular: (acikKritikBulgular ?? []).map((f) => ({ id: f.id, baslik: f.baslik })),
  };

  return { girdi, contractId };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: thirdPartyId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const url = new URL(req.url);
  const cozum = await girdiVeContractIdCozumle(db, thirdPartyId, url.searchParams.get("contractId"));
  if (!cozum) return NextResponse.json({ hata: "Tedarikçi bulunamadı." }, { status: 404 });

  const sonuc = guvenceProfiliHesapla(cozum.girdi);
  return NextResponse.json({ onizleme: true, profil: sonuc });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: thirdPartyId } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  const { data: profilRow } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profilRow?.role !== "admin" && profilRow?.role !== "uyum") {
    return NextResponse.json({ hata: "Güvence profili mühürlemek admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profilRow.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  let body: { contractId?: string; roiExportRunId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Gövde boş olabilir — tüm alanlar opsiyonel.
  }

  const cozum = await girdiVeContractIdCozumle(db, thirdPartyId, body.contractId ?? null);
  if (!cozum) return NextResponse.json({ hata: "Tedarikçi bulunamadı." }, { status: 404 });

  // roiExportRunId istemciden verilir ama tenant/geçerlilik doğrulaması DB
  // trigger'ında (cross-tenant guard) — istemci iddiası körü körüne güvenilmez.
  const sonuc = guvenceProfiliHesapla(cozum.girdi);
  const profilHash = await canonicalHash(sonuc as unknown as CanonicalDeger);

  const { data: kayit, error } = await db
    .from("cloud_assurance_profile_snapshots")
    .insert({
      tenant_id: profilRow.tenant_id,
      third_party_id: thirdPartyId,
      third_party_contract_id: cozum.contractId,
      profil: sonuc as unknown as Json,
      profil_hash: profilHash,
      hesaplama_yontemi: sonuc.hesaplamaYontemi as unknown as Json,
      iliskili_roi_export_run_id: body.roiExportRunId ?? null,
    })
    .select("id, profil_hash, created_at")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Güvence profili mühürlenemedi." }, { status: 403 });
  }

  return NextResponse.json({
    id: kayit.id,
    profilHash: kayit.profil_hash,
    olusturulmaZamani: kayit.created_at,
    profil: sonuc,
  });
}
