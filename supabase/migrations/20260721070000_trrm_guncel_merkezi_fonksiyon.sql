-- Dikey F, F5 hazırlık — kurucu Karar B (docs/adr/PR0-dikeyF-f5-kurtarma-
-- karsilastirmasi-2026-07-21.md): "güncel TRRM kaydı" sorgusu TEK bir DB
-- fonksiyonuna çıkarılır. NEDEN: bu mantık şu ana kadar İKİ bağımsız yerde
-- ayrı ayrı yazılmıştı (route.ts'te TS Set mantığı, proof_room_goruntule()'de
-- SQL `order by created_at desc limit 1`) — F5 üçüncü bir kopya yazarsaydı üç
-- ayrı "güncel kayıt" tanımı oluşurdu. `ORDER BY ... LIMIT 1` KABUL EDİLMEDİ
-- (kurucu kararı): "en yeni kayıt" ile "geçerli supersede yaprağı" AYNI şey
-- değildir — LIMIT 1 belirsizliği SESSİZCE çözer, anomaliyi gizler.
--
-- SÖZLEŞME: anomaliyi GÖRÜNÜR kılan dört durum (rastgele seçim YOK):
--   GUNCEL_KAYIT_VAR         — tam olarak bir "yaprak" (supersede edilmemiş) var.
--   KAYIT_YOK                — bu koşuya hiç ölçüm bağlı değil.
--   BIRDEN_FAZLA_GUNCEL_KAYIT — birden fazla bağımsız kök/yaprak var (şema
--     bunu YASAKLAMAZ — biri diğerini supersede etmeden aynı koşuya ikinci
--     bağımsız bir ölçüm eklenebilir). Motor rastgele birini SEÇMEZ.
--   ZINCIR_HATASI            — bir supersede referansı, AYNI koşu/kiracı
--     kapsamında ÇÖZÜLEMİYOR (trrm_tenant_guard bunu INSERT anında engeller;
--     bu kontrol SAVUNMA AMAÇLI — F3'ün "yapısal olarak imkansız ama motor
--     yine de ele alır" deseninin aynısı).
--
-- TENANT KAPSAMI: `p_tenant_id` AÇIKÇA parametre olarak alınır — fonksiyon
-- hem oturumlu route çağrılarında (RLS zaten kısıtlar) hem de security
-- definer / anonim bağlamlarda (Proof Room — current_tenant_id() orada NULL
-- döner) AYNI garantiyle çalışsın diye `current_tenant_id()`'ye GÜVENMEZ.

create or replace function public.test_run_kurtarma_olcumu_guncel(
  p_test_run_id uuid,
  p_tenant_id uuid
)
returns table (
  durum text,
  id uuid,
  tenant_id uuid,
  test_run_id uuid,
  olcum_kaynagi text,
  girdi_modu text,
  kesinti_baslangic_at timestamptz,
  hizmet_geri_geldi_at timestamptz,
  son_tutarli_veri_at timestamptz,
  kurtarma_noktasi_at timestamptz,
  beyan_kesinti_saat numeric,
  beyan_veri_kaybi_saat numeric,
  olculen_kesinti_saat numeric,
  olculen_veri_kaybi_saat numeric,
  evidence_id uuid,
  source_system text,
  source_event_id text,
  declarant_present boolean,
  supersedes_measurement_id uuid,
  olcum_hash text,
  measured_at timestamptz,
  recorded_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_sayi integer;
begin
  -- ZINCIR_HATASI (savunmacı): bir supersede referansı aynı koşu+kiracı
  -- kapsamında çözülemiyorsa (yapısal olarak imkansız — trrm_tenant_guard
  -- bunu engeller — ama rastgele seçim yerine açıkça işaretlenir).
  if exists (
    select 1
    from public.test_run_recovery_measurements m
    where m.test_run_id = p_test_run_id
      and m.tenant_id = p_tenant_id
      and m.supersedes_measurement_id is not null
      and not exists (
        select 1 from public.test_run_recovery_measurements hedef
        where hedef.id = m.supersedes_measurement_id
          and hedef.test_run_id = p_test_run_id
          and hedef.tenant_id = p_tenant_id
      )
  ) then
    return query select 'ZINCIR_HATASI'::text, null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::uuid, null::text, null::text, null::boolean, null::uuid, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  select count(*) into v_sayi
  from public.test_run_recovery_measurements m
  where m.test_run_id = p_test_run_id
    and m.tenant_id = p_tenant_id
    and not exists (
      select 1 from public.test_run_recovery_measurements m2
      where m2.supersedes_measurement_id = m.id
    );

  if v_sayi = 0 then
    return query select 'KAYIT_YOK'::text, null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::uuid, null::text, null::text, null::boolean, null::uuid, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_sayi > 1 then
    return query select 'BIRDEN_FAZLA_GUNCEL_KAYIT'::text, null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz, null::timestamptz,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::uuid, null::text, null::text, null::boolean, null::uuid, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz;
    return;
  end if;

  return query
    select 'GUNCEL_KAYIT_VAR'::text, m.id, m.tenant_id, m.test_run_id, m.olcum_kaynagi, m.girdi_modu,
           m.kesinti_baslangic_at, m.hizmet_geri_geldi_at, m.son_tutarli_veri_at, m.kurtarma_noktasi_at,
           m.beyan_kesinti_saat, m.beyan_veri_kaybi_saat, m.olculen_kesinti_saat, m.olculen_veri_kaybi_saat,
           m.evidence_id, m.source_system, m.source_event_id, m.declarant_present,
           m.supersedes_measurement_id, m.olcum_hash, m.measured_at, m.recorded_at, m.created_at
    from public.test_run_recovery_measurements m
    where m.test_run_id = p_test_run_id
      and m.tenant_id = p_tenant_id
      and not exists (
        select 1 from public.test_run_recovery_measurements m2
        where m2.supersedes_measurement_id = m.id
      );
end;
$$;

revoke all on function public.test_run_kurtarma_olcumu_guncel(uuid, uuid) from public;
grant execute on function public.test_run_kurtarma_olcumu_guncel(uuid, uuid) to authenticated, anon;

-- =====================================================================
-- proof_room_goruntule() forward-fix: kurtarma ölçümü bloğu artık YUKARIDAKİ
-- merkezi fonksiyonu KULLANIR (kendi `order by ... limit 1` sorgusu yerine).
-- GÜNCEL sürüm 20260721040000 TAM temel alındı; TEK değişiklik
-- v_kurtarma_olcumu hesaplama bloğu. Anomali durumunda (BIRDEN_FAZLA_
-- GUNCEL_KAYIT/ZINCIR_HATASI) kurtarmaOlcumu SESSİZCE rastgele bir kayıt
-- GÖSTERMEZ — null döner (F3'ün "belirsizlikte üretme" ilkesiyle aynı).
-- =====================================================================

create or replace function public.proof_room_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_run record;
  v_foto record;
  v_zincir jsonb;
  v_appl jsonb;
  v_kanit jsonb;
  v_export record;
  v_provenance_ozet jsonb;
  v_snapshot record;
  v_profil record;
  v_tanim record;
  v_kabul_edilmis_bulgu jsonb;
  v_kapanan_bulgular jsonb;
  v_retest_niyeti jsonb;
  v_paket record;
  v_kurtarma_olcumu jsonb;
  v_guncel_olcum record;
begin
  select * into v_link from public.proof_room_links where token = p_token;
  if v_link is null or v_link.son_gecerlilik < now() or v_link.iptal_edildi then
    return null;
  end if;

  if v_link.cloud_assurance_profile_id is not null then
    select id, profil, profil_hash, hesaplama_yontemi, iliskili_roi_export_run_id, created_at
      into v_profil
    from public.cloud_assurance_profile_snapshots
    where id = v_link.cloud_assurance_profile_id and tenant_id = v_link.tenant_id;
    if v_profil is null then
      return null;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('cloudAssuranceProfileId', v_profil.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'cloudAssuranceProfile', jsonb_build_object(
        'id', v_profil.id,
        'profil', v_profil.profil,
        'profilHash', v_profil.profil_hash,
        'hesaplamaYontemi', v_profil.hesaplama_yontemi,
        'iliskiliRoiExportId', v_profil.iliskili_roi_export_run_id,
        'olusturulmaZamani', v_profil.created_at
      )
    );
  end if;

  if v_link.graph_snapshot_id is not null then
    select id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi, iliskili_roi_export_run_id, created_at
      into v_snapshot
    from public.impact_graph_snapshots
    where id = v_link.graph_snapshot_id and tenant_id = v_link.tenant_id;
    if v_snapshot is null then
      return null;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('graphSnapshotId', v_snapshot.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'graphSnapshot', jsonb_build_object(
        'id', v_snapshot.id,
        'graf', v_snapshot.graf,
        'grafHash', v_snapshot.graf_hash,
        'spofRaporu', v_snapshot.spof_raporu,
        'yayilimRaporu', v_snapshot.yayilim_raporu,
        'hesaplamaYontemi', v_snapshot.hesaplama_yontemi,
        'iliskiliRoiExportId', v_snapshot.iliskili_roi_export_run_id,
        'olusturulmaZamani', v_snapshot.created_at
      )
    );
  end if;

  if v_link.roi_export_run_id is not null then
    select id, paket, paket_hash, on_kontrol_raporu, durum, onay_zamani, provenance_raporu
      into v_export
    from public.roi_export_runs
    where id = v_link.roi_export_run_id
      and tenant_id = v_link.tenant_id
      and durum = 'YAYINLANDI';
    if v_export is null then
      return null;
    end if;

    if v_export.provenance_raporu is null then
      v_provenance_ozet := null;
    else
      select coalesce(jsonb_agg(jsonb_build_object(
          'alanKodu', s ->> 'sablon',
          'kaynakDurumu', s ->> 'kaynakDurumu',
          'genelDurum', s ->> 'genelDurum',
          'iddiaSayisi', (s ->> 'iliskiliIddiaSayisi')::int
        ) order by s ->> 'sablon'), '[]'::jsonb)
        into v_provenance_ozet
      from jsonb_array_elements(v_export.provenance_raporu -> 'satirlar') s;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('roiExportRunId', v_export.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'roiExport', jsonb_build_object(
        'id', v_export.id,
        'paket', v_export.paket,
        'paketHash', v_export.paket_hash,
        'onKontrolRaporu', v_export.on_kontrol_raporu,
        'yayinlanmaZamani', v_export.onay_zamani,
        'ledgerDurumu', public.artifact_ledger_durumu('roi_export_runs', v_export.id),
        'provenanceOzeti', v_provenance_ozet
      )
    );
  end if;

  if v_link.kritik_hizmet_test_paketi_snapshot_id is not null then
    select id, paket, paket_hash, hesaplama_yontemi, created_at
      into v_paket
    from public.kritik_hizmet_test_paketi_snapshots
    where id = v_link.kritik_hizmet_test_paketi_snapshot_id and tenant_id = v_link.tenant_id;
    if v_paket is null then
      return null;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('kritikHizmetTestPaketiSnapshotId', v_paket.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'kritikHizmetTestPaketi', jsonb_build_object(
        'id', v_paket.id,
        'paket', v_paket.paket,
        'paketHash', v_paket.paket_hash,
        'hesaplamaYontemi', v_paket.hesaplama_yontemi,
        'olusturulmaZamani', v_paket.created_at
      )
    );
  end if;

  select r.id, r.sonuc, r.gerekce, r.calisti_at, r.control_id, r.evidence_id,
         d.ad as tanim_ad, c.madde_ref, c.baslik as kontrol_baslik
    into v_run
  from public.test_runs r
  join public.control_test_definitions d on d.id = r.test_definition_id
  join public.controls c on c.id = r.control_id
  where r.id = v_link.test_run_id and r.tenant_id = v_link.tenant_id;
  if v_run is null then
    return null;
  end if;

  select karar, snapshot into v_foto
  from public.execution_legal_snapshots
  where test_run_id = v_run.id;

  select coalesce(jsonb_agg(z order by z."obligationKod"), '[]'::jsonb) into v_zincir
  from (
    select
      o.kod as "obligationKod",
      o.nitelik,
      o.dogrulama_durumu as "obligationDogrulama",
      m.dogrulama_durumu as "mappingDogrulama",
      m.kapsam,
      p.provision_ref as "provisionRef",
      p.effective_from as "effectiveFrom",
      p.effective_to as "effectiveTo",
      p.dogrulama_durumu as "provisionDogrulama",
      left(p.metin, 240) as snippet,
      a.baslik as "artifactBaslik",
      a.sha256 as "artifactSha256",
      s.authority,
      s.ad as "kaynakAd",
      s.jurisdiction,
      s.kaynak_seviyesi as "kaynakSeviyesi",
      s.canonical_url as "canonicalUrl"
    from public.obligation_control_mappings m
    join public.obligations o on o.id = m.obligation_id
    join public.provisions p on p.id = o.provision_id
    join public.source_artifacts a on a.id = p.source_artifact_id
    join public.regulatory_sources s on s.id = a.source_id
    where m.control_id = v_run.control_id
      and m.dogrulama_durumu <> 'REJECTED'
  ) z;

  select coalesce(jsonb_agg(k), '[]'::jsonb) into v_appl
  from (
    select o.kod as "obligationKod", ad2.durum, ad2.gerekce,
           ad2.fact_snapshot_fingerprint as "factSnapshotFingerprint",
           ad2.karar_kaynagi as "kararKaynagi"
    from public.applicability_decisions ad2
    join public.obligations o on o.id = ad2.obligation_id
    join public.obligation_control_mappings m on m.obligation_id = o.id
    where m.control_id = v_run.control_id
      and ad2.tenant_id = v_link.tenant_id
      and ad2.superseded_at is null
  ) k;

  select case when v_run.evidence_id is null then null
    else (
      select jsonb_build_object('evidenceId', e.id, 'dosyaHashSha256', e.hash_sha256)
      from public.evidences e where e.id = v_run.evidence_id
    ) end into v_kanit;

  -- --- Dikey F, F1: V2/V3 manifest özeti ---
  select
    r.amac, r.kapsam, r.hedef_varlik, r.kritik_hizmet_adi, r.critical_service_id,
    r.senaryo_kimligi, r.senaryo_surumu, r.scenario_template_id,
    tr.beklenen_sonuc, tr.performans_etkisi, tr.yanlis_pozitif, tr.yanlis_negatif,
    tr.baslangic_at, tr.bitis_at, tr.retest_of_finding_id,
    (tr.hazirlayan is not null) as hazirlayan_belirtildi,
    (tr.sorumlu is not null) as sorumlu_belirtildi,
    (tr.bagimsiz_onaylayan is not null) as bagimsiz_onaylayan_belirtildi
  into v_tanim
  from public.control_test_definitions r
  join public.test_runs tr on tr.id = v_run.id
  where r.id = tr.test_definition_id;

  select case when p.finding_id is null then null
    else jsonb_build_object('findingId', p.finding_id, 'onem', p.onem, 'durum', f.durum)
    end into v_kabul_edilmis_bulgu
  from public.control_test_finding_proposals p
  left join public.findings f on f.id = p.finding_id
  where p.test_run_id = v_run.id and p.durum = 'KABUL';

  select coalesce(jsonb_agg(jsonb_build_object('findingId', f2.id, 'kapaninZamani', f2.kapatma_onay_at)), '[]'::jsonb)
    into v_kapanan_bulgular
  from public.findings f2
  where f2.kapatma_retest_run_id = v_run.id;

  select case when v_tanim.retest_of_finding_id is null then null
    else jsonb_build_object('findingId', v_tanim.retest_of_finding_id)
    end into v_retest_niyeti;

  -- --- Dikey F, F5 Karar B: MERKEZİ fonksiyon üzerinden güncel kurtarma
  --     ölçümü (ham beyan_eden DÖNMEZ). Anomali (KAYIT_YOK/BIRDEN_FAZLA_
  --     GUNCEL_KAYIT/ZINCIR_HATASI) durumunda kurtarmaOlcumu null kalır —
  --     rastgele bir kayıt SESSİZCE gösterilmez.
  select * into v_guncel_olcum
  from public.test_run_kurtarma_olcumu_guncel(v_run.id, v_link.tenant_id);

  if v_guncel_olcum.durum = 'GUNCEL_KAYIT_VAR' then
    v_kurtarma_olcumu := jsonb_build_object(
      'olcumKaynagi', v_guncel_olcum.olcum_kaynagi,
      'girdiModu', v_guncel_olcum.girdi_modu,
      'olculenKesintiSaat', v_guncel_olcum.olculen_kesinti_saat,
      'olculenVeriKaybiSaat', v_guncel_olcum.olculen_veri_kaybi_saat,
      'beyanKesintiSaat', v_guncel_olcum.beyan_kesinti_saat,
      'beyanVeriKaybiSaat', v_guncel_olcum.beyan_veri_kaybi_saat,
      'birim', 'SAAT',
      'olcumHash', v_guncel_olcum.olcum_hash,
      'olcumZamani', v_guncel_olcum.measured_at,
      'karsilastirmaYapildi', false
    );
  else
    v_kurtarma_olcumu := null;
  end if;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
    jsonb_build_object('testRunId', v_run.id)
  );

  return jsonb_build_object(
    'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
    'sonGecerlilik', v_link.son_gecerlilik,
    'kosu', jsonb_build_object(
      'id', v_run.id, 'sonuc', v_run.sonuc, 'gerekce', v_run.gerekce,
      'calistiAt', v_run.calisti_at, 'tanimAd', v_run.tanim_ad,
      'kontrolMaddeRef', v_run.madde_ref, 'kontrolBaslik', v_run.kontrol_baslik
    ),
    'legalSnapshot', case when v_foto is null then null
      else jsonb_build_object('karar', v_foto.karar, 'snapshot', v_foto.snapshot) end,
    'kaynakZinciri', v_zincir,
    'applicability', v_appl,
    'kanit', v_kanit,
    'ledgerDurumu', public.artifact_ledger_durumu('test_runs', v_run.id),
    'manifestOzeti', jsonb_build_object(
      'semaSurumu', 'KALKAN_CONTROL_TEST_RUN_MANIFEST_V3',
      'amac', v_tanim.amac,
      'kapsam', v_tanim.kapsam,
      'hedefVarlik', v_tanim.hedef_varlik,
      'kritikHizmetAdi', v_tanim.kritik_hizmet_adi,
      'kritikHizmetIdDogrulanmis', v_tanim.critical_service_id is not null,
      'senaryoKimligi', v_tanim.senaryo_kimligi,
      'senaryoSurumu', v_tanim.senaryo_surumu,
      'senaryoIdDogrulanmis', v_tanim.scenario_template_id is not null,
      'beklenenSonuc', v_tanim.beklenen_sonuc,
      'performansEtkisi', v_tanim.performans_etkisi,
      'yanlisPozitif', v_tanim.yanlis_pozitif,
      'yanlisNegatif', v_tanim.yanlis_negatif,
      'baslangicAt', v_tanim.baslangic_at,
      'bitisAt', v_tanim.bitis_at,
      'hazirlayanBelirtildi', v_tanim.hazirlayan_belirtildi,
      'sorumluBelirtildi', v_tanim.sorumlu_belirtildi,
      'bagimsizOnaylayanBelirtildi', v_tanim.bagimsiz_onaylayan_belirtildi
    ),
    'retestNiyeti', v_retest_niyeti,
    'iliskiselBaglantilar', jsonb_build_object('kabulEdilmisBulgu', v_kabul_edilmis_bulgu),
    'kapanisBaglantisi', jsonb_build_object('kapananBulgular', v_kapanan_bulgular),
    'kurtarmaOlcumu', v_kurtarma_olcumu
  );
end;
$$;
