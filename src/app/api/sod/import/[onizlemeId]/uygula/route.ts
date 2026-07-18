// SoD atama içe aktarma — ATOMİK APPLY (docs/ROADMAP.md M16 PR-3B).
//
// PR-3A önizlemeyi (dry-run) üretti; bu rota onu ATAMAYA çevirir. İki koruma:
//   (1) STALE 409: apply'dan önce güncel atama snapshot + kural seti hash'i
//       YENİDEN hesaplanır; önizleme anındakinden farklıysa (onizlemeBayatMi)
//       eski önizleme uygulanamaz — 409 IMPORT_PREVIEW_STALE, önizleme STALE'e
//       taşınır. (Kullanıcı yeni bir dry-run almalı.)
//   (2) ATOMİK: gerçek yazım tek bir plpgsql fonksiyonunda (sod_import_uygula)
//       = tek transaction. Ekle/güncelle/sona-erdir + manifest + outbox +
//       önizleme durumu ya hep birlikte ya hiç.
//
// NEDEN service_role RPC: apply çok-tablolu ATOMİK bir işlem; istemci
// client'ıyla ayrı ayrı çağrılar atomik olmaz. Fonksiyon security definer'dır
// (RLS bypass) — bu yüzden rota ÖNCE önizlemeyi RLS ALTINDA kendi kiracısında
// okuyarak yetkilendirir (başka kiracının önizlemesi burada zaten görünmez),
// SONRA service_role ile RPC çağırır. Fonksiyonun execute yetkisi de
// authenticated/anon'dan revoke edildi (doğrudan çağrı ile tenant atlama yok).
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  importManifestHash,
  onizlemeBayatMi,
  type ImportDiff,
  type ImportMode,
} from "@/lib/sod-import";
import { atamaSnapshotHash, kuralSetiHash, type SodAtama, type SodKural } from "@/lib/sod";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ onizlemeId: string }> }) {
  const { onizlemeId } = await ctx.params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "İçe aktarma uygulama yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }
  // NOT: tenant sınırı RLS'ten gelir — önizleme/atama/kural okumaları zaten bu
  // kullanıcının kiracısıyla sınırlı; RPC de tenant'ı önizlemeden okur.

  // RLS altında oku: başka kiracının önizlemesi burada zaten görünmez (IDOR yok).
  const { data: onizleme } = await db
    .from("sod_import_onizlemeleri")
    .select(
      "id, kaynak, mode, durum, file_hash, normalized_records_hash, assignment_snapshot_hash, rule_set_version, diff",
    )
    .eq("id", onizlemeId)
    .maybeSingle();
  if (!onizleme) {
    return NextResponse.json({ hata: "Önizleme bulunamadı." }, { status: 404 });
  }
  if (onizleme.durum !== "READY_FOR_REVIEW") {
    return NextResponse.json(
      { hata: `Bu önizleme uygulanabilir durumda değil (${onizleme.durum}).`, kod: "ONIZLEME_UYGULANAMAZ" },
      { status: 409 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });

  // --- Güncel durumdan hash'leri YENİDEN hesapla (stale kontrolü) ---
  const [{ data: atamalarRow }, { data: kurallarRow }, { data: taraflarRow }] = await Promise.all([
    db.from("sod_atamalari").select("kullanici_id, harici_kullanici_id, aktivite_kodu, rol_kodu, sistem_kapsami"),
    db.from("sod_kurallari").select("id, durum, onem").eq("durum", "aktif"),
    db.from("sod_kural_taraflari").select("rule_id, taraf, aktivite_kodu, rol_kodu, sistem_kapsami"),
  ]);

  const mevcutSodAtamalar: SodAtama[] = (atamalarRow ?? []).map((a) => ({
    kisiKimligi: a.kullanici_id ?? a.harici_kullanici_id ?? "BILINMEYEN",
    aktivite_kodu: a.aktivite_kodu,
    rol_kodu: a.rol_kodu,
    sistem_kapsami: a.sistem_kapsami,
  }));

  type TarafRow = { rule_id: string; taraf: string; aktivite_kodu: string; rol_kodu: string | null; sistem_kapsami: string | null };
  const taraflarByRule = new Map<string, { A?: TarafRow; B?: TarafRow }>();
  for (const t of taraflarRow ?? []) {
    const giris = taraflarByRule.get(t.rule_id) ?? {};
    if (t.taraf === "A") giris.A = t as TarafRow;
    else giris.B = t as TarafRow;
    taraflarByRule.set(t.rule_id, giris);
  }
  const kurallar: SodKural[] = (kurallarRow ?? [])
    .map((k) => {
      const taraflar = taraflarByRule.get(k.id);
      if (!taraflar?.A || !taraflar?.B) return null;
      return {
        id: k.id,
        kod: k.id,
        durum: k.durum as "aktif" | "pasif",
        onem: k.onem as SodKural["onem"],
        tarafA: { aktivite_kodu: taraflar.A.aktivite_kodu, rol_kodu: taraflar.A.rol_kodu, sistem_kapsami: taraflar.A.sistem_kapsami },
        tarafB: { aktivite_kodu: taraflar.B.aktivite_kodu, rol_kodu: taraflar.B.rol_kodu, sistem_kapsami: taraflar.B.sistem_kapsami },
      };
    })
    .filter((k): k is SodKural => k !== null);

  const guncelSnapshot = await atamaSnapshotHash(mevcutSodAtamalar);
  const guncelRuleSet = await kuralSetiHash(kurallar);

  if (
    onizlemeBayatMi(
      onizleme.assignment_snapshot_hash,
      guncelSnapshot,
      onizleme.rule_set_version,
      guncelRuleSet,
    )
  ) {
    // Eski önizleme bayat: STALE'e taşı (service_role — istemci UPDATE edemez).
    await admin.from("sod_import_onizlemeleri").update({ durum: "STALE" }).eq("id", onizlemeId);
    return NextResponse.json(
      {
        hata: "Atamalar veya kurallar önizlemeden bu yana değişti; yeni bir dry-run alın.",
        kod: "IMPORT_PREVIEW_STALE",
      },
      { status: 409 },
    );
  }

  // --- Manifest hash (uygulanacak kararın mührü) ---
  const diff = (onizleme.diff ?? {}) as unknown as ImportDiff;
  const eklenen = diff.eklenecek?.length ?? 0;
  const guncellenen = diff.guncellenecek?.length ?? 0;
  const sonaErdirilen = diff.sonaErdirilecek?.length ?? 0;
  const manifestHash = await importManifestHash({
    onizlemeId: onizleme.id,
    kaynak: onizleme.kaynak,
    mode: onizleme.mode as ImportMode,
    fileHash: onizleme.file_hash,
    normalizedRecordsHash: onizleme.normalized_records_hash,
    assignmentSnapshotHash: onizleme.assignment_snapshot_hash,
    ruleSetVersion: onizleme.rule_set_version,
    eklenen,
    guncellenen,
    sonaErdirilen,
  });

  // --- ATOMİK APPLY (service_role RPC) ---
  const { data: sonuc, error: rpcErr } = await admin.rpc("sod_import_uygula", {
    p_onizleme_id: onizlemeId,
    p_actor: user.id,
    p_guncel_atama_snapshot_hash: guncelSnapshot,
    p_guncel_rule_set_version: guncelRuleSet,
    p_manifest_hash: manifestHash,
  });

  if (rpcErr) {
    const mesaj = rpcErr.message ?? "";
    if (mesaj.includes("IMPORT_PREVIEW_STALE")) {
      await admin.from("sod_import_onizlemeleri").update({ durum: "STALE" }).eq("id", onizlemeId);
      return NextResponse.json({ hata: "Önizleme bayat.", kod: "IMPORT_PREVIEW_STALE" }, { status: 409 });
    }
    if (mesaj.includes("ONIZLEME_UYGULANAMAZ")) {
      return NextResponse.json({ hata: mesaj, kod: "ONIZLEME_UYGULANAMAZ" }, { status: 409 });
    }
    return NextResponse.json({ hata: mesaj || "İçe aktarma uygulanamadı." }, { status: 500 });
  }

  const ozet = (sonuc ?? {}) as {
    manifest_id?: string;
    eklenen?: number;
    guncellenen?: number;
    sona_erdirilen?: number;
  };

  return NextResponse.json({
    uygulandi: true,
    onizlemeId,
    manifestId: ozet.manifest_id,
    ozet: {
      eklenen: ozet.eklenen ?? 0,
      guncellenen: ozet.guncellenen ?? 0,
      sonaErdirilen: ozet.sona_erdirilen ?? 0,
    },
    // Outbox olayı yazıldı; değerlendirme drenajla (POST /api/sod/outbox/isle) koşar.
    degerlendirmeBeklemede: true,
  });
}
