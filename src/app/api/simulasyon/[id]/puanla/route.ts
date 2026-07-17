// Tatbikatı puanlar ve bulgu önerilerini üretir (docs/ROADMAP.md M8).
//
// NEDEN SUNUCUDA: puanlama sonucunu istemci yazamaz ve yazamamalı
// (simulation_scores'a insert revoke edildi) — kullanıcı kendi puanını
// yazabilseydi tatbikatın ölçtüğü şey ortadan kalkardı (kural 11).
//
// İKİ AŞAMALI YETKİ: önce kullanıcının OTURUMUYLA (RLS altında) tatbikatı
// okuruz — göremiyorsa zaten yoktur. Sonra yalnızca yazma için service_role'e
// geçeriz. Doğrudan service_role ile başlasaydık, başka kiracının tatbikatını
// puanlama yolu açılırdı.
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { bulguOnerileriUret, puanla, type PuanlamaKurali } from "@/lib/scoring";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: runId } = await ctx.params;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  // RLS altında oku: başka kiracının tatbikatı burada zaten görünmez.
  const { data: run } = await db
    .from("simulation_runs")
    .select("id, tenant_id, version_id, durum")
    .eq("id", runId)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ hata: "Tatbikat bulunamadı." }, { status: 404 });
  }

  const { data: katilim } = await db
    .from("simulation_participants")
    .select("katilim_tipi")
    .eq("run_id", runId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (katilim?.katilim_tipi !== "yonetici") {
    return NextResponse.json({ hata: "Puanlama yalnızca tatbikat yöneticisinin işidir." }, { status: 403 });
  }

  // Durum makinesi zaten bunu zorluyor; burada erken ve anlaşılır hata veriyoruz.
  if (run.durum !== "tamamlandi") {
    return NextResponse.json(
      { hata: `Puanlama yalnızca tamamlanmış tatbikatta yapılır (durum: ${run.durum}).` },
      { status: 409 },
    );
  }

  // --- Puanlama girdisi: hepsi kullanıcının okuyabildiği veriden ---
  const [{ data: kurallarRow }, { data: aksiyonlarRow }, { data: sonuclarRow }, { data: kararlarRow }] =
    await Promise.all([
      db
        .from("scenario_scoring_rules")
        .select("kod, tip, bilesen, agirlik, aciklama, parametreler, expected_action_id")
        .eq("version_id", run.version_id),
      db.from("scenario_expected_actions").select("id, kod").eq("version_id", run.version_id),
      db
        .from("simulation_action_results")
        .select("expected_action_id, tamamlandi, senaryo_dakika")
        .eq("run_id", runId),
      db
        .from("simulation_decisions")
        .select("decision_point_id, scenario_decision_points(kod)")
        .eq("run_id", runId),
    ]);

  const aksiyonKodById = new Map((aksiyonlarRow ?? []).map((a) => [a.id, a.kod]));

  const kurallar: PuanlamaKurali[] = (kurallarRow ?? []).map((k) => ({
    kod: k.kod,
    tip: k.tip as PuanlamaKurali["tip"],
    bilesen: k.bilesen as PuanlamaKurali["bilesen"],
    agirlik: Number(k.agirlik),
    aciklama: k.aciklama,
    beklenenAksiyon: k.expected_action_id ? (aksiyonKodById.get(k.expected_action_id) ?? null) : null,
    parametreler: (k.parametreler as Record<string, unknown>) ?? {},
  }));

  // İşaretlenmemiş aksiyon = tamamlanmadı. Sessizce yok saymak, yapılmamış
  // bir aksiyonu puanlama dışında bırakıp puanı şişirirdi.
  const sonucByActionId = new Map(
    (sonuclarRow ?? []).map((s) => [s.expected_action_id, s]),
  );
  const aksiyonlar = (aksiyonlarRow ?? []).map((a) => {
    const s = sonucByActionId.get(a.id);
    return {
      kod: a.kod,
      tamamlandi: s?.tamamlandi ?? false,
      dakika: s?.senaryo_dakika ?? null,
    };
  });

  const verilenKararlar = (kararlarRow ?? [])
    .map((k) => (k.scenario_decision_points as unknown as { kod: string } | null)?.kod)
    .filter((k): k is string => Boolean(k));

  const sonuc = puanla({
    kurallar,
    aksiyonlar,
    verilenKararlar,
    // Gözlemci puanı UI'da henüz toplanmıyor: null geçiyoruz, motor da bu
    // kuralı paydadan düşürüyor. Uydurma bir değer vermek, puanı sahte
    // biçimde etkilerdi.
    gozlemciPuani: null,
  });

  // --- Yazma: yalnızca burada service_role ---
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }

  const admin = createServiceClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { error: scoreErr } = await admin.from("simulation_scores").upsert(
    {
      run_id: runId,
      tenant_id: run.tenant_id,
      puan: sonuc.puan,
      durum: sonuc.durum,
      // Puan satırları JSON-serileştirilebilir düz nesnelerdir; TypeScript
      // bunu Json tipine kendiliğinden daraltamıyor.
      satirlar: sonuc.satirlar as unknown as Json,
      kritik_basarisizliklar: sonuc.kritikBasarisizliklar as unknown as Json,
      hesaplandi_at: new Date().toISOString(),
    },
    { onConflict: "run_id" },
  );
  if (scoreErr) {
    return NextResponse.json({ hata: scoreErr.message }, { status: 500 });
  }

  // Beklenen aksiyon -> kontroller: simülasyonu ana ürüne bağlayan eşleme.
  const { data: mappings } = await admin
    .from("scenario_control_mappings")
    .select("control_id, expected_action_id");

  const aksiyonKontrolleri = new Map<string, string[]>();
  for (const m of mappings ?? []) {
    const kod = aksiyonKodById.get(m.expected_action_id);
    if (!kod) continue;
    aksiyonKontrolleri.set(kod, [...(aksiyonKontrolleri.get(kod) ?? []), m.control_id]);
  }

  const oneriler = bulguOnerileriUret(sonuc, kurallar, aksiyonKontrolleri);

  // Öneriler PROPOSED doğar; insan kabul etmeden gerçek bulgu olmaz (kural 11).
  // Yeniden puanlamada kopya oluşmasın diye önce bu run'ın açık önerileri
  // temizlenir — KABUL/RET edilmişlere DOKUNULMAZ, onlar karar kaydıdır.
  await admin
    .from("simulation_finding_proposals")
    .delete()
    .eq("run_id", runId)
    .eq("durum", "PROPOSED");

  if (oneriler.length > 0) {
    const { error: propErr } = await admin.from("simulation_finding_proposals").insert(
      oneriler.map((o) => ({
        run_id: runId,
        tenant_id: run.tenant_id,
        control_id: o.controlId,
        baslik: o.baslik,
        gerekce: o.gerekce,
        onem: o.onem,
      })),
    );
    if (propErr) {
      return NextResponse.json({ hata: propErr.message }, { status: 500 });
    }
  }

  // Durum makinesi: tamamlandi -> puanlaniyor -> incelendi.
  await admin.from("simulation_runs").update({ durum: "puanlaniyor" }).eq("id", runId);
  await admin.from("simulation_runs").update({ durum: "incelendi" }).eq("id", runId);

  return NextResponse.json({
    puan: sonuc.puan,
    durum: sonuc.durum,
    kritikBasarisizliklar: sonuc.kritikBasarisizliklar,
    oneriSayisi: oneriler.length,
  });
}
