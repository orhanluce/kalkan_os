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
import { LocalAppendOnlyAnchorProvider } from "@/lib/anchor";
import type { CanonicalDeger } from "@/lib/canonical";
import { envelopeHash, zarfOlustur, type EvidenceRow } from "@/lib/evidence-envelope";
import { LocalDevSigner, detachedJwsImzala } from "@/lib/manifest-signature";
import { bulguOnerileriUret, puanla, type PuanlamaKurali } from "@/lib/scoring";
import { coreManifestOlustur, type ManifestKanit } from "@/lib/simulation-manifest";
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
    // TEK STRING LİTERALİ: supabase-js dönüş tipini bu literalden çıkarır.
    // Parçalayıp `+` ile birleştirmek tipi `string`e düşürür ve satır
    // `GenericStringError` olur — alanlar sessizce kaybolmaz, typecheck patlar.
    .select(
      "id, tenant_id, version_id, durum, ad, mod, zaman_olcegi, basladi_at, bitti_at, tenants(name), scenario_template_versions(surum, scenario_templates(kod, ad))",
    )
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
        .select("decision_point_id, cevap, senaryo_dakika, evidence_id, scenario_decision_points(kod)")
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

  // --- Sonuç manifestini mühürle (M9, belge §11.3) ---
  //
  // NEDEN BURADA: manifest "bu tatbikat şu sonucu verdi" iddiasını dondurur.
  // Puan yazıldıktan SONRA mühürlenmeli (yoksa neyi mühürlediği belirsiz),
  // ama durum 'incelendi'ye geçmeden önce — mühür sonucun parçasıdır, sonradan
  // eklenen bir süs değil.
  //
  // TEKRAR MÜHÜRLEME YOK: run_id unique. Zaten durum makinesi de ikinci bir
  // puanlamayı 409'la reddediyor (yukarıdaki durum kontrolü) — bir tatbikatın
  // iki resmi sonucu olamaz.
  const sablonSurum = run.scenario_template_versions;
  const sablon = sablonSurum?.scenario_templates;

  // Kararlara bağlı kanıtlar. Hash'i olmayan kanıt (link/beyan tipi) manifeste
  // girmez: null'ı "hash" diye mühürlemek, olmayan bir bütünlük iddiası
  // üretirdi.
  const kanitIdleri = (kararlarRow ?? [])
    .map((k) => k.evidence_id)
    .filter((id): id is string => Boolean(id));

  const { data: kanitlarRow } = kanitIdleri.length
    ? await admin
        .from("evidences")
        .select(
          "id, tenant_id, tip, hash_sha256, hash_algorithm, version_no, file_size, mime_type, storage_object_key, storage_version_id, source_system, captured_at, created_at, yukleyen, retention_class, classification, previous_file_hash, previous_envelope_hash, redaksiyon_kaynak_id, redaksiyon_notu, legal_hold, envelope_schema_version, controls(madde_ref)",
        )
        .in("id", kanitIdleri)
    : { data: [] };

  // Her kanıt İKİ hash taşır (M9): dosya hash'i "bu bayt dizisi vardı" der,
  // zarf hash'i "bu dosya şu kaynaktan şu tarihte şu sınıfla sunuldu" der.
  //
  // ZARFI OLMAYAN KAYIT LEGACY_FILE_HASH_ONLY: zarf göçünden (20260717190000)
  // önce yazılmış kanıtların köken alanları yok. Onlara varsayılan atayıp zarf
  // üretmek, uydurulmuş bir köken iddiasını hash'lemek olurdu — ve o hash
  // denetim raporuna "doğrulandı" diye girerdi. Bu kayıtlar "dosya bütünlüğü
  // doğrulandı" diyebilir, "kanıt kökeni doğrulandı" DİYEMEZ.
  const kanitlar: ManifestKanit[] = await Promise.all(
    (kanitlarRow ?? [])
      .filter((e) => Boolean(e.hash_sha256))
      .map(async (e) => {
        const maddeRef = (e.controls as unknown as { madde_ref: string } | null)?.madde_ref;
        const zarf = zarfOlustur(e as unknown as EvidenceRow, maddeRef ? [maddeRef] : []);
        return {
          evidenceVersionId: e.id,
          fileHash: e.hash_sha256 as string,
          envelopeHash: zarf ? await envelopeHash(zarf) : null,
          envelopeSchemaVersion: zarf ? zarf.sema : null,
          durum: zarf ? ("FULL_ENVELOPE" as const) : ("LEGACY_FILE_HASH_ONLY" as const),
        };
      }),
  );

  const muhur = await coreManifestOlustur({
    runId,
    tenantId: run.tenant_id,
    kurumAdi: run.tenants?.name ?? "Bilinmeyen kurum",
    senaryoKodu: sablon?.kod ?? "BILINMEYEN",
    senaryoAdi: sablon?.ad ?? "Bilinmeyen senaryo",
    sablonSurum: sablonSurum?.surum ?? 0,
    tatbikatAdi: run.ad,
    mod: run.mod,
    zamanOlcegi: Number(run.zaman_olcegi),
    basladiAt: run.basladi_at,
    bittiAt: run.bitti_at,
    kararlar: (kararlarRow ?? []).map((k) => ({
      kod: (k.scenario_decision_points as unknown as { kod: string } | null)?.kod ?? "BILINMEYEN",
      senaryoDakika: k.senaryo_dakika,
      cevap: k.cevap ?? "",
      kanitVar: Boolean(k.evidence_id),
    })),
    aksiyonlar: aksiyonlar.map((a) => ({ kod: a.kod, tamamlandi: a.tamamlandi, dakika: a.dakika })),
    kanitlar,
    kurallar: kurallar.map((k) => ({
      kod: k.kod,
      tip: k.tip,
      agirlik: k.agirlik,
      parametreler: k.parametreler,
    })),
    puan: sonuc.puan,
    durum: sonuc.durum,
    satirlar: sonuc.satirlar.map((s) => ({
      kod: s.kod,
      sonuc: s.sonuc,
      puan: s.puan,
      agirlik: s.agirlik,
    })),
    kritikBasarisizliklar: sonuc.kritikBasarisizliklar,
    oneriSayisi: oneriler.length,
  });

  // --- Çekirdek manifesti İMZALA (ADR-M11-01) ---
  //
  // İmza mühürle AYNI INSERT'te yazılır ve manifest immutable olduğu için
  // donar. İmzalayıcı bugün LocalDevSigner: private key bu süreçte, bellekte,
  // GEÇİCİ. Production'da yerine KMS/HSM imzalayıcı gelir (aynı arayüz, private
  // key dışarı çıkmaz). Bu imza "geliştirme anahtarı imzaladı" der — production
  // authenticity'si değil; doğrulama yüzeyi bunu açıkça söyler.
  const signer = await LocalDevSigner.olustur();
  const imza = await detachedJwsImzala(muhur.coreManifest as unknown as CanonicalDeger, signer);

  const { data: manifestRow, error: manifestErr } = await admin
    .from("simulation_result_manifests")
    .insert({
      run_id: runId,
      tenant_id: run.tenant_id,
      core_manifest: muhur.coreManifest as unknown as Json,
      core_manifest_hash: muhur.coreManifestHash,
      report_data_hash: muhur.reportDataHash,
      // Mühürlenen veri mühürle birlikte saklanır: hash tek başına raporu
      // yeniden üretmeye yetmez (bkz. 20260717181000).
      report_data: muhur.reportData as unknown as Json,
      merkle_root: muhur.merkleRoot,
      // İmza (ADR-M11-01). Yalnız public JWK saklanır; private key HSM/KMS'te.
      signature_jws: imza.jws,
      signature_kid: imza.kid,
      signature_public_jwk: imza.publicJwk as unknown as Json,
      signer_ad: signer.ad,
    })
    .select("id")
    .single();

  if (manifestErr) {
    return NextResponse.json({ hata: manifestErr.message }, { status: 500 });
  }

  // Her imzalama audit log'a yazılır (ADR-M11-01). Trigger'lar tenant_controls
  // gibi tabloları otomatik yakalıyor ama manifest imzalama uygulama-seviyesi
  // bir olay; audit izinin bunu da görmesi gerekiyor.
  await admin.from("audit_log").insert({
    tenant_id: run.tenant_id,
    actor_id: user.id,
    eylem: "kanit_imzalandi",
    hedef_tablo: "simulation_result_manifests",
    hedef_id: manifestRow.id,
    detay: { kid: imza.kid, signer: signer.ad, core_manifest_hash: muhur.coreManifestHash },
  });

  // Sabitleme (anchor). Sağlayıcı bugün local — bağımsız bir zaman damgası
  // DEĞİL (M9 kararı: RFC 3161 ertelendi, ROADMAP'te kayıtlı). Bu yüzden
  // makbuz "mühür var" der, "üçüncü taraf tarihi doğruladı" demez.
  //
  // Sabitleme BAŞARISIZ OLSA BİLE manifest yazılmış olur ve akış durmaz
  // (şartname §9.2: sağlayıcı yoksa PENDING_ANCHOR). Makbuzsuz manifest
  // 'beklemede'dir; veri kaybı yok, yalnızca mühür eksik.
  try {
    const provider = new LocalAppendOnlyAnchorProvider();
    const makbuz = await provider.anchor(muhur.merkleRoot, {
      tenantId: run.tenant_id,
      yaprakSayisi: 1,
    });
    await admin.from("simulation_manifest_receipts").insert({
      manifest_id: manifestRow.id,
      tenant_id: run.tenant_id,
      saglayici: makbuz.saglayici,
      anchored_at: makbuz.anchoredAt,
      payload: makbuz.payload as unknown as Json,
    });
  } catch {
    // Yutuluyor ve bu bilinçli: sabitleme tekrar denenebilir bir iştir,
    // puanlamayı geri almak için sebep değil.
  }

  // Durum makinesi: tamamlandi -> puanlaniyor -> incelendi.
  await admin.from("simulation_runs").update({ durum: "puanlaniyor" }).eq("id", runId);
  await admin.from("simulation_runs").update({ durum: "incelendi" }).eq("id", runId);

  return NextResponse.json({
    puan: sonuc.puan,
    durum: sonuc.durum,
    kritikBasarisizliklar: sonuc.kritikBasarisizliklar,
    oneriSayisi: oneriler.length,
    coreManifestHash: muhur.coreManifestHash,
    reportDataHash: muhur.reportDataHash,
  });
}
