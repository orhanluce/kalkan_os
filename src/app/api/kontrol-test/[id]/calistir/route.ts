// Bir kontrol testini çalıştırır: gözlemi değerlendirir, test_run yazar ve
// başarısızsa bulgu ÖNERİSİ üretir (docs/ROADMAP.md M12, kural 11 + 13).
//
// NEDEN SERVICE_ROLE YOK: test_run ve öneri INSERT'leri kullanıcının KENDİ
// oturumuyla yapılır — RLS `tenant_id = current_tenant_id()` ile kiracı sınırını
// zaten zorluyor ve audit izinin eylemi doğru kişiye ataması için insan
// oturumu gerekiyor. Yalnızca öneri KARARI (KABUL/RET) service_role ister; o
// ayrı rotada (oneri/[oneriId]).
//
// KURAL 13 BURADA DA GEÇERLİ: sonucu motor belirler (testDegerlendir), rota
// değil. Toplama arızası gelirse motor UNKNOWN üretir, rota bunu FAILED'e
// çeviremez — durum sözlüğü tek yerde (control-test.ts).
import { NextResponse } from "next/server";
import {
  bulguOnerisiUret,
  testDegerlendir,
  type Gozlem,
  type TestTanimi,
  type TestTuru,
} from "@/lib/control-test";
import type { CanonicalDeger } from "@/lib/canonical";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: tanimId } = await ctx.params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db
    .from("profiles")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  // denetci_misafir salt-okunur bir roldür: test koşturamaz.
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Test çalıştırma yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }

  // RLS altında oku: başka kiracının test tanımı burada zaten görünmez.
  const { data: tanim } = await db
    .from("control_test_definitions")
    .select("id, tenant_id, control_id, tur, ad, tazelik_gun, beklenen, otomatik_bulgu, basarisizlik_onem, tanim_surumu")
    .eq("id", tanimId)
    .maybeSingle();
  if (!tanim) {
    return NextResponse.json({ hata: "Test tanımı bulunamadı." }, { status: 404 });
  }

  const govde = (await req.json().catch(() => ({}))) as {
    toplamaBasarisiz?: boolean;
    toplamaHatasi?: string | null;
    gozlemZamani?: string | null;
    istisnaKabul?: boolean;
    gozlenenDeger?: CanonicalDeger;
    iddiaKarsilandi?: boolean | null;
    evidenceId?: string | null;
  };

  const gozlem: Gozlem = {
    toplamaBasarisiz: govde.toplamaBasarisiz ?? false,
    toplamaHatasi: govde.toplamaHatasi ?? null,
    gozlemZamani: govde.gozlemZamani ?? null,
    istisnaKabul: govde.istisnaKabul ?? false,
    gozlenenDeger: govde.gozlenenDeger,
    iddiaKarsilandi: govde.iddiaKarsilandi ?? null,
  };

  const tanimModel: TestTanimi = {
    tur: tanim.tur as TestTuru,
    tazelikGun: tanim.tazelik_gun,
    beklenen: (tanim.beklenen as CanonicalDeger | null) ?? undefined,
  };

  // Sonucu MOTOR belirler — deterministik (kural 11). asOf = şimdi; tazelik
  // bununla hesaplanır ve gözlemle birlikte test_run'a yazılır, böylece aynı
  // gözlem + aynı tanım sürümü yeniden hesaplandığında aynı sonucu verir.
  const sonuc = testDegerlendir(tanimModel, gozlem, new Date());

  const { data: run, error: runErr } = await db
    .from("test_runs")
    .insert({
      tenant_id: tanim.tenant_id,
      test_definition_id: tanim.id,
      control_id: tanim.control_id,
      sonuc: sonuc.sonuc,
      gerekce: sonuc.gerekce,
      gozlem: gozlem as unknown as Json,
      tanim_surumu: tanim.tanim_surumu,
      evidence_id: govde.evidenceId ?? null,
    })
    .select("id")
    .single();
  if (runErr) {
    return NextResponse.json({ hata: runErr.message }, { status: 500 });
  }

  // Başarısızlık → bulgu ÖNERİSİ (PROPOSED). Motor UNKNOWN/STALE'de null
  // döner — "ölçemedik" iş listesine sahte bulgu sokmaz (kural 11).
  let oneriId: string | null = null;
  const oneri = bulguOnerisiUret(
    {
      ad: tanim.ad,
      otomatikBulgu: tanim.otomatik_bulgu,
      basarisizlikOnem: tanim.basarisizlik_onem as "acil" | "kritik" | "yuksek" | "orta" | "dusuk",
    },
    sonuc,
  );
  if (oneri) {
    const { data: prop, error: propErr } = await db
      .from("control_test_finding_proposals")
      .insert({
        test_run_id: run.id,
        test_definition_id: tanim.id,
        tenant_id: tanim.tenant_id,
        control_id: tanim.control_id,
        baslik: oneri.baslik,
        gerekce: oneri.gerekce,
        onem: oneri.onem,
      })
      .select("id")
      .single();
    if (propErr) {
      return NextResponse.json({ hata: propErr.message }, { status: 500 });
    }
    oneriId = prop.id;
  }

  return NextResponse.json({
    testRunId: run.id,
    sonuc: sonuc.sonuc,
    gerekce: sonuc.gerekce,
    oneriId,
  });
}
