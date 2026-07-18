// Koşu sitasyon paketi (V2 PR-4b adım 5, M24): bir test koşusundan taşınabilir
// citation/evidence bundle üretir — kaynak künyesi, hüküm yolu + alıntı,
// artifact SHA-256, doğrulama durumları, applicability gerekçesi, sonuç, kanıt
// referansı, audit olayları, aktör. Paket İMZASIZDIR (hash bütünlüklü) ve
// bağımsız CLI ile doğrulanır: `npx tsx scripts/verify-sitasyon.ts <json>`.
//
// SERVICE_ROLE YOK: her şey kullanıcının kendi RLS oturumuyla okunur — global
// hukuk verisi authenticated'a açık, koşu/karar/kanıt/audit kiracıya kilitli.
// denetci_misafir de paket alabilir (salt-okur ihracat tam onun işi).
import { NextResponse } from "next/server";
import {
  hukumSnippet,
  sitasyonPaketiOlustur,
  type SitasyonApplicability,
  type SitasyonGirdisi,
  type SitasyonKaynakHalkasi,
} from "@/lib/citation-bundle";
import type { CanonicalDeger } from "@/lib/canonical";
import { createClient } from "@/lib/supabase/server";

interface ZincirSatiri {
  id: string;
  kapsam: string;
  dogrulama_durumu: string;
  obligations: {
    id: string;
    kod: string;
    dogrulama_durumu: string;
    provisions: {
      provision_ref: string;
      metin: string;
      effective_from: string;
      effective_to: string | null;
      source_artifacts: {
        baslik: string;
        sha256: string;
        regulatory_sources: {
          authority: string;
          ad: string;
          jurisdiction: string;
          kaynak_seviyesi: string;
          canonical_url: string | null;
        };
      };
    };
  };
}

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Koşu — RLS başka kiracının koşusunu zaten göstermez.
  const { data: run } = await db
    .from("test_runs")
    .select(
      `id, sonuc, gerekce, calisti_at, control_id, evidence_id,
       control_test_definitions (ad),
       controls (madde_ref, baslik)`,
    )
    .eq("id", runId)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ hata: "Koşu bulunamadı." }, { status: 404 });
  }

  // Dayanak fotoğrafı — eski koşularda olmayabilir; UYDURULMAZ (null kalır).
  const { data: foto } = await db
    .from("execution_legal_snapshots")
    .select("karar, snapshot")
    .eq("test_run_id", runId)
    .maybeSingle();

  // Kaynak zinciri: koşunun kontrolüne bağlı güncel eşlemeler (REJECTED hariç —
  // geri çekilmiş iddia sitasyona girmez).
  const { data: zincirHam } = await db
    .from("obligation_control_mappings")
    .select(
      `id, kapsam, dogrulama_durumu,
       obligations!inner (id, kod, dogrulama_durumu,
         provisions!inner (provision_ref, metin, effective_from, effective_to,
           source_artifacts!inner (baslik, sha256,
             regulatory_sources!inner (authority, ad, jurisdiction, kaynak_seviyesi, canonical_url))))`,
    )
    .eq("control_id", run.control_id)
    .neq("dogrulama_durumu", "REJECTED");
  const zincir = (zincirHam ?? []) as unknown as ZincirSatiri[];

  const kaynakZinciri: SitasyonKaynakHalkasi[] = zincir.map((m) => ({
    authority: m.obligations.provisions.source_artifacts.regulatory_sources.authority,
    kaynakAd: m.obligations.provisions.source_artifacts.regulatory_sources.ad,
    jurisdiction: m.obligations.provisions.source_artifacts.regulatory_sources.jurisdiction,
    kaynakSeviyesi: m.obligations.provisions.source_artifacts.regulatory_sources.kaynak_seviyesi,
    canonicalUrl: m.obligations.provisions.source_artifacts.regulatory_sources.canonical_url,
    artifactBaslik: m.obligations.provisions.source_artifacts.baslik,
    artifactSha256: m.obligations.provisions.source_artifacts.sha256,
    provisionRef: m.obligations.provisions.provision_ref,
    effectiveFrom: m.obligations.provisions.effective_from,
    effectiveTo: m.obligations.provisions.effective_to,
    provisionDogrulama: "", // aşağıda hüküm doğrulaması ayrıca çekilmez — hüküm
    // durumunu obligations zinciri taşımıyor; alan provisions'tan doldurulur.
    snippet: hukumSnippet(m.obligations.provisions.metin),
    obligationKod: m.obligations.kod,
    obligationDogrulama: m.obligations.dogrulama_durumu,
    mappingDogrulama: m.dogrulama_durumu,
    kapsam: m.kapsam,
  }));

  // Hüküm doğrulama durumu ayrı sorguyla (nested select'te dogrulama_durumu
  // çakışan ad — üç tabloda da var; net olsun diye ref üzerinden eşle).
  const { data: hukumler } = await db
    .from("provisions")
    .select("provision_ref, dogrulama_durumu, source_artifacts!inner (sha256)")
    .in("provision_ref", kaynakZinciri.map((k) => k.provisionRef));
  for (const k of kaynakZinciri) {
    const h = (hukumler ?? []).find(
      (p) =>
        p.provision_ref === k.provisionRef &&
        (p.source_artifacts as unknown as { sha256: string }).sha256 === k.artifactSha256,
    );
    k.provisionDogrulama = h?.dogrulama_durumu ?? "BILINMIYOR";
  }

  // Uygulanabilirlik: güncel kararlar (kiracı RLS'i zaten sınırlar).
  const oblIds = zincir.map((m) => m.obligations.id);
  const { data: kararlar } = oblIds.length
    ? await db
        .from("applicability_decisions")
        .select("id, obligation_id, durum, gerekce, fact_snapshot_fingerprint, karar_kaynagi")
        .in("obligation_id", oblIds)
        .is("superseded_at", null)
    : { data: [] };
  const applicability: SitasyonApplicability[] = (kararlar ?? []).map((k) => ({
    obligationKod: zincir.find((m) => m.obligations.id === k.obligation_id)?.obligations.kod ?? "?",
    durum: k.durum,
    gerekce: k.gerekce,
    factSnapshotFingerprint: k.fact_snapshot_fingerprint,
    kararKaynagi: k.karar_kaynagi,
  }));

  // Karar audit olayları (içerik değil, eylem+zaman — kural 7).
  const kararIds = (kararlar ?? []).map((k) => k.id);
  const { data: audit } = kararIds.length
    ? await db
        .from("audit_log")
        .select("eylem, created_at")
        .eq("hedef_tablo", "applicability_decisions")
        .in("hedef_id", kararIds)
    : { data: [] };

  // Kanıt referansı (varsa): id + dosya hash'i (adı neyi doğruladığını söyler).
  let kanit: SitasyonGirdisi["kanit"] = null;
  if (run.evidence_id) {
    const { data: ev } = await db
      .from("evidences")
      .select("id, hash_sha256")
      .eq("id", run.evidence_id)
      .maybeSingle();
    if (ev) kanit = { evidenceId: ev.id, dosyaHashSha256: ev.hash_sha256 };
  }

  const paket = await sitasyonPaketiOlustur({
    testRun: {
      id: run.id,
      sonuc: run.sonuc,
      gerekce: run.gerekce,
      calistiAt: run.calisti_at,
      tanimAd: (run.control_test_definitions as unknown as { ad: string }).ad,
      kontrolMaddeRef: (run.controls as unknown as { madde_ref: string }).madde_ref,
      kontrolBaslik: (run.controls as unknown as { baslik: string }).baslik,
    },
    legalSnapshot: foto ? { karar: foto.karar, snapshot: foto.snapshot as CanonicalDeger } : null,
    kaynakZinciri,
    applicability,
    kanit,
    auditOlaylari: (audit ?? []).map((a) => ({ eylem: a.eylem, zaman: a.created_at })),
    aktor: { id: user.id, ad: profil?.full_name ?? null },
    olusturmaZamani: new Date().toISOString(),
  });

  return NextResponse.json(paket);
}
